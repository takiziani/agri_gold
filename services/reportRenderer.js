import { Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TableCell, WidthType } from 'docx';
import PDFDocument from 'pdfkit';

export async function buildDocxReport(reportContext, aiSummary = {}) {
    const sections = buildDocxSections(reportContext, aiSummary);
    const doc = new Document({
        sections: [
            {
                children: sections
            }
        ]
    });

    return Packer.toBuffer(doc);
}

export function buildPdfReport(reportContext, aiSummary = {}) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).text('Predict History Intelligence Report', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12);
        renderPdfMetadata(doc, reportContext);
        doc.moveDown();

        renderPdfStats(doc, reportContext.stats);
        doc.moveDown();

        renderPdfAiSummary(doc, aiSummary);

        doc.moveDown();
        renderPdfNarratives(doc, reportContext.narratives);

        doc.moveDown();
        renderPdfSamples(doc, reportContext.samples);

        doc.end();
    });
}

function buildDocxSections(reportContext, aiSummary = {}) {
    const sections = [];

    sections.push(new Paragraph({
        text: 'Predict History Intelligence Report',
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 }
    }));

    sections.push(new Paragraph({
        text: `Total records: ${reportContext?.metadata?.totalRecords || 0}`,
        spacing: { after: 100 }
    }));
    sections.push(new Paragraph({
        text: `Unique farmers: ${reportContext?.metadata?.uniqueUsers || 0}`,
        spacing: { after: 100 }
    }));

    const dateRange = reportContext?.metadata?.dateRange;
    if (dateRange?.start && dateRange?.end) {
        sections.push(new Paragraph({
            text: `Coverage: ${formatDate(dateRange.start)} → ${formatDate(dateRange.end)}`,
            spacing: { after: 200 }
        }));
    }

    sections.push(new Paragraph({
        text: 'Key Metrics',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
    }));

    const statsTable = buildStatsTable(reportContext.stats);
    if (statsTable) {
        sections.push(statsTable);
    }

    sections.push(new Paragraph({
        text: 'AI Highlights',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
    }));

    sections.push(...buildBulletParagraphs('Overview', [aiSummary.overview]));
    sections.push(...buildBulletParagraphs('Soil Findings', aiSummary.soilFindings));
    sections.push(...buildBulletParagraphs('Climate Signals', aiSummary.climateSignals));
    sections.push(...buildBulletParagraphs('Risk Alerts', aiSummary.riskAlerts));
    sections.push(...buildBulletParagraphs('Recommendations', aiSummary.recommendations));

    sections.push(new Paragraph({
        text: 'Sample Records',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
    }));

    const sampleTable = buildSamplesTable(reportContext.samples || []);
    if (sampleTable) {
        sections.push(sampleTable);
    }

    sections.push(new Paragraph({
        text: 'Field Narratives',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
    }));

    const narrativeParagraphs = buildNarrativeParagraphs(reportContext.narratives || []);
    sections.push(...narrativeParagraphs);

    return sections;
}

function buildStatsTable(stats = {}) {
    const entries = Object.entries(stats);
    if (!entries.length) {
        return null;
    }

    const rows = [
        new TableRow({
            children: ['Metric', 'Average', 'Min', 'Max'].map(text =>
                new TableCell({ children: [new Paragraph({ text, bold: true })] })
            )
        }),
        ...entries.map(([field, values]) => new TableRow({
            children: [
                formatFieldName(field),
                formatNumber(values.average),
                formatNumber(values.min),
                formatNumber(values.max)
            ].map(text => new TableCell({ children: [new Paragraph(text)] }))
        }))
    ];

    return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}

function buildSamplesTable(samples) {
    if (!samples.length) {
        return null;
    }

    const columns = ['field_name', 'best_crop', 'predicted_yield', 'unit', 'nitrogen', 'phosphorus', 'potassium', 'created_at'];

    const headerRow = new TableRow({
        children: columns.map(column =>
            new TableCell({ children: [new Paragraph({ text: formatFieldName(column), bold: true })] })
        )
    });

    const dataRows = samples.map(sample => new TableRow({
        children: columns.map(column =>
            new TableCell({ children: [new Paragraph(String(sample[column] ?? '—'))] })
        )
    }));

    return new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}

function buildBulletParagraphs(title, items = []) {
    const paragraphs = [];
    if (!items.length) {
        return [new Paragraph({ text: `${title}: n/a` })];
    }

    paragraphs.push(new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 50 }
    }));

    items.forEach(item => {
        paragraphs.push(new Paragraph({
            text: item,
            bullet: { level: 0 }
        }));
    });

    return paragraphs;
}

function buildNarrativeParagraphs(narratives = []) {
    if (!narratives.length) {
        return [new Paragraph({ text: 'No field narratives available.' })];
    }

    return narratives.map(narrative => new Paragraph({
        text: `${narrative.field_name || 'Unnamed field'} (${formatDate(narrative.created_at)}): ${narrative.best_crop || 'Unknown crop'} → ${narrative.aiExplain || 'No AI explanation.'}`,
        bullet: { level: 0 }
    }));
}

function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '—';
    }
    return Number(value).toFixed(2);
}

function formatFieldName(field) {
    return field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function renderPdfMetadata(doc, context) {
    const metadata = context.metadata || {};
    doc.text(`Total records: ${metadata.totalRecords || 0}`);
    doc.text(`Unique farmers: ${metadata.uniqueUsers || 0}`);
    if (metadata.dateRange?.start && metadata.dateRange?.end) {
        doc.text(`Coverage: ${formatDate(metadata.dateRange.start)} → ${formatDate(metadata.dateRange.end)}`);
    }

    doc.moveDown(0.5);

    if (metadata.stateBreakdown?.length) {
        doc.text('Top States:');
        metadata.stateBreakdown.forEach(entry => {
            doc.text(`• ${entry.value}: ${entry.count}`);
        });
    }

    if (metadata.seasonBreakdown?.length) {
        doc.moveDown(0.5);
        doc.text('Top Seasons:');
        metadata.seasonBreakdown.forEach(entry => {
            doc.text(`• ${entry.value}: ${entry.count}`);
        });
    }
}

function renderPdfStats(doc, stats = {}) {
    const entries = Object.entries(stats);
    if (!entries.length) {
        return;
    }

    doc.fontSize(14).text('Key Metrics', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);

    entries.forEach(([field, values]) => {
        doc.text(`${formatFieldName(field)}: Avg ${formatNumber(values.average)}, Min ${formatNumber(values.min)}, Max ${formatNumber(values.max)}`);
    });
}

function renderPdfAiSummary(doc, summary = {}) {
    doc.moveDown();
    doc.fontSize(14).text('AI Highlights', { underline: true });
    doc.fontSize(12);

    doc.moveDown(0.5);
    doc.text('Overview:');
    doc.text(summary.overview || 'No overview available.');

    renderPdfBulletSection(doc, 'Soil Findings', summary.soilFindings);
    renderPdfBulletSection(doc, 'Climate Signals', summary.climateSignals);
    renderPdfBulletSection(doc, 'Risk Alerts', summary.riskAlerts);
    renderPdfBulletSection(doc, 'Recommendations', summary.recommendations);
}

function renderPdfBulletSection(doc, title, items = []) {
    doc.moveDown(0.5);
    doc.text(`${title}:`);
    (items.length ? items : ['n/a']).forEach(item => {
        doc.text(`• ${item}`);
    });
}

function renderPdfNarratives(doc, narratives = []) {
    doc.fontSize(14).text('Field Narratives', { underline: true });
    doc.fontSize(12);

    if (!narratives || !narratives.length) {
        doc.text('No field narratives available.');
        return;
    }

    narratives.forEach(narrative => {
        doc.moveDown(0.2);
        doc.text(`• ${narrative.field_name || 'Unnamed field'} (${formatDate(narrative.created_at)}): ${narrative.best_crop || 'Unknown crop'}`);
        doc.text(`  ${narrative.aiExplain || 'No AI explanation provided.'}`);
    });
}

function renderPdfSamples(doc, samples = []) {
    doc.fontSize(14).text('Sample Records', { underline: true });
    doc.fontSize(12);

    if (!samples || !samples.length) {
        doc.text('No sample records available.');
        return;
    }

    samples.forEach(sample => {
        doc.moveDown(0.2);
        const header = `${sample.field_name || 'Field'} · ${sample.best_crop || 'Unknown crop'} · ${formatDate(sample.created_at)}`;
        doc.text(header);
        const metrics = [`Yield: ${formatNumber(sample.predicted_yield) || 'n/a'} ${sample.unit || ''}`.trim(),
            `N:${formatNumber(sample.nitrogen)}`,
            `P:${formatNumber(sample.phosphorus)}`,
            `K:${formatNumber(sample.potassium)}`
        ].join(' | ');
        doc.text(metrics);
    });
}

function formatDate(value) {
    if (!value) {
        return 'Unknown date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toISOString().split('T')[0];
}
