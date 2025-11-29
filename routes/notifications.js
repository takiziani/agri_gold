import express from 'express';
import verifyjwt from '../utils/jwt.js';
import { createNeighborNotifications, listNotifications, markNotificationRead } from '../services/notificationService.js';

const router = express.Router();

router.use(verifyjwt);

router.get('/notifications', async (req, res) => {
    try {
        const notifications = await listNotifications(req.userid);
        return res.json({ success: true, notifications });
    } catch (error) {
        console.error('List notifications error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load notifications' });
    }
});

router.patch('/notifications/:id/read', async (req, res) => {
    try {
        const marked = await markNotificationRead(req.userid, req.params.id);
        return res.json({ success: true, notification: marked });
    } catch (error) {
        const status = error.message === 'Notification not found' ? 404 : 500;
        return res.status(status).json({ success: false, error: error.message });
    }
});

router.post('/notifications/neighbor-alerts', async (req, res) => {
    try {
        const { prediction_id, field_id, radius_km } = req.body;
        const parsedPredictionId = Number(prediction_id);
        if (!Number.isFinite(parsedPredictionId)) {
            return res.status(400).json({ success: false, error: 'prediction_id must be numeric' });
        }
        const result = await createNeighborNotifications({
            predictionId: parsedPredictionId,
            fieldId: field_id ? Number(field_id) : undefined,
            radiusKm: radius_km ? Number(radius_km) : undefined
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Neighbor notification error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
});

export default router;
