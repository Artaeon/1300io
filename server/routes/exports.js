const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const prisma = require('../lib/prisma');
const logger = require('../logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { pdfLimiter } = require('../middleware/rateLimiters');
const { uploadDir } = require('../middleware/uploadHandler');
const { idParamSchema, validateParams } = require('../schemas');

const router = express.Router();

router.get('/:id/export/csv', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.validatedParams.id },
    include: {
      property: true,
      results: {
        include: {
          checklist_item: { include: { category: true } },
        },
      },
    },
  });

  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const escapeCSV = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    ['Kategorie', 'Pruefpunkt', 'Status', 'Kommentar', 'Foto-URL'].join(','),
  ];

  inspection.results.forEach(r => {
    const status = r.status === 'OK' ? 'OK' : r.status === 'DEFECT' ? 'Mangel' : 'N/A';
    rows.push([
      escapeCSV(r.checklist_item?.category?.name),
      escapeCSV(r.checklist_item?.text),
      status,
      escapeCSV(r.comment),
      escapeCSV(r.photo_url),
    ].join(','));
  });

  const csv = rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Pruefbericht-${inspection.id}.csv`);
  res.send('\uFEFF' + csv);
}));

router.get('/:id/pdf', authenticateToken, pdfLimiter, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.validatedParams.id },
    include: {
      property: true,
      results: {
        include: {
          checklist_item: {
            include: { category: true },
          },
        },
      },
    },
  });

  if (!inspection) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Pruefbericht - ${inspection.property.address}`,
      Author: inspection.inspector_name,
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Pruefbericht-${inspection.id}.pdf`);
  doc.pipe(res);

  doc.rect(0, 0, 595, 120).fill('#1e3a5f');

  doc.fillColor('white')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('SICHERHEITSBEGEHUNG', 50, 35, { align: 'center' });

  doc.fontSize(14)
    .font('Helvetica')
    .text('nach ONORM B 1300', 50, 65, { align: 'center' });

  doc.fontSize(10)
    .text(`Bericht #${inspection.id}`, 50, 90, { align: 'center' });

  doc.fillColor('black');
  const infoY = 140;

  doc.rect(50, infoY, 495, 80).stroke('#ddd');

  doc.fontSize(10).font('Helvetica-Bold').text('OBJEKTDATEN', 60, infoY + 10);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Adresse: ${inspection.property.address}`, 60, infoY + 28);
  doc.text(`Eigentuemer: ${inspection.property.owner_name}`, 60, infoY + 43);
  doc.text(`Einheiten: ${inspection.property.units_count}`, 60, infoY + 58);

  doc.fontSize(10).font('Helvetica-Bold').text('PRUEFUNG', 350, infoY + 10);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Datum: ${new Date(inspection.date).toLocaleDateString('de-AT')}`, 350, infoY + 28);
  doc.text(`Pruefer: ${inspection.inspector_name}`, 350, infoY + 43);
  doc.text(`Status: ${inspection.status === 'COMPLETED' ? 'Abgeschlossen' : 'Entwurf'}`, 350, infoY + 58);

  const okCount = inspection.results.filter(r => r.status === 'OK').length;
  const defectCount = inspection.results.filter(r => r.status === 'DEFECT').length;
  const naCount = inspection.results.filter(r => r.status === 'NOT_APPLICABLE').length;

  const statsY = 240;
  doc.fontSize(12).font('Helvetica-Bold').text('ZUSAMMENFASSUNG', 50, statsY);

  const boxWidth = 150;
  const boxHeight = 50;
  const boxY = statsY + 20;

  doc.rect(50, boxY, boxWidth, boxHeight).fill('#d4edda');
  doc.fillColor('#155724').fontSize(20).font('Helvetica-Bold').text(String(okCount), 50, boxY + 8, { width: boxWidth, align: 'center' });
  doc.fontSize(10).font('Helvetica').text('OK', 50, boxY + 32, { width: boxWidth, align: 'center' });

  doc.rect(220, boxY, boxWidth, boxHeight).fill('#f8d7da');
  doc.fillColor('#721c24').fontSize(20).font('Helvetica-Bold').text(String(defectCount), 220, boxY + 8, { width: boxWidth, align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Maengel', 220, boxY + 32, { width: boxWidth, align: 'center' });

  doc.rect(390, boxY, 155, boxHeight).fill('#e2e3e5');
  doc.fillColor('#383d41').fontSize(20).font('Helvetica-Bold').text(String(naCount), 390, boxY + 8, { width: 155, align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Nicht anwendbar', 390, boxY + 32, { width: 155, align: 'center' });

  doc.fillColor('black');
  let currentY = 340;

  const resultsByCategory = {};
  inspection.results.forEach(result => {
    if (result.checklist_item && result.checklist_item.category) {
      const catName = result.checklist_item.category.name;
      if (!resultsByCategory[catName]) {
        resultsByCategory[catName] = [];
      }
      resultsByCategory[catName].push(result);
    }
  });

  doc.fontSize(12).font('Helvetica-Bold').text('PRUEFERGEBNISSE', 50, currentY);
  currentY += 25;

  const drawTableHeader = (y) => {
    doc.rect(50, y, 495, 20).fill('#f0f0f0');
    doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
    doc.text('Pruefpunkt', 55, y + 5, { width: 350 });
    doc.text('Status', 420, y + 5, { width: 80 });
    return y + 20;
  };

  Object.entries(resultsByCategory).forEach(([categoryName, results]) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    doc.rect(50, currentY, 495, 22).fill('#1e3a5f');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text(categoryName.toUpperCase(), 55, currentY + 6);
    currentY += 22;

    currentY = drawTableHeader(currentY);

    results.forEach((result, index) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
        currentY = drawTableHeader(currentY);
      }

      const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
      doc.rect(50, currentY, 495, 18).fill(bgColor);

      doc.fillColor('black').fontSize(9).font('Helvetica');
      doc.text(result.checklist_item.text, 55, currentY + 4, { width: 350 });

      let statusText = result.status;
      let statusColor = '#333';
      if (result.status === 'OK') {
        statusText = 'OK';
        statusColor = '#155724';
      } else if (result.status === 'DEFECT') {
        statusText = 'Mangel';
        statusColor = '#721c24';
      } else {
        statusText = 'N/A';
        statusColor = '#6c757d';
      }

      doc.fillColor(statusColor).font('Helvetica-Bold')
        .text(statusText, 420, currentY + 4, { width: 80 });

      currentY += 18;
    });

    currentY += 10;
  });

  const defects = inspection.results.filter(r => r.status === 'DEFECT');

  if (defects.length > 0) {
    doc.addPage();

    doc.rect(0, 0, 595, 60).fill('#721c24');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('MAENGELBERICHT', 50, 20, { align: 'center' });
    doc.fontSize(12).font('Helvetica')
      .text(`${defects.length} Mangel/Maengel dokumentiert`, 50, 42, { align: 'center' });

    doc.fillColor('black');
    let defectY = 80;

    defects.forEach((defect, index) => {
      if (defectY > 650) {
        doc.addPage();
        defectY = 50;
      }

      doc.rect(50, defectY, 495, 5).fill('#721c24');
      defectY += 10;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#721c24')
        .text(`Mangel #${index + 1}`, 50, defectY);
      defectY += 18;

      doc.fontSize(10).font('Helvetica').fillColor('black')
        .text(`Kategorie: ${defect.checklist_item.category.name}`, 50, defectY);
      defectY += 15;

      doc.font('Helvetica-Bold').text(`Pruefpunkt: ${defect.checklist_item.text}`, 50, defectY);
      defectY += 18;

      if (defect.comment) {
        doc.font('Helvetica').text(`Anmerkung: ${defect.comment}`, 50, defectY, { width: 495 });
        defectY += doc.heightOfString(defect.comment, { width: 495 }) + 10;
      }

      // Photo -- only allow images from the uploads directory (path traversal protection)
      if (defect.photo_url) {
        const safePath = path.resolve(uploadDir, path.basename(defect.photo_url));
        if (safePath.startsWith(uploadDir) && fs.existsSync(safePath)) {
          try {
            if (defectY > 500) {
              doc.addPage();
              defectY = 50;
            }
            doc.image(safePath, 50, defectY, { width: 250 });
            defectY += 200;
            doc.fontSize(8).fillColor('#666')
              .text('Foto des Mangels', 50, defectY);
            defectY += 15;
          } catch (imgError) {
            logger.error('Error embedding image in PDF', { inspectionId: inspection.id, error: imgError.message, requestId: req.id });
            doc.fontSize(10).fillColor('#999')
              .text('[Bild konnte nicht geladen werden]', 50, defectY);
            defectY += 15;
          }
        }
      }

      doc.fillColor('black');
      defectY += 20;
    });
  }

  doc.addPage();

  doc.fontSize(14).font('Helvetica-Bold').text('UNTERSCHRIFTEN', 50, 50);
  doc.moveDown(2);

  doc.fontSize(10).font('Helvetica').text('Pruefer:', 50, 100);
  doc.moveTo(50, 160).lineTo(250, 160).stroke();
  doc.fontSize(9).text(inspection.inspector_name, 50, 165);
  doc.text('Datum: ' + new Date().toLocaleDateString('de-AT'), 50, 180);

  doc.text('Auftraggeber / Eigentuemer:', 300, 100);
  doc.moveTo(300, 160).lineTo(500, 160).stroke();
  doc.text('Name: _______________________', 300, 165);
  doc.text('Datum: _______________________', 300, 180);

  doc.fontSize(8).fillColor('#999')
    .text(`Generiert am ${new Date().toLocaleString('de-AT')} | 1300.io v1.0`, 50, 750, { align: 'center' });

  doc.end();
  logger.info('PDF report generated', { inspectionId: inspection.id, requestId: req.id });
}));

module.exports = router;
