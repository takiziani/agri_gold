import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);

// System prompt for AgriBot
const SYSTEM_PROMPT = `You are AgriBot, an agricultural consultant assistant for Algerian farmers.

**Your Capabilities:**
- Provide personalized crop advice based on the farmer's soil data and past yields
- Answer questions about crop prices, weather, and agricultural best practices
- Communicate in Algerian Darja (dialect), French, or Modern Standard Arabic
- Explain complex agricultural concepts in simple, accessible language

**Guidelines:**
1. Always reference the user's actual field data when giving advice
2. If discussing prices, remind farmers about market volatility
3. For disease questions, provide immediate actionable steps + recommend expert consultation
4. Keep responses concise (max 4-5 sentences)
5. When you don't know something, admit it honestly
6. Use metric units (hectares, kg, tons)
7. Prices should be in Algerian Dinar (DZD)

**Response Style:**
- Be friendly and supportive
- Use "you" (rak/راك for Darja) when appropriate
- Avoid excessive technical jargon
- Always include practical next steps
- If user asks in Darja/Arabic, respond in the same language`;

/**
 * Generate chatbot response using Hugging Face API
 * @param {string} userMessage - User's message
 * @param {object} context - Full context object
 * @returns {Promise<string>} - Bot response
 */
export async function generateResponse(userMessage, context = {}) {
    try {
        const {
            userContext = {},
            conversationHistory = [],
            searchResults = null,
            intent = 'general_inquiry'
        } = context;

        // Build the prompt
        const prompt = buildPrompt(userMessage, userContext, searchResults, intent);

        // Prepare conversation history
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory.map(msg => ({
                role: msg.sender_type === 'user' ? 'user' : 'assistant',
                content: msg.message_text
            })),
            { role: "user", content: prompt }
        ];

        // Call Hugging Face Chat Completion API
        const startTime = Date.now();

        const response = await hf.chatCompletion({
            model: "mistralai/Mistral-7B-Instruct-v0.3",
            messages: messages,
            max_tokens: 500,
            temperature: 0.7,
            top_p: 0.95
        });

        const responseTime = Date.now() - startTime;
        const botResponse = response.choices[0].message.content;

        // Extract token usage if available
        const tokensUsed = response.usage?.total_tokens || estimateTokens(messages);

        return {
            text: botResponse.trim(),
            responseTime,
            tokensUsed
        };

    } catch (error) {
        console.error('Error generating response:', error);

        // Fallback response
        return {
            text: "عذراً، حدث خطأ (Sorry, an error occurred). يرجى المحاولة مرة أخرى (Please try again).",
            responseTime: 0,
            tokensUsed: 0,
            error: error.message
        };
    }
}

/**
 * Build the complete prompt with context
 * @param {string} userMessage - User's message
 * @param {object} userContext - User context data
 * @param {object} searchResults - Web search results
 * @param {string} intent - Classified intent
 * @returns {string} - Complete prompt
 */
function buildPrompt(userMessage, userContext, searchResults, intent) {
    let prompt = "";

    // Add user context summary
    if (userContext && userContext.totalPredictions > 0) {
        prompt += "**Farmer's Context:**\n";
        prompt += formatUserContext(userContext);
        prompt += "\n\n";
    }

    // Add web search results if available
    if (searchResults && searchResults.results && searchResults.results.length > 0) {
        prompt += "**Recent Information from Web Search:**\n";
        searchResults.results.slice(0, 3).forEach((result, idx) => {
            prompt += `${idx + 1}. ${result.title}\n`;
            prompt += `   ${result.snippet || result.content}\n`;
            prompt += `   Source: ${result.url}\n`;
        });
        prompt += "\n";
    }

    // Add the user's question
    prompt += `**Farmer's Question (Intent: ${intent}):**\n`;
    prompt += userMessage;

    return prompt;
}

/**
 * Format user context for prompt
 * @param {object} context - User context
 * @returns {string} - Formatted context
 */
function formatUserContext(context) {
    const { soilProfile, cropHistory, userRegion, preferred_season } = context;

    let summary = `Location: ${userRegion || 'Algeria'}\n`;

    if (preferred_season) {
        summary += `Preferred Season: ${preferred_season}\n`;
    }

    if (soilProfile && Object.keys(soilProfile).length > 0) {
        summary += `Soil: N=${soilProfile.avg_nitrogen?.toFixed(0) || '?'}, `;
        summary += `P=${soilProfile.avg_phosphorus?.toFixed(0) || '?'}, `;
        summary += `K=${soilProfile.avg_potassium?.toFixed(0) || '?'}, `;
        summary += `pH=${soilProfile.avg_ph?.toFixed(1) || '?'}\n`;
    }

    if (cropHistory && cropHistory.length > 0) {
        const recentCrops = cropHistory.slice(0, 3);
        summary += `Recent Crops: ${recentCrops.map(c =>
            `${c.crop} (${c.yield} ${c.unit})`
        ).join(', ')}\n`;
    }

    return summary;
}

/**
 * Estimate token count for messages
 * @param {Array} messages - Chat messages
 * @returns {number} - Estimated tokens
 */
function estimateTokens(messages) {
    const text = messages.map(m => m.content || '').join(' ');
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

/**
 * Summarize conversation history if too long
 * @param {Array} messages - Message array
 * @param {number} maxTokens - Maximum tokens allowed
 * @returns {Promise<Array>} - Summarized messages
 */
export async function summarizeIfNeeded(messages, maxTokens = 6000) {
    const totalTokens = estimateTokens(messages);

    if (totalTokens <= maxTokens) {
        return messages;
    }

    // Keep recent 5 messages, summarize the rest
    const recentMessages = messages.slice(-5);
    const oldMessages = messages.slice(0, -5);

    if (oldMessages.length === 0) {
        return recentMessages;
    }

    try {
        const textToSummarize = oldMessages
            .map(m => `${m.sender_type}: ${m.message_text}`)
            .join('\n');

        const summary = await hf.summarization({
            model: "facebook/bart-large-cnn",
            inputs: textToSummarize,
            parameters: {
                max_length: 130,
                min_length: 30
            }
        });

        return [
            {
                sender_type: 'system',
                message_text: `Previous conversation summary: ${summary.summary_text}`
            },
            ...recentMessages
        ];

    } catch (error) {
        console.error('Summarization error:', error);
        // Fallback: just return recent messages
        return recentMessages;
    }
}

export default {
    generateResponse,
    summarizeIfNeeded,
    SYSTEM_PROMPT
};
