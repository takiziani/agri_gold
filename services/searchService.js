import crypto from 'crypto';
import { SearchCache } from '../sequelize/relation.js';

/**
 * Search the web using Tavily API (or fallback)
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} - Search results
 */
export async function searchWeb(query, options = {}) {
    const {
        context = 'agricultural',
        maxResults = 5,
        useCache = true
    } = options;

    try {
        // Check cache first
        if (useCache) {
            const cachedResults = await getCachedSearch(query);
            if (cachedResults) {
                return cachedResults;
            }
        }

        // Determine if Tavily API is available
        const useTavily = process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY !== '';

        let searchResults;
        if (useTavily) {
            searchResults = await searchWithTavily(query, context, maxResults);
        } else {
            // Fallback to mock results for development
            console.warn('TAVILY_API_KEY not set, using mock search results');
            searchResults = getMockSearchResults(query);
        }

        // Cache the results
        if (useCache && searchResults.results.length > 0) {
            await cacheSearchResults(query, searchResults);
        }

        return searchResults;

    } catch (error) {
        console.error('Search error:', error);
        return {
            results: [],
            error: error.message
        };
    }
}

/**
 * Search using Tavily AI API
 * @param {string} query - Search query
 * @param {string} context - Search context
 * @param {number} maxResults - Max results
 * @returns {Promise<object>} - Search results
 */
async function searchWithTavily(query, context, maxResults) {
    const url = 'https://api.tavily.com/search';

    const requestBody = {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        topic: context,
        max_results: maxResults,
        include_domains: [
            'agriculture.dz',
            'fao.org',
            'weather.com',
            'accuweather.com'
        ],
        include_answer: true
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();

    return {
        results: data.results || [],
        answer: data.answer || null,
        query: query
    };
}

/**
 * Get cached search results
 * @param {string} query - Search query
 * @returns {Promise<object|null>} - Cached results or null
 */
async function getCachedSearch(query) {
    const queryHash = hashQuery(query);

    const cached = await SearchCache.findOne({
        where: { query_hash: queryHash }
    });

    if (!cached) {
        return null;
    }

    // Check if expired
    if (new Date() > new Date(cached.expires_at)) {
        // Delete expired cache
        await cached.destroy();
        return null;
    }

    // Increment hit count
    await cached.update({ hit_count: cached.hit_count + 1 });

    return cached.search_results;
}

/**
 * Cache search results
 * @param {string} query - Search query
 * @param {object} results - Search results
 * @returns {Promise<void>}
 */
async function cacheSearchResults(query, results) {
    const queryHash = hashQuery(query);
    const ttl = determineTTL(query);
    const expiresAt = new Date(Date.now() + ttl);

    await SearchCache.upsert({
        query_hash: queryHash,
        original_query: query,
        search_results: results,
        created_at: new Date(),
        expires_at: expiresAt,
        hit_count: 0
    });
}

/**
 * Hash query for caching
 * @param {string} query - Search query
 * @returns {string} - MD5 hash
 */
function hashQuery(query) {
    const normalized = query.toLowerCase().trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Determine cache TTL based on query type
 * @param {string} query - Search query
 * @returns {number} - TTL in milliseconds
 */
function determineTTL(query) {
    const lowerQuery = query.toLowerCase();

    // Weather: 6 hours
    if (lowerQuery.match(/weather|météo|طقس|forecast/i)) {
        return 6 * 60 * 60 * 1000;
    }

    // Prices: 12 hours
    if (lowerQuery.match(/price|prix|سعر|market/i)) {
        return 12 * 60 * 60 * 1000;
    }

    // General agricultural info: 7 days
    return 7 * 24 * 60 * 60 * 1000;
}

/**
 * Mock search results for development/testing
 * @param {string} query - Search query
 * @returns {object} - Mock results
 */
function getMockSearchResults(query) {
    const mockResults = [
        {
            title: `Agricultural Information: ${query}`,
            url: 'https://example.com/agriculture',
            content: `This is a mock search result for: ${query}. In production, this would contain real web search results from Tavily API.`,
            snippet: 'Mock agricultural data for development purposes.',
            score: 0.95
        },
        {
            title: 'Algeria Ministry of Agriculture',
            url: 'https://agriculture.dz',
            content: 'Official agricultural guidance and resources for Algerian farmers.',
            snippet: 'Government agricultural resources and best practices.',
            score: 0.88
        },
        {
            title: 'FAO - Algeria Country Profile',
            url: 'https://fao.org/algeria',
            content: 'Food and Agriculture Organization resources for Algeria.',
            snippet: 'International agricultural standards and recommendations.',
            score: 0.82
        }
    ];

    return {
        results: mockResults,
        answer: `Based on available information about "${query}", here are relevant agricultural insights.`,
        query: query,
        mock: true
    };
}

/**
 * Clean up expired cache entries
 * @returns {Promise<number>} - Number of deleted entries
 */
export async function cleanExpiredCache() {
    const result = await SearchCache.destroy({
        where: {
            expires_at: {
                [sequelize.Sequelize.Op.lt]: new Date()
            }
        }
    });

    console.log(`Cleaned ${result} expired cache entries`);
    return result;
}

export default {
    searchWeb,
    cleanExpiredCache
};
