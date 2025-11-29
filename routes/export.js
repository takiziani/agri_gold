import express from 'express';
import { fetchPredictHistoryInputs, buildCsvFromInputs, buildReportContext } from '../services/exportService.js';
import { generateDatasetReportSummary } from '../services/aiService.js';
import { buildDocxReport, buildPdfReport } from '../services/reportRenderer.js';

const router = express.Router();

router.get('/json', async (req, res) => {
    try {
        const rows = await fetchPredictHistoryInputs();
        return res.json({ success: true, count: rows.length, rows });
    } catch (error) {
        console.error('Export JSON error:', error);
        return res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

router.get('/csv', async (req, res) => {
    try {
        const rows = await fetchPredictHistoryInputs();
        const csv = buildCsvFromInputs(rows);
        res.set('Content-Type', 'text/csv');
        res.set('Content-Disposition', 'attachment; filename="predictions.csv"');
        return res.send(csv);
    } catch (error) {
        console.error('Export CSV error:', error);
        return res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

router.get('/docx', async (req, res) => {
    try {
        const rows = await fetchPredictHistoryInputs();
        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'No records available for export' });
        }

        const reportContext = buildReportContext(rows);
        const aiSummary = await generateDatasetReportSummary(reportContext);
        const buffer = await buildDocxReport(reportContext, aiSummary);

        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.set('Content-Disposition', 'attachment; filename="predictions_report.docx"');
        return res.send(buffer);
    } catch (error) {
        console.error('Export DOCX error:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate DOCX report' });
    }
});

router.get('/pdf', async (req, res) => {
    try {
        const rows = await fetchPredictHistoryInputs();
        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'No records available for export' });
        }

        const reportContext = buildReportContext(rows);
        const aiSummary = await generateDatasetReportSummary(reportContext);
        const buffer = await buildPdfReport(reportContext, aiSummary);

        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', 'attachment; filename="predictions_report.pdf"');
        return res.send(buffer);
    } catch (error) {
        console.error('Export PDF error:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate PDF report' });
    }
});

export default router;
