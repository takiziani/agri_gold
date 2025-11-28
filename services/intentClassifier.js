// Intent classification patterns and logic

const INTENT_PATTERNS = {
    price_inquiry: /\b(prix|price|combien|سعر|تمن|ثمن|شحال)\b/i,
    weather_query: /\b(météo|weather|pluie|rain|مطر|طقس|الجو)\b/i,
    crop_advice: /\b(planter|plant|cultiver|grow|زراعة|محصول|ندير|نزرع)\b/i,
    disease_help: /\b(maladie|disease|parasite|pest|مرض|آفة|حشرة)\b/i,
    yield_prediction: /\b(rendement|yield|production|إنتاج|محصول)\b/i,
    fertilizer_advice: /\b(engrais|fertilizer|azote|nitrogen|سماد)\b/i,
    irrigation: /\b(irrigation|water|arrosage|ري|ماء)\b/i
};

/**
 * Classify user intent from message text
 * @param {string} messageText - User's message
 * @returns {object} - { intent: string, confidence: number }
 */
export function classifyIntent(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        return { intent: 'general_inquiry', confidence: 0.0 };
    }

    const normalizedText = messageText.toLowerCase();
    const matches = [];

    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
        if (pattern.test(normalizedText)) {
            // Count keyword matches for confidence scoring
            const keywordMatches = (normalizedText.match(pattern) || []).length;
            matches.push({ intent, score: keywordMatches });
        }
    }

    if (matches.length === 0) {
        return { intent: 'general_inquiry', confidence: 0.5 };
    }

    // Sort by score and return highest
    matches.sort((a, b) => b.score - a.score);
    const topMatch = matches[0];

    // Confidence: 1.0 if single match, decreases with multiple matches
    const confidence = matches.length === 1 ? 1.0 : 0.7;

    return { intent: topMatch.intent, confidence };
}

/**
 * Determine if web search is required for this intent
 * @param {string} intent - Classified intent
 * @param {object} userContext - User's context data
 * @returns {boolean}
 */
export function shouldSearchWeb(intent, userContext = {}) {
    const SEARCH_REQUIRED_INTENTS = [
        'price_inquiry',      // Current market prices change daily
        'weather_query',      // Real-time data
        'disease_help'        // Recent outbreaks
    ];

    const SEARCH_OPTIONAL_INTENTS = [
        'crop_advice',        // Search if user history insufficient
        'yield_prediction',   // Search for regional benchmarks
        'fertilizer_advice'   // Search for best practices
    ];

    if (SEARCH_REQUIRED_INTENTS.includes(intent)) {
        return true;
    }

    if (SEARCH_OPTIONAL_INTENTS.includes(intent)) {
        // Search only if user has less than 3 predictions in history
        const totalPredictions = userContext.totalPredictions || 0;
        return totalPredictions < 3;
    }

    return false;
}

/**
 * Generate search query from user message and context
 * @param {string} userMessage - Original user message
 * @param {object} userContext - User context data
 * @returns {string} - Optimized search query
 */
export function generateSearchQuery(userMessage, userContext = {}) {
    const region = userContext.userRegion || 'Algeria';
    const season = userContext.preferred_season || '';

    // Extract key agricultural terms
    let query = userMessage;

    // Add regional context
    if (!query.toLowerCase().includes('algeria') && !query.toLowerCase().includes('الجزائر')) {
        query += ` ${region} Algeria`;
    }

    // Add temporal context for weather/prices
    if (query.match(/price|prix|سعر|تمن/i)) {
        query += ' current market price today';
    } else if (query.match(/weather|météo|طقس/i)) {
        query += ' forecast';
    }

    // Add season if relevant
    if (season && query.match(/plant|cultiver|زراعة/i)) {
        query += ` ${season} season`;
    }

    return query.trim();
}

export default {
    classifyIntent,
    shouldSearchWeb,
    generateSearchQuery,
    INTENT_PATTERNS
};
