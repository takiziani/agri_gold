import { PredictHistoryInput } from '../sequelize/relation.js';

const INPUT_FIELDS = [
    'id',
    'user_id',
    'nitrogen',
    'phosphorus',
    'potassium',
    'temperature',
    'humidity',
    'ph',
    'rainfall',
    'state',
    'season',
    'crop_year',
    'annual_rainfall',
    'fertilizer',
    'pesticide',
    'area_hectares',
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
    'annual_rainfall',
    'area_hectares'
];

export async function fetchPredictHistoryInputs() {
    return PredictHistoryInput.findAll({
        order: [
            ['user_id', 'ASC'],
            ['created_at', 'ASC']
        ],
        raw: true
    });
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

    const samples = rows.slice(-5);

    return {
        metadata,
        stats,
        samples
    };
}

export default {
    fetchPredictHistoryInputs,
    buildCsvFromInputs,
    buildReportContext
};
