import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);
const HF_MODEL_ID = process.env.HUGGING_FACE_MODEL_ID || 'google/gemma-2-9b-it';

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
- Always include practical next steps`;

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
        const languageCode = detectLanguage(userMessage, userContext.preferred_language);
        const systemContent = buildSystemMessage({
            basePrompt: SYSTEM_PROMPT,
            languageCode,
            historyDigest: userContext.historyDigest
        });

        const messages = [
            { role: "system", content: systemContent },
            ...conversationHistory.map(msg => ({
                role: msg.sender_type === 'user' ? 'user' : 'assistant',
                content: msg.message_text
            })),
            { role: "user", content: prompt }
        ];

        // Call Hugging Face chat completion API
        const startTime = Date.now();

        const response = await hf.chatCompletion({
            model: HF_MODEL_ID,
            messages,
            max_tokens: 500,
            temperature: 0.7,
            top_p: 0.95
        });

        const responseTime = Date.now() - startTime;
        const botResponse = response.choices[0].message.content.trim();

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

export async function generateDatasetReportSummary(reportContext) {
    const systemPrompt = `You are AgriBot's insights analyst. Produce concise, structured findings for agronomy stakeholders.

Output MUST be valid JSON with this shape:
{
  "overview": "string",
  "soilFindings": ["bullet", "bullet"],
  "climateSignals": ["bullet"],
  "riskAlerts": ["bullet"],
  "recommendations": ["actionable step", "actionable step"]
}`;

    const userPrompt = `Here is aggregated data from predict_history_inputs.
Use it to craft a strategic report. Focus on material trends, not raw dumps.

${JSON.stringify(reportContext, null, 2)}`;

    try {
        const response = await hf.chatCompletion({
            model: HF_MODEL_ID,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 800,
            temperature: 0.4
        });

        const content = response.choices?.[0]?.message?.content || '';
        const parsed = safeJsonFromString(content);
        return normalizeReportSummary(parsed);
    } catch (error) {
        console.error('Report summary generation failed:', error);
        return normalizeReportSummary();
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

function buildSystemMessage({ basePrompt, languageCode, historyDigest }) {
    const sections = [basePrompt];

    const languageInstruction = getLanguageInstruction(languageCode);
    if (languageInstruction) {
        sections.push(languageInstruction);
    }

    if (historyDigest) {
        sections.push(`Farmer History Snapshot:\n${historyDigest}`);
    }

    sections.push('Never mix languages within a single reply unless the farmer explicitly does so.');

    return sections.join('\n\n');
}

function detectLanguage(message = '', fallback = 'darja') {
    if (!message || typeof message !== 'string') {
        return fallback || 'darja';
    }

    if (/[\u0600-\u06FF]/.test(message)) {
        return 'arabic';
    }

    if (/[àâçéèêëîïôûùüÿñæœ]/i.test(message) || /(bonjour|prix|météo|pluie|sol)/i.test(message)) {
        return 'french';
    }

    if (/[a-z]/i.test(message)) {
        return 'english';
    }

    return fallback || 'darja';
}

function getLanguageInstruction(code) {
    switch (code) {
        case 'arabic':
            return 'Detected farmer language: Algerian Darja/Arabic. Reply entirely in Darja/Arabic (use informal tone such as "rak") unless the farmer switches languages.';
        case 'french':
            return 'Detected farmer language: French. Respond fully in French with farmer-friendly vocabulary.';
        case 'english':
            return 'Detected farmer language: English. Respond concisely in English, keep references localized to Algeria, and always use metric units.';
        default:
            return 'Match the farmer\'s language in every reply. If unsure, default to Algerian Darja.';
    }
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
    SYSTEM_PROMPT,
    generateDatasetReportSummary
};

function safeJsonFromString(text) {
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (err) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (inner) {
                return null;
            }
        }
        return null;
    }
}

function normalizeReportSummary(data = {}) {
    return {
        overview: data.overview || 'No AI overview available.',
        soilFindings: Array.isArray(data.soilFindings) && data.soilFindings.length ? data.soilFindings : ['Insufficient soil findings provided.'],
        climateSignals: Array.isArray(data.climateSignals) && data.climateSignals.length ? data.climateSignals : ['No climate signals detected.'],
        riskAlerts: Array.isArray(data.riskAlerts) && data.riskAlerts.length ? data.riskAlerts : ['No critical risks highlighted.'],
        recommendations: Array.isArray(data.recommendations) && data.recommendations.length ? data.recommendations : ['Collect more data to unlock tailored recommendations.']
    };
}
