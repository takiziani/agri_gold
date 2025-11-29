import { Prediction, Field } from '../sequelize/relation.js';

const PLACEHOLDER_EXPLANATION = 'Awaiting AI analysis';

function toFloat(value, fallback = null) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toInt(value, fallback = null) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : fallback;
}

function requireNumber(label, value) {
    const parsed = toFloat(value);
    if (parsed === null) {
        throw new Error(`${label} is required and must be numeric`);
    }
    return parsed;
}

function parseRanking(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;
    const match = value.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

function deriveRegion(yieldPrediction = {}, cropRecommendation = {}) {
    return yieldPrediction.state || cropRecommendation.suitable_for || 'Unknown region';
}

function buildSoilSnapshot(payload) {
    return {
        nitrogen: requireNumber('Nitrogen', payload.Nitrogen),
        phosphorus: requireNumber('Phosphorus', payload.Phosphorus),
        potassium: requireNumber('Potassium', payload.Potassium),
        temperature: requireNumber('Temperature', payload.Temperature),
        humidity: requireNumber('Humidity', payload.Humidity),
        ph: requireNumber('Ph', payload.Ph ?? payload.pH),
        rainfall: requireNumber('Rainfall', payload.Rainfall),
        state: payload.state,
        season: payload.season,
        crop_year: toInt(payload.crop_year),
        annual_rainfall: toFloat(payload.annual_rainfall),
        fertilizer: toFloat(payload.fertilizer),
        pesticide: toFloat(payload.pesticide),
        area_hectares: toFloat(payload.area_hectares)
    };
}

function buildPredictionResults(analysisData = {}) {
    const yieldPrediction = analysisData.yield_prediction || {};
    const cropRecommendation = analysisData.crop_recommendation || {};
    const agricultural = analysisData.agricultural_parameters || {};
    const alternativeCrops = Array.isArray(analysisData.alternative_crops)
        ? analysisData.alternative_crops
        : [];

    const primary = normalizePrimaryCrop({
        yieldPrediction,
        cropRecommendation,
        agricultural,
        currency: analysisData.currency
    });

    const alternatives = alternativeCrops
        .map(crop => normalizeAlternativeCrop(crop, primary))
        .filter(Boolean);

    const bestCrops = [primary, ...alternatives].filter(Boolean);

    const soilUpdate = normalizeSoilParameters(analysisData.soil_parameters);
    const aiExplain = deriveAiExplain(analysisData, bestCrops);

    return {
        bestCrops,
        aiExplain,
        soilUpdate
    };
}

function normalizePrimaryCrop({ yieldPrediction = {}, cropRecommendation = {}, agricultural = {}, currency }) {
    const chosenCrop = yieldPrediction.crop || cropRecommendation.recommended_crop;
    if (!chosenCrop) {
        return null;
    }

    const predictedYield = toFloat(yieldPrediction.predicted_yield);
    if (predictedYield === null) {
        return null;
    }

    return {
        crop: chosenCrop,
        predicted_yield: predictedYield,
        unit: yieldPrediction.unit || 'metric ton per hectare',
        region: deriveRegion(yieldPrediction, cropRecommendation),
        ranking: parseRanking(cropRecommendation.ranking),
        state: yieldPrediction.state || null,
        season: yieldPrediction.season || null,
        price_per_ton: toFloat(cropRecommendation.price_per_ton),
        revenue: toFloat(agricultural.total_revenue),
        total_area_hectares: toFloat(agricultural.area_hectares),
        total_yield_tons: toFloat(agricultural.total_yield_tons),
        currency: currency || 'DZD'
    };
}

function normalizeAlternativeCrop(crop = {}, defaults = {}) {
    const name = crop.crop || crop.name || crop.recommended_crop;
    if (!name) return null;

    return {
        crop: name,
        predicted_yield: toFloat(crop.predicted_yield ?? crop.yield),
        unit: crop.unit || defaults.unit || 'metric ton per hectare',
        ranking: parseRanking(crop.ranking),
        price_per_ton: toFloat(crop.price_per_ton),
        revenue: toFloat(crop.revenue ?? crop.total_revenue ?? null),
        region: crop.region || defaults.region || null,
        state: crop.state || defaults.state || null,
        season: crop.season || defaults.season || null
    };
}

function deriveAiExplain(analysisData = {}, bestCrops = []) {
    if (analysisData.aiExplain) {
        return analysisData.aiExplain;
    }

    if (analysisData.summary) {
        return analysisData.summary;
    }

    const recommendation = analysisData.crop_recommendation?.recommendation_basis;
    const primaryCrop = bestCrops[0]?.crop;

    if (recommendation && primaryCrop) {
        return `${primaryCrop}: ${recommendation}`;
    }

    if (bestCrops.length) {
        return `AI analysis completed for ${bestCrops[0].crop}.`;
    }

    return PLACEHOLDER_EXPLANATION;
}

function normalizeSoilParameters(soilParameters) {
    if (!soilParameters) {
        return null;
    }

    if (Array.isArray(soilParameters)) {
        return soilParameters.reduce((acc, entry) => {
            const key = (entry?.name || entry?.parameter || '').toLowerCase();
            if (key) {
                acc[key] = extractNumericValue(entry?.value ?? entry?.mean ?? entry?.amount);
            }
            return acc;
        }, {});
    }

    if (typeof soilParameters === 'object') {
        const normalized = {};
        Object.entries(soilParameters).forEach(([key, value]) => {
            normalized[key] = extractNumericValue(value);
        });
        return normalized;
    }

    return null;
}

function extractNumericValue(value) {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === 'object') {
        return extractNumericValue(value.value ?? value.amount ?? value.mean ?? value.avg);
    }
    return null;
}

export async function createPredictInput(userId, payload) {
    if (!userId) {
        throw new Error('user_id is required');
    }
    if (!payload?.state || !payload?.season) {
        throw new Error('state and season are required');
    }

    const fieldId = toInt(payload.field_id);
    if (!fieldId) {
        throw new Error('field_id is required');
    }

    const field = await Field.findOne({ where: { id_field: fieldId, id_user: userId } });
    if (!field) {
        throw new Error('Field not found for user');
    }

    const soilSnapshot = buildSoilSnapshot(payload);

    const prediction = await Prediction.create({
        id_user: userId,
        id_field: field.id_field,
        prediction_date: payload.prediction_date ? new Date(payload.prediction_date) : new Date(),
        soil: soilSnapshot,
        bestCrops: [],
        aiExplain: PLACEHOLDER_EXPLANATION
    });

    return formatPredictionForLegacy(prediction);
}

export async function deletePredictInput(userId, inputId) {
    const deleted = await Prediction.destroy({
        where: { id_prediction: inputId, id_user: userId }
    });

    if (!deleted) {
        return { success: false, error: 'Prediction input not found' };
    }

    return { success: true };
}

export async function createPredictOutput(userId, inputId, analysisPayload) {
    if (!userId) {
        throw new Error('user_id is required');
    }

    const prediction = await Prediction.findOne({
        where: { id_prediction: inputId, id_user: userId }
    });

    if (!prediction) {
        throw new Error('Prediction input not found for user');
    }

    const { bestCrops, aiExplain, soilUpdate } = buildPredictionResults(analysisPayload);

    if (!bestCrops.length) {
        throw new Error('Analysis data must include at least one crop recommendation');
    }

    prediction.bestCrops = bestCrops;
    prediction.aiExplain = aiExplain;
    if (soilUpdate) {
        prediction.soil = { ...(prediction.soil || {}), ...soilUpdate };
    }
    prediction.prediction_date = new Date();

    await prediction.save();
    return formatPredictionForLegacy(prediction);
}

export async function deletePredictOutput(userId, outputId) {
    const prediction = await Prediction.findOne({
        where: { id_prediction: outputId, id_user: userId }
    });

    if (!prediction) {
        return { success: false, error: 'Prediction output not found' };
    }

    prediction.bestCrops = [];
    prediction.aiExplain = PLACEHOLDER_EXPLANATION;
    await prediction.save();

    return { success: true };
}

export default {
    createPredictInput,
    deletePredictInput,
    createPredictOutput,
    deletePredictOutput
};

function formatPredictionForLegacy(prediction) {
    const plain = prediction?.toJSON ? prediction.toJSON() : prediction;
    if (!plain) {
        return prediction;
    }
    return {
        ...plain,
        id: plain.id_prediction
    };
}
