import { Op } from 'sequelize';
import { Field, Notification, Prediction } from '../sequelize/relation.js';
import { calculateCentroid, buildBoundingBox, haversineDistanceKm } from '../utils/geo.js';

const DEFAULT_RADIUS_KM = 5;

export async function createNeighborNotifications({ predictionId, fieldId, radiusKm = DEFAULT_RADIUS_KM }) {
    if (!Number.isFinite(predictionId)) {
        throw new Error('predictionId is required');
    }
    const effectiveRadius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : DEFAULT_RADIUS_KM;

    const prediction = await Prediction.findByPk(predictionId, {
        include: [{ model: Field, attributes: ['id_field', 'name', 'latetude', 'longitude', 'id_user', 'area'] }]
    });

    if (!prediction) {
        throw new Error('Prediction not found');
    }

    const sourceField = prediction.Field || (fieldId ? await Field.findByPk(fieldId) : null);

    if (!sourceField) {
        throw new Error('Field not found for prediction');
    }

    const sourceCentroid = calculateCentroid(sourceField.latetude, sourceField.longitude);

    if (!sourceCentroid) {
        throw new Error('Invalid field coordinates');
    }

    const bbox = buildBoundingBox(sourceCentroid.latitude, sourceCentroid.longitude, effectiveRadius);

    const candidateFields = await Field.findAll({
        where: {
            id_field: { [Op.ne]: sourceField.id_field }
        },
        attributes: ['id_field', 'id_user', 'name', 'latetude', 'longitude']
    });

    const neighbors = candidateFields
        .map(field => ({
            field,
            centroid: calculateCentroid(field.latetude, field.longitude)
        }))
        .filter(item => item.centroid)
        .filter(item =>
            item.centroid.latitude >= bbox.minLat &&
            item.centroid.latitude <= bbox.maxLat &&
            item.centroid.longitude >= bbox.minLon &&
            item.centroid.longitude <= bbox.maxLon
        )
        .filter(item => haversineDistanceKm(sourceCentroid, item.centroid) <= effectiveRadius)
        .filter(item => item.field.id_user !== sourceField.id_user);

    if (!neighbors.length) {
        return { created: 0, neighbors: [] };
    }

    const cropSnapshot = extractPrimaryCrop(prediction.bestCrops);

    const records = neighbors.map(({ field, centroid }) => ({
        user_id: field.id_user,
        prediction_id: prediction.id_prediction,
        best_crop: cropSnapshot.name,
        predicted_yield: cropSnapshot.predictedYield,
        region: sourceField.name || 'Nearby field',
        prediction_created_at: prediction.prediction_date,
        notification_type: 'neighbor_prediction',
        title: `Nearby field recommends ${cropSnapshot.name}`,
        message: buildNotificationMessage({
            sourceFieldName: sourceField.name,
            cropSnapshot,
            distanceKm: haversineDistanceKm(sourceCentroid, centroid)
        })
    }));

    const created = await Notification.bulkCreate(records, { returning: true });
    return {
        created: created.length,
        neighbors: created.map(notification => notification.user_id)
    };
}

export async function listNotifications(userId) {
    return Notification.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
    });
}

export async function markNotificationRead(userId, notificationId) {
    const notification = await Notification.findOne({ where: { id: notificationId, user_id: userId } });

    if (!notification) {
        throw new Error('Notification not found');
    }

    notification.is_read = true;
    await notification.save();
    return notification;
}

function extractPrimaryCrop(bestCrops = []) {
    if (!Array.isArray(bestCrops) || !bestCrops.length) {
        return {
            name: 'Unknown crop',
            predictedYield: 0,
            unit: 'metric ton per hectare'
        };
    }

    const crop = bestCrops[0] || {};
    return {
        name: crop.crop || crop.name || 'Unknown crop',
        predictedYield: Number(crop.predicted_yield ?? crop.yield ?? 0) || 0,
        unit: crop.unit || 'metric ton per hectare'
    };
}

function buildNotificationMessage({ sourceFieldName, cropSnapshot, distanceKm }) {
    const distanceLabel = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(2)} km` : 'nearby';
    return `Field "${sourceFieldName}" forecasts ${cropSnapshot.predictedYield} ${cropSnapshot.unit} of ${cropSnapshot.name}. (${distanceLabel})`;
}

export default {
    createNeighborNotifications,
    listNotifications,
    markNotificationRead
};
