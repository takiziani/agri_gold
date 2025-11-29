import { Prediction, Field } from '../sequelize/relation.js';
import { normalizeSoilMetrics } from './contextBuilder.js';

const INPUT_FIELDS = [
    'id',
    'user_id',
    'field_id',
    'field_name',
    'best_crop',
    'predicted_yield',
    'unit',
    'nitrogen',
    'phosphorus',
    'potassium',
    'temperature',
    'humidity',
    'ph',
    'rainfall',
    'state',
    'season',
    'aiExplain',
    'created_at'
];

const NUMERIC_FIELDS = [
    'nitrogen',
    'phosphorus',
    'potassium',
    'temperature',
    'humidity',
    'ph',
    'rainfall',
    'predicted_yield'
];

export async function fetchPredictHistoryInputs() {
    const predictions = await Prediction.findAll({
        include: [{ model: Field, attributes: ['id_field', 'name'] }],
        order: [
            ['id_user', 'ASC'],
            ['prediction_date', 'ASC']
        ]
    });

    return predictions.map(mapPredictionToRow);
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    return /[",\n]/.test(stringValue)
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
}

export function buildCsvFromInputs(rows) {
    const header = INPUT_FIELDS.join(',');
    const data = rows.map(row => INPUT_FIELDS.map(field => escapeCsvValue(row[field])).join(','));
    return [header, ...data].join('\n');
}

function computeNumericStats(rows, field) {
    const values = rows
        .map(row => typeof row[field] === 'number' ? row[field] : Number(row[field]))
        .filter(value => typeof value === 'number' && !Number.isNaN(value));

    if (!values.length) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        average: total / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
    };
}

function countByField(rows, field) {
    const counts = new Map();
    rows.forEach(row => {
        const key = row[field] || 'Unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
}

export function buildReportContext(rows) {
    const metadata = {
        totalRecords: rows.length,
        uniqueUsers: new Set(rows.map(row => row.user_id)).size,
        stateBreakdown: countByField(rows, 'state').slice(0, 5),
        seasonBreakdown: countByField(rows, 'season').slice(0, 5),
        dateRange: { start: null, end: null }
    };

    const timestamps = rows
        .map(row => row.created_at ? new Date(row.created_at) : null)
        .filter(date => date instanceof Date && !Number.isNaN(date));

    if (timestamps.length) {
        timestamps.sort((a, b) => a - b);
        metadata.dateRange.start = timestamps[0].toISOString();
        metadata.dateRange.end = timestamps[timestamps.length - 1].toISOString();
    }

    const stats = {};
    NUMERIC_FIELDS.forEach(field => {
        const summary = computeNumericStats(rows, field);
        if (summary) {
            stats[field] = summary;
        }
    });

    const recentRows = getRecentRows(rows, 5);
    const samples = recentRows;

    return {
        metadata,
        stats,
        samples,
        narratives: recentRows.map(row => ({
            field_name: row.field_name,
            best_crop: row.best_crop,
            aiExplain: row.aiExplain,
            created_at: row.created_at
        }))
    };
}

function mapPredictionToRow(prediction) {
    const primary = extractPrimaryCrop(prediction.bestCrops);
    const soilMetrics = normalizeSoilMetrics(prediction.soil) || {};

    return {
        id: prediction.id_prediction,
        user_id: prediction.id_user,
        field_id: prediction.Field?.id_field,
        field_name: prediction.Field?.name,
        best_crop: primary?.name,
        predicted_yield: primary?.predictedYield,
        unit: primary?.unit,
        nitrogen: soilMetrics.nitrogen,
        phosphorus: soilMetrics.phosphorus,
        potassium: soilMetrics.potassium,
        temperature: soilMetrics.temperature,
        humidity: soilMetrics.humidity,
        ph: soilMetrics.ph,
        rainfall: soilMetrics.rainfall,
        state: primary?.state || 'Unknown',
        season: primary?.season,
        aiExplain: prediction.aiExplain,
        created_at: prediction.prediction_date
    };
}

function extractPrimaryCrop(bestCrops = []) {
    if (!Array.isArray(bestCrops) || !bestCrops.length) {
        return null;
    }

    const crop = bestCrops[0] || {};
    const predictedYield = toNumber(crop.predicted_yield ?? crop.yield);
    return {
        name: crop.crop || crop.name || 'Unknown crop',
        predictedYield,
        unit: crop.unit || 'metric ton per hectare',
        state: crop.state || crop.region || null,
        season: crop.season || null
    };
}

function toNumber(value) {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getRecentRows(rows = [], limit = 5) {
    const datedRows = rows
        .filter(row => row && row.created_at)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (datedRows.length) {
        return datedRows.slice(-limit);
    }

    return rows.slice(-limit);
}

export default {
    fetchPredictHistoryInputs,
    buildCsvFromInputs,
    buildReportContext
};
