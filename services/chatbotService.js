import { Chat, Message } from '../sequelize/relation.js';
import { buildUserContext } from './contextBuilder.js';
import { classifyIntent, shouldSearchWeb, generateSearchQuery } from './intentClassifier.js';
import { generateResponse, summarizeIfNeeded } from './aiService.js';
import { searchWeb } from './searchService.js';
import { Op } from 'sequelize';

/**
 * Get or create chat for user (one chat per user)
 * @param {number} userId - User ID
 * @returns {Promise<Chat>} - Chat instance
 */
async function getChatForUser(userId) {
    let chat = await Chat.findOne({ where: { user_id: userId } });

    if (!chat) {
        chat = await Chat.create({
            user_id: userId,
            total_messages: 0
        });
    }

    return chat;
}

/**
 * Get recent messages for context (not paginated - just for AI)
 * @param {number} chatId - Chat ID
 * @param {number} limit - Number of messages
 * @returns {Promise<Array>} - Messages array
 */
async function getRecentMessagesForContext(chatId, limit = 10) {
    const messages = await Message.findAll({
        where: { chat_id: chatId },
        order: [['created_at', 'DESC']],
        limit: limit
    });

    // Convert to format expected by AI service
    return messages.reverse().map(msg => ({
        sender_type: msg.user_message ? 'user' : 'bot',
        message_text: msg.message_text,
        created_at: msg.created_at
    }));
}

/**
 * Send message and get bot response
 * @param {number} userId - User ID
 * @param {string} messageText - User's message
 * @returns {Promise<object>} - Result with messages
 */
export async function sendMessage(userId, messageText) {
    const startTime = Date.now();

    try {
        // 1. Get or create chat
        const chat = await getChatForUser(userId);

        // 2. Save user message
        const userMessage = await Message.create({
            chat_id: chat.id,
            message_text: messageText,
            user_message: true
        });

        // 3. Build user context
        const userContext = await buildUserContext(userId);

        // 4. Get conversation history for AI
        let conversationHistory = await getRecentMessagesForContext(chat.id, 10);
        conversationHistory = await summarizeIfNeeded(conversationHistory);

        // 5. Classify intent
        const { intent, confidence } = classifyIntent(messageText);

        // 6. Search web if needed
        const needsSearch = shouldSearchWeb(intent, userContext);
        let searchResults = null;

        if (needsSearch) {
            const searchQuery = generateSearchQuery(messageText, userContext);
            searchResults = await searchWeb(searchQuery, {
                context: 'agricultural',
                maxResults: 5
            });
        }

        // 7. Generate AI response
        const context = {
            userContext,
            conversationHistory,
            searchResults,
            intent
        };

        const aiResponse = await generateResponse(messageText, context);

        // 8. Save bot message
        const botMessage = await Message.create({
            chat_id: chat.id,
            message_text: aiResponse.text,
            user_message: false
        });

        // 9. Update chat metadata
        await chat.update({
            last_message_at: new Date(),
            total_messages: chat.total_messages + 2
        });

        const totalTime = Date.now() - startTime;

        return {
            success: true,
            chatId: chat.id,
            userMessage: {
                id: userMessage.id,
                text: userMessage.message_text,
                timestamp: userMessage.created_at
            },
            botMessage: {
                id: botMessage.id,
                text: botMessage.message_text,
                timestamp: botMessage.created_at
            },
            intent: intent,
            confidence: confidence,
            sources: searchResults?.results || [],
            searchPerformed: !!searchResults,
            userContextUsed: userContext.totalPredictions > 0,
            metadata: {
                totalTime: totalTime,
                aiTime: aiResponse.responseTime,
                tokensUsed: aiResponse.tokensUsed
            }
        };

    } catch (error) {
        console.error('Send message error:', error);
        return {
            success: false,
            error: error.message,
            botMessage: {
                text: "عذراً، حدث خطأ. (Sorry, an error occurred.) يرجى المحاولة مرة أخرى."
            }
        };
    }
}

/**
 * Get paginated messages (reverse chronological - newest first)
 * @param {number} userId - User ID
 * @param {object} options - Pagination options
 * @returns {Promise<object>} - Paginated messages
 */
export async function getMessages(userId, options = {}) {
    try {
        const {
            limit = 50,
            before = null  // Cursor ID (get messages before this)
        } = options;

        // Validate limit
        const pageSize = Math.min(Math.max(limit, 1), 100); // 1-100

        // Get user's chat
        const chat = await Chat.findOne({ where: { user_id: userId } });

        if (!chat) {
            return {
                success: true,
                chatId: null,
                messages: [],
                pagination: {
                    hasMore: false,
                    hasPrevious: false,
                    nextCursor: null,
                    previousCursor: null,
                    total: 0
                }
            };
        }

        // Build query
        const where = { chat_id: chat.id };

        if (before) {
            where.id = { [Op.lt]: before };
        }

        // Fetch messages (oldest first) + 1 extra to check hasMore
        const messages = await Message.findAll({
            where,
            order: [['created_at', 'ASC'], ['id', 'ASC']],
            limit: pageSize + 1
        });

        // Check if there are more messages beyond the requested page
        const hasMore = messages.length > pageSize;
        const resultMessages = hasMore ? messages.slice(0, pageSize) : messages;

        // Determine cursors
        const nextCursor = hasMore ? resultMessages[resultMessages.length - 1].id : null;
        const previousCursor = before || null;

        // Format messages
        const formattedMessages = resultMessages.map(msg => ({
            id: msg.id,
            text: msg.message_text,
            isUser: msg.user_message,
            timestamp: msg.created_at
        }));

        return {
            success: true,
            chatId: chat.id,
            messages: formattedMessages,
                pagination: {
                    hasMore,
                    hasPrevious: !!before,
                    nextCursor,
                    previousCursor,
                    total: chat.total_messages,
                    pageSize: pageSize
                }
        };

    } catch (error) {
        console.error('Get messages error:', error);
        return {
            success: false,
            error: error.message,
            messages: []
        };
    }
}

/**
 * Delete a single message for the user
 * @param {number} userId - User ID
 * @param {number} messageId - Message ID
 * @returns {Promise<object>} - Result
 */
export async function deleteMessage(userId, messageId) {
    try {
        const chat = await Chat.findOne({ where: { user_id: userId } });

        if (!chat) {
            return { success: false, error: 'Chat not found' };
        }

        const message = await Message.findOne({ where: { id: messageId, chat_id: chat.id } });

        if (!message) {
            return { success: false, error: 'Message not found' };
        }

        await message.destroy();

        const remainingCount = await Message.count({ where: { chat_id: chat.id } });
        const lastMessage = await Message.findOne({
            where: { chat_id: chat.id },
            order: [['created_at', 'DESC'], ['id', 'DESC']]
        });

        await chat.update({
            total_messages: remainingCount,
            last_message_at: lastMessage ? lastMessage.created_at : null
        });

        return { success: true };

    } catch (error) {
        console.error('Delete message error:', error);
        return { success: false, error: error.message };
    }
}

export default {
    sendMessage,
    getMessages,
    deleteMessage,
    getChatForUser
};
