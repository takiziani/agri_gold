import { PredictHistoryInput, PredictHistoryOutput, UserContextCache, Prediction, Field } from '../sequelize/relation.js';
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
            const cachedHistory = cachedContext.recent_crops || [];
            const cachedDigest = buildHistoryDigest(cachedHistory, cachedContext.avg_soil_metrics || {});
            return {
                soilProfile: cachedContext.avg_soil_metrics || {},
                cropHistory: cachedContext.recent_crops || [],
                userRegion: cachedContext.preferred_region || 'Algeria',
                preferred_season: cachedContext.preferred_season,
                preferred_language: cachedContext.preferred_language || 'darja',
                uses_voice: cachedContext.uses_voice,
                totalPredictions: (cachedContext.recent_crops || []).length,
                historyDigest: cachedDigest,
                cached: true
            };
        }

        // 2. Fetch fresh data, preferring the predictions table
        let cropHistory = await fetchPredictionHistory(userId);

        if (!cropHistory.length) {
            cropHistory = await fetchLegacyPredictionHistory(userId);
        }

        if (!cropHistory.length) {
            return {
                soilProfile: {},
                cropHistory: [],
                userRegion: 'Algeria',
                totalPredictions: 0,
                cached: false,
                preferred_language: 'darja'
            };
        }

        const context = composeContextFromRecords(cropHistory);
        context.cached = false;
        context.preferred_language = context.preferred_language || 'darja';

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
            historyDigest: '',
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

function buildHistoryDigest(records = [], soilProfile = {}) {
    if (!records.length) {
        return '';
    }

    const latestRecords = records.slice(0, 3);
    const latestSection = latestRecords.map((rec, idx) => formatRecentRecord(rec, idx)).join('\n');

    const aggregateSection = buildAggregateSummary(records.slice(3));
    const soilLine = formatSoilSummary(soilProfile);

    return [
        latestSection ? `Recent Predictions:\n${latestSection}` : '',
        aggregateSection,
        soilLine
    ].filter(Boolean).join('\n\n');
}

function formatRecentRecord(rec, idx) {
    const date = formatDate(rec.date);
    const locale = rec.region || rec.state || 'Algeria';
    const yieldText = rec.yield != null ? `${round(rec.yield)} ${rec.unit || 't/ha'}` : 'n/a';
    const inputs = formatInputMetrics(rec.inputs);
    return `${idx + 1}. ${date} · ${locale} · ${rec.crop || 'Unknown'} → ${yieldText}${inputs ? ` | Inputs: ${inputs}` : ''}`;
}

function buildAggregateSummary(records = []) {
    if (!records.length) {
        return '';
    }

    const cropStats = records.reduce((acc, rec) => {
        if (!rec.crop) return acc;
        const key = rec.crop;
        if (!acc[key]) {
            acc[key] = { count: 0, totalYield: 0 };
        }
        acc[key].count += 1;
        if (typeof rec.yield === 'number') {
            acc[key].totalYield += rec.yield;
        }
        return acc;
    }, {});

    const topCrops = Object.entries(cropStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([crop, stat]) => {
            const avgYield = stat.count && stat.totalYield ? round(stat.totalYield / stat.count) : null;
            return `${crop}: ${avgYield ? `${avgYield}` : 'n/a'} (${stat.count} runs)`;
        })
        .join(', ');

    return topCrops ? `Historical Patterns: ${topCrops}` : '';
}

function formatSoilSummary(soilProfile = {}) {
    if (!soilProfile || Object.keys(soilProfile).length === 0) {
        return '';
    }

    const parts = [];
    if (soilProfile.avg_nitrogen) parts.push(`N=${round(soilProfile.avg_nitrogen)}`);
    if (soilProfile.avg_phosphorus) parts.push(`P=${round(soilProfile.avg_phosphorus)}`);
    if (soilProfile.avg_potassium) parts.push(`K=${round(soilProfile.avg_potassium)}`);
    if (soilProfile.avg_ph) parts.push(`pH=${soilProfile.avg_ph.toFixed(1)}`);
    if (soilProfile.avg_rainfall) parts.push(`Rain=${round(soilProfile.avg_rainfall)}mm`);

    return parts.length ? `Avg Soil: ${parts.join(', ')}` : '';
}

function formatInputMetrics(inputs = {}) {
    if (!inputs) return '';
    const parts = [];
    if (isFinite(inputs.nitrogen)) parts.push(`N${round(inputs.nitrogen)}`);
    if (isFinite(inputs.phosphorus)) parts.push(`P${round(inputs.phosphorus)}`);
    if (isFinite(inputs.potassium)) parts.push(`K${round(inputs.potassium)}`);
    if (isFinite(inputs.rainfall)) parts.push(`Rain ${round(inputs.rainfall)}mm`);
    if (isFinite(inputs.temperature)) parts.push(`${round(inputs.temperature)}°C`);
    if (isFinite(inputs.humidity)) parts.push(`${round(inputs.humidity)}%RH`);
    if (isFinite(inputs.area_hectares)) parts.push(`${inputs.area_hectares}ha`);
    return parts.join(', ');
}

function formatDate(value) {
    if (!value) return 'Unknown date';
    try {
        return new Date(value).toISOString().split('T')[0];
    } catch {
        return String(value);
    }
}

function round(value) {
    return Math.round(Number(value) * 10) / 10;
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
        preferred_language: context.preferred_language,
        last_updated: new Date()
    });
}

async function fetchPredictionHistory(userId) {
    const predictions = await Prediction.findAll({
        where: { id_user: userId },
        include: [{ model: Field, attributes: ['id_field', 'name'] }],
        order: [['prediction_date', 'DESC']],
        limit: 10
    });

    return predictions
        .map(mapPredictionToRecord)
        .filter(Boolean);
}

async function fetchLegacyPredictionHistory(userId) {
    const rows = await sequelize.query(`
        SELECT 
            phi.nitrogen, phi.phosphorus, phi.potassium, phi.temperature,
            phi.humidity, phi.ph, phi.rainfall, phi.state, phi.season, phi.created_at,
            phi.area_hectares, phi.fertilizer, phi.pesticide, phi.annual_rainfall, phi.crop_year,
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

    return rows.map(row => ({
        crop: row.best_crop,
        yield: row.predicted_yield,
        unit: row.unit,
        revenue: row.total_revenue,
        currency: row.currency || 'DZD',
        region: row.region,
        date: row.created_at,
        state: row.state,
        season: row.season,
        inputs: {
            nitrogen: row.nitrogen,
            phosphorus: row.phosphorus,
            potassium: row.potassium,
            temperature: row.temperature,
            humidity: row.humidity,
            ph: row.ph,
            rainfall: row.rainfall,
            annual_rainfall: row.annual_rainfall,
            fertilizer: row.fertilizer,
            pesticide: row.pesticide,
            area_hectares: row.area_hectares,
            crop_year: row.crop_year
        }
    }));
}

function mapPredictionToRecord(prediction) {
    if (!prediction) return null;

    const primaryCrop = extractPrimaryPredictionCrop(prediction.bestCrops);
    if (!primaryCrop) {
        return null;
    }

    const soilMetrics = normalizeSoilMetrics(prediction.soil);

    return {
        crop: primaryCrop.name,
        yield: primaryCrop.predictedYield,
        unit: primaryCrop.unit,
        revenue: primaryCrop.revenue,
        currency: primaryCrop.currency || 'DZD',
        region: primaryCrop.region || prediction.Field?.name || 'Nearby field',
        state: primaryCrop.state || null,
        season: primaryCrop.season || null,
        date: prediction.prediction_date,
        inputs: soilMetrics
    };
}

function extractPrimaryPredictionCrop(bestCrops = []) {
    if (!Array.isArray(bestCrops) || !bestCrops.length) {
        return null;
    }

    const crop = bestCrops[0] || {};
    const predictedYield = toNumber(crop.predicted_yield ?? crop.yield);
    return {
        name: crop.crop || crop.name || 'Unknown crop',
        predictedYield,
        unit: crop.unit || 'metric ton per hectare',
        revenue: toNumber(crop.total_revenue ?? crop.revenue ?? null),
        currency: crop.currency,
        region: crop.state || crop.region || null,
        state: crop.state || null,
        season: crop.season || null
    };
}

export function normalizeSoilMetrics(soil = {}) {
    const metrics = {
        nitrogen: null,
        phosphorus: null,
        potassium: null,
        temperature: null,
        humidity: null,
        ph: null,
        rainfall: null
    };

    const entries = soilToEntries(soil);

    metrics.nitrogen = pickMetric(entries, ['nitrogen', 'n']);
    metrics.phosphorus = pickMetric(entries, ['phosphorus', 'p']);
    metrics.potassium = pickMetric(entries, ['potassium', 'k']);
    metrics.ph = pickMetric(entries, ['ph']);
    metrics.rainfall = pickMetric(entries, ['rainfall', 'rain']);
    metrics.temperature = pickMetric(entries, ['temperature', 'temp']);
    metrics.humidity = pickMetric(entries, ['humidity']);

    return metrics;
}

function soilToEntries(soil) {
    if (!soil) return [];

    if (Array.isArray(soil)) {
        return soil.map(item => ({
            key: String(item?.name || item?.parameter || '').toLowerCase(),
            value: extractNumericValue(item?.value ?? item?.mean ?? item?.avg ?? item?.amount)
        }));
    }

    if (typeof soil === 'object') {
        return Object.entries(soil).map(([key, value]) => ({
            key: key.toLowerCase(),
            value: extractNumericValue(value)
        }));
    }

    return [];
}

function pickMetric(entries, aliases) {
    for (const alias of aliases) {
        const match = entries.find(entry => entry.key === alias || entry.key === alias.toLowerCase());
        if (match && match.value != null) {
            return match.value;
        }
    }
    return null;
}

function extractNumericValue(value) {
    if (value == null) return null;
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'object') {
        const candidate = value.value ?? value.amount ?? value.mean ?? value.avg;
        return extractNumericValue(candidate);
    }
    return null;
}

function composeContextFromRecords(records) {
    const soilProfile = computeSoilProfileFromRecords(records);
    const userRegion = mode(records.map(r => r.state || r.region));
    const preferredSeason = mode(records.map(r => r.season));
    const historyDigest = buildHistoryDigest(records, soilProfile);

    return {
        soilProfile,
        cropHistory: records,
        userRegion: userRegion || 'Algeria',
        preferred_season: preferredSeason,
        totalPredictions: records.length,
        historyDigest,
        preferred_language: 'darja'
    };
}

function computeSoilProfileFromRecords(records = []) {
    return {
        avg_nitrogen: avg(records.map(r => r.inputs?.nitrogen)),
        avg_phosphorus: avg(records.map(r => r.inputs?.phosphorus)),
        avg_potassium: avg(records.map(r => r.inputs?.potassium)),
        avg_ph: avg(records.map(r => r.inputs?.ph)),
        avg_rainfall: avg(records.map(r => r.inputs?.rainfall)),
        avg_temperature: avg(records.map(r => r.inputs?.temperature)),
        avg_humidity: avg(records.map(r => r.inputs?.humidity))
    };
}

function toNumber(value) {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export default {
    buildUserContext,
    formatContextForPrompt
};
