import { ChatSession, ChatMessage } from '../sequelize/relation.js';
import { buildUserContext } from './contextBuilder.js';
import { classifyIntent, shouldSearchWeb, generateSearchQuery } from './intentClassifier.js';
import { generateResponse, summarizeIfNeeded } from './aiService.js';
import { searchWeb } from './searchService.js';

/**
 * Main chatbot service - handles complete message flow
 * @param {number} userId - User ID
 * @param {string} message - User message text
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Bot response object
 */
export async function handleMessage(userId, message, options = {}) {
    const {
        sessionId = null,
        isVoice = false,
        audioUrl = null,
        deviceType = 'web',
        userLocation = null
    } = options;

    const startTime = Date.now();

    try {
        // 1. Get or create session
        const session = await getOrCreateSession(userId, sessionId, deviceType, userLocation);

        // 2. Store user message
        const userMessageRecord = await ChatMessage.create({
            session_id: session.id,
            sender_type: 'user',
            message_text: message,
            message_audio_url: audioUrl,
            language: detectLanguage(message),
            created_at: new Date()
        });

        // 3. Build user context
        const userContext = await buildUserContext(userId);

        // 4. Get conversation history
        let conversationHistory = await getRecentMessages(session.id, 10);
        conversationHistory = await summarizeIfNeeded(conversationHistory);

        // 5. Classify intent
        const { intent, confidence } = classifyIntent(message);

        // 6. Determine if web search is needed
        const needsSearch = shouldSearchWeb(intent, userContext);
        let searchResults = null;

        if (needsSearch) {
            const searchQuery = generateSearchQuery(message, userContext);
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

        const aiResponse = await generateResponse(message, context);

        // 8. Store bot response
        const botMessageRecord = await ChatMessage.create({
            session_id: session.id,
            sender_type: 'bot',
            message_text: aiResponse.text,
            intent: intent,
            confidence_score: confidence,
            used_web_search: !!searchResults,
            used_user_history: userContext.totalPredictions > 0,
            web_sources: searchResults?.results || null,
            response_time_ms: aiResponse.responseTime,
            tokens_used: aiResponse.tokensUsed,
            created_at: new Date()
        });

        // 9. Update session
        await session.update({
            total_messages: session.total_messages + 2,
            ended_at: new Date()
        });

        const totalTime = Date.now() - startTime;

        // 10. Return response
        return {
            success: true,
            sessionId: session.id,
            response: {
                text: aiResponse.text,
                intent: intent,
                confidence: confidence
            },
            sources: searchResults?.results || [],
            searchPerformed: !!searchResults,
            userContextUsed: userContext.totalPredictions > 0,
            metadata: {
                totalTime,
                aiTime: aiResponse.responseTime,
                tokensUsed: aiResponse.tokensUsed
            }
        };

    } catch (error) {
        console.error('Chatbot error:', error);
        return {
            success: false,
            error: error.message,
            response: {
                text: "عذراً، حدث خطأ. (Sorry, an error occurred.) يرجى المحاولة مرة أخرى. (Please try again.)"
            }
        };
    }
}

/**
 * Get or create chat session
 * @param {number} userId - User ID
 * @param {number|null} sessionId - Existing session ID
 * @param {string} deviceType - Device type
 * @param {object} userLocation - User location
 * @returns {Promise<ChatSession>} - Session object
 */
async function getOrCreateSession(userId, sessionId, deviceType, userLocation) {
    if (sessionId) {
        // Try to get existing session
        const existingSession = await ChatSession.findOne({
            where: { id: sessionId, user_id: userId }
        });

        if (existingSession && existingSession.status === 'active') {
            return existingSession;
        }
    }

    // Create new session
    return await ChatSession.create({
        user_id: userId,
        started_at: new Date(),
        status: 'active',
        device_type: deviceType,
        user_location: userLocation,
        total_messages: 0
    });
}

/**
 * Get recent messages from session
 * @param {number} sessionId - Session ID
 * @param {number} limit - Maximum messages to retrieve
 * @returns {Promise<Array>} - Array of messages
 */
async function getRecentMessages(sessionId, limit = 10) {
    const messages = await ChatMessage.findAll({
        where: { session_id: sessionId },
        order: [['created_at', 'DESC']],
        limit: limit
    });

    return messages.reverse(); // Oldest first
}

/**
 * Get user's chat sessions
 * @param {number} userId - User ID
 * @param {number} limit - Maximum sessions to return
 * @returns {Promise<Array>} - Array of sessions with summaries
 */
export async function getUserSessions(userId, limit = 20) {
    const sessions = await ChatSession.findAll({
        where: { user_id: userId },
        order: [['started_at', 'DESC']],
        limit: limit,
        include: [{
            model: ChatMessage,
            as: 'messages',
            limit: 1,
            order: [['created_at', 'DESC']]
        }]
    });

    return sessions.map(session => ({
        id: session.id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        status: session.status,
        totalMessages: session.total_messages,
        lastMessage: session.messages[0]?.message_text || null,
        deviceType: session.device_type
    }));
}

/**
 * Get complete session history
 * @param {number} sessionId - Session ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<object>} - Session with all messages
 */
export async function getSessionHistory(sessionId, userId) {
    const session = await ChatSession.findOne({
        where: { id: sessionId, user_id: userId },
        include: [{
            model: ChatMessage,
            as: 'messages',
            order: [['created_at', 'ASC']]
        }]
    });

    if (!session) {
        throw new Error('Session not found or unauthorized');
    }

    return {
        id: session.id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        status: session.status,
        totalMessages: session.total_messages,
        messages: session.messages.map(msg => ({
            id: msg.id,
            senderType: msg.sender_type,
            text: msg.message_text,
            audioUrl: msg.message_audio_url,
            createdAt: msg.created_at,
            intent: msg.intent,
            sources: msg.web_sources
        }))
    };
}

/**
 * Close a chat session
 * @param {number} sessionId - Session ID
 * @param {number} userId - User ID
 * @param {string} summary - Optional session summary
 * @returns {Promise<boolean>} - Success status
 */
export async function closeSession(sessionId, userId, summary = null) {
    const session = await ChatSession.findOne({
        where: { id: sessionId, user_id: userId }
    });

    if (!session) {
        throw new Error('Session not found or unauthorized');
    }

    await session.update({
        status: 'closed',
        ended_at: new Date(),
        session_summary: summary
    });

    return true;
}

/**
 * Delete a chat session
 * @param {number} sessionId - Session ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteSession(sessionId, userId) {
    const session = await ChatSession.findOne({
        where: { id: sessionId, user_id: userId }
    });

    if (!session) {
        throw new Error('Session not found or unauthorized');
    }

    // Messages will be cascade deleted
    await session.destroy();

    return true;
}

/**
 * Detect language from text
 * @param {string} text - Input text
 * @returns {string} - Language code
 */
function detectLanguage(text) {
    // Simple heuristic-based detection
    if (/[\u0600-\u06FF]/.test(text)) {
        return 'arabic'; // Or 'darja' for Algerian dialect
    }
    if (/[àâäéèêëïîôùûüÿç]/i.test(text)) {
        return 'french';
    }
    return 'english';
}

export default {
    handleMessage,
    getUserSessions,
    getSessionHistory,
    closeSession,
    deleteSession
};
