import express from 'express';
import {
    handleMessage,
    getUserSessions,
    getSessionHistory,
    closeSession,
    deleteSession
} from '../services/chatbotService.js';

const router = express.Router();

/**
 * POST /api/chatbot/message
 * Send a message to the chatbot
 */
router.post('/message', async (req, res) => {
    try {
        const {
            user_id,
            session_id = null,
            message,
            is_voice = false,
            audio_url = null,
            device_type = 'web',
            user_location = null
        } = req.body;

        // Validation
        if (!user_id || !message) {
            return res.status(400).json({
                success: false,
                error: 'user_id and message are required'
            });
        }

        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'message must be a non-empty string'
            });
        }

        // Process message
        const result = await handleMessage(user_id, message, {
            sessionId: session_id,
            isVoice: is_voice,
            audioUrl: audio_url,
            deviceType: device_type,
            userLocation: user_location
        });

        return res.json(result);

    } catch (error) {
        console.error('Message API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/chatbot/sessions/:userId
 * Get user's chat sessions
 */
router.get('/sessions/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const limit = parseInt(req.query.limit) || 20;

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const sessions = await getUserSessions(userId, limit);

        return res.json({
            success: true,
            sessions: sessions,
            count: sessions.length
        });

    } catch (error) {
        console.error('Sessions API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/chatbot/history/:sessionId
 * Get complete session history
 */
router.get('/history/:sessionId', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const userId = parseInt(req.query.user_id);

        if (isNaN(sessionId) || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID or user ID'
            });
        }

        const history = await getSessionHistory(sessionId, userId);

        return res.json({
            success: true,
            session: history
        });

    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('unauthorized')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        console.error('History API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * PUT /api/chatbot/session/:sessionId/close
 * Close a chat session
 */
router.put('/session/:sessionId/close', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const { user_id, summary = null } = req.body;

        if (isNaN(sessionId) || !user_id) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID or user ID'
            });
        }

        await closeSession(sessionId, user_id, summary);

        return res.json({
            success: true,
            message: 'Session closed successfully'
        });

    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('unauthorized')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        console.error('Close session API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * DELETE /api/chatbot/session/:sessionId
 * Delete a chat session (GDPR compliance)
 */
router.delete('/session/:sessionId', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const userId = parseInt(req.query.user_id);

        if (isNaN(sessionId) || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID or user ID'
            });
        }

        await deleteSession(sessionId, userId);

        return res.json({
            success: true,
            message: 'Session deleted successfully'
        });

    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('unauthorized')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        console.error('Delete session API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/chatbot/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'AgriBot Chatbot API',
        status: 'operational',
        timestamp: new Date().toISOString()
    });
});

export default router;
