import { PredictHistoryInput, PredictHistoryOutput, UserContextCache } from '../sequelize/relation.js';
import sequelize from '../sequelize/config.js';

/**
 * Build comprehensive user context for chatbot
 * @param {number} userId - User ID
 * @returns {Promise<object>} - User context object
 */
export async function buildUserContext(userId) {
    try {
        // 1. Check cache first
        const cachedContext = await UserContextCache.findOne({
            where: { user_id: userId }
        });

        // If cache is fresh (< 24 hours), return it
        if (cachedContext && isCacheFresh(cachedContext.last_updated)) {
            return {
                soilProfile: cachedContext.avg_soil_metrics || {},
                cropHistory: cachedContext.recent_crops || [],
                userRegion: cachedContext.preferred_region || 'Algeria',
                preferred_season: cachedContext.preferred_season,
                preferred_language: cachedContext.preferred_language || 'darja',
                uses_voice: cachedContext.uses_voice,
                totalPredictions: (cachedContext.recent_crops || []).length,
                cached: true
            };
        }

        // 2. Fetch fresh data from prediction history
        const recentPredictions = await sequelize.query(`
            SELECT 
                phi.nitrogen, phi.phosphorus, phi.potassium, phi.temperature,
                phi.humidity, phi.ph, phi.rainfall, phi.state, phi.season, phi.created_at,
                pho.best_crop, pho.predicted_yield, pho.unit, pho.region, 
                pho.total_revenue, pho.currency
            FROM predict_history_inputs phi
            JOIN predict_history_outputs pho ON pho.input_id = phi.id
            WHERE phi.user_id = :userId 
            AND phi.created_at > NOW() - INTERVAL '12 months'
            ORDER BY phi.created_at DESC
            LIMIT 10
        `, {
            replacements: { userId },
            type: sequelize.QueryTypes.SELECT
        });

        if (recentPredictions.length === 0) {
            return {
                soilProfile: {},
                cropHistory: [],
                userRegion: 'Algeria',
                totalPredictions: 0,
                cached: false
            };
        }

        // 3. Aggregate soil profile
        const soilProfile = {
            avg_nitrogen: avg(recentPredictions.map(p => p.nitrogen)),
            avg_phosphorus: avg(recentPredictions.map(p => p.phosphorus)),
            avg_potassium: avg(recentPredictions.map(p => p.potassium)),
            avg_ph: avg(recentPredictions.map(p => p.ph)),
            avg_rainfall: avg(recentPredictions.map(p => p.rainfall)),
            avg_temperature: avg(recentPredictions.map(p => p.temperature)),
            avg_humidity: avg(recentPredictions.map(p => p.humidity))
        };

        // 4. Recent crops performance
        const cropHistory = recentPredictions.map(p => ({
            crop: p.best_crop,
            yield: p.predicted_yield,
            unit: p.unit,
            revenue: p.total_revenue,
            currency: p.currency || 'DZD',
            region: p.region,
            date: p.created_at
        }));

        // 5. Extract preferences
        const common_state = mode(recentPredictions.map(p => p.state));
        const preferred_season = mode(recentPredictions.map(p => p.season));

        const context = {
            soilProfile,
            cropHistory,
            userRegion: common_state || 'Algeria',
            preferred_season,
            totalPredictions: recentPredictions.length,
            cached: false
        };

        // 6. Update cache asynchronously
        updateCacheAsync(userId, context).catch(err =>
            console.error('Cache update failed:', err)
        );

        return context;

    } catch (error) {
        console.error('Error building user context:', error);
        return {
            soilProfile: {},
            cropHistory: [],
            userRegion: 'Algeria',
            totalPredictions: 0,
            error: error.message
        };
    }
}

/**
 * Format user context for LLM prompt
 * @param {object} context - User context object
 * @returns {string} - Formatted context summary
 */
export function formatContextForPrompt(context) {
    if (!context || context.totalPredictions === 0) {
        return "This user is new and has no prediction history yet. Provide general agricultural advice.";
    }

    const { soilProfile, cropHistory, userRegion, preferred_season } = context;

    let summary = `**User Profile:**\n`;
    summary += `- Location: ${userRegion}\n`;

    if (preferred_season) {
        summary += `- Preferred Season: ${preferred_season}\n`;
    }

    if (Object.keys(soilProfile).length > 0) {
        summary += `\n**Soil Profile (Averages):**\n`;
        summary += `- Nitrogen: ${soilProfile.avg_nitrogen?.toFixed(1) || 'N/A'} ppm\n`;
        summary += `- Phosphorus: ${soilProfile.avg_phosphorus?.toFixed(1) || 'N/A'} ppm\n`;
        summary += `- Potassium: ${soilProfile.avg_potassium?.toFixed(1) || 'N/A'} ppm\n`;
        summary += `- pH: ${soilProfile.avg_ph?.toFixed(2) || 'N/A'}\n`;
        summary += `- Rainfall: ${soilProfile.avg_rainfall?.toFixed(0) || 'N/A'} mm\n`;
    }

    if (cropHistory.length > 0) {
        summary += `\n**Recent Crops (last ${cropHistory.length}):**\n`;
        cropHistory.slice(0, 5).forEach((crop, idx) => {
            summary += `${idx + 1}. ${crop.crop}: ${crop.yield} ${crop.unit}`;
            if (crop.revenue) {
                summary += ` (${crop.revenue.toLocaleString()} ${crop.currency})`;
            }
            summary += `\n`;
        });
    }

    return summary;
}

// Helper functions
function avg(numbers) {
    const validNumbers = numbers.filter(n => n != null && !isNaN(n));
    if (validNumbers.length === 0) return null;
    return validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
}

function mode(arr) {
    if (arr.length === 0) return null;
    const frequency = {};
    let maxFreq = 0;
    let modeValue = arr[0];

    arr.forEach(val => {
        if (val) {
            frequency[val] = (frequency[val] || 0) + 1;
            if (frequency[val] > maxFreq) {
                maxFreq = frequency[val];
                modeValue = val;
            }
        }
    });

    return modeValue;
}

function isCacheFresh(lastUpdated) {
    const CACHE_TTL_HOURS = 24;
    const now = new Date();
    const diff = now - new Date(lastUpdated);
    return diff < CACHE_TTL_HOURS * 60 * 60 * 1000;
}

async function updateCacheAsync(userId, context) {
    await UserContextCache.upsert({
        user_id: userId,
        recent_crops: context.cropHistory,
        avg_soil_metrics: context.soilProfile,
        preferred_region: context.userRegion,
        preferred_season: context.preferred_season,
        last_updated: new Date()
    });
}

export default {
    buildUserContext,
    formatContextForPrompt
};
