import express from 'express';
import {
    createPredictInput,
    deletePredictInput,
    createPredictOutput,
    deletePredictOutput
} from '../services/historyService.js';

const router = express.Router();

router.post('/predict-inputs', async (req, res) => {
    try {
        const { user_id, ...payload } = req.body;

        if (!user_id) {
            return res.status(400).json({ success: false, error: 'user_id is required' });
        }

        if (!payload.field_id) {
            return res.status(400).json({ success: false, error: 'field_id is required' });
        }

        const record = await createPredictInput(user_id, payload);
        return res.status(201).json({ success: true, record });
    } catch (error) {
        console.error('Create predict input error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
});

router.delete('/predict-inputs/:inputId', async (req, res) => {
    try {
        const { user_id } = req.body;
        const inputId = parseInt(req.params.inputId, 10);

        if (!user_id || Number.isNaN(inputId)) {
            return res.status(400).json({ success: false, error: 'user_id and valid inputId are required' });
        }

        const result = await deletePredictInput(user_id, inputId);
        const status = result.success ? 200 : 404;
        return res.status(status).json(result);
    } catch (error) {
        console.error('Delete predict input error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
});

router.post('/predict-outputs', async (req, res) => {
    try {
        const { user_id, input_id, analysisData } = req.body;

        if (!user_id || !input_id || !analysisData) {
            return res.status(400).json({
                success: false,
                error: 'user_id, input_id and analysisData are required'
            });
        }

        const record = await createPredictOutput(user_id, input_id, analysisData);
        return res.status(201).json({ success: true, record });
    } catch (error) {
        console.error('Create predict output error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
});

router.delete('/predict-outputs/:outputId', async (req, res) => {
    try {
        const { user_id } = req.body;
        const outputId = parseInt(req.params.outputId, 10);

        if (!user_id || Number.isNaN(outputId)) {
            return res.status(400).json({ success: false, error: 'user_id and valid outputId are required' });
        }

        const result = await deletePredictOutput(user_id, outputId);
        const status = result.success ? 200 : 404;
        return res.status(status).json(result);
    } catch (error) {
        console.error('Delete predict output error:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
});

export default router;
