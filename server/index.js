const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir)); // Serve uploaded files

// Protect Uploads? Maybe not strictly for MVP, but good practice. For now, leave public to avoid complex client photo logic passing headers for images.

app.get('/', (req, res) => {
  res.send('PropSecure API is running');
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: error.message });
  }
});

// --- API ROUTES ---

// Middleware to check JWT (Optional for read, required for write? Let's protect writes)
const SECRET_KEY = process.env.JWT_SECRET || 'super-secret-key-123';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// 1. Properties - Include last inspection info
app.get('/api/properties', authenticateToken, async (req, res) => {
  const properties = await prisma.property.findMany({
    include: {
      inspections: {
        where: { status: 'COMPLETED' },
        orderBy: { ended_at: 'desc' },
        take: 1,
        select: {
          id: true,
          ended_at: true,
          inspector_name: true
        }
      }
    }
  });

  // Transform to include lastInspection info
  const propertiesWithStatus = properties.map(p => ({
    ...p,
    lastInspection: p.inspections[0] || null,
    inspections: undefined // Remove the array from response
  }));

  res.json(propertiesWithStatus);
});

app.post('/api/properties', authenticateToken, async (req, res) => {
  const { address, owner_name, units_count } = req.body;
  try {
    const property = await prisma.property.create({
      data: {
        address,
        owner_name,
        units_count: parseInt(units_count)
      }
    });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: 'Could not create property' });
  }
});

app.get('/api/properties/:id', authenticateToken, async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: parseInt(req.params.id) }
  });
  res.json(property);
});

// Inspection History - Last 10 completed inspections
app.get('/api/inspections/history', authenticateToken, async (req, res) => {
  try {
    const inspections = await prisma.inspection.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { ended_at: 'desc' },
      take: 10,
      include: {
        property: {
          select: { id: true, address: true }
        }
      }
    });
    res.json(inspections);
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

// 2. Checklist
app.get('/api/checklist/categories', authenticateToken, async (req, res) => {
  const categories = await prisma.checklistCategory.findMany({
    include: { items: true }
  });
  res.json(categories);
});

// 3. File Upload
app.post('/api/upload', authenticateToken, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  // Return public URL
  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({ url: publicUrl });
});

// 4. Submit Inspection Result
app.post('/api/inspections', authenticateToken, async (req, res) => {
  const { propertyId, inspectorName } = req.body;
  const inspection = await prisma.inspection.create({
    data: {
      property_id: parseInt(propertyId),
      inspector_name: inspectorName,
      status: 'DRAFT'
    }
  });
  res.json(inspection);
});

app.get('/api/inspections/:id', authenticateToken, async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { results: true }
  });
  res.json(inspection);
});

// Save single result
app.post('/api/inspections/:id/results', authenticateToken, async (req, res) => {
  const { checklistItemId, status, comment, photoUrl } = req.body;

  // Check if result already exists for this item
  const existingResult = await prisma.inspectionResult.findFirst({
    where: {
      inspection_id: parseInt(req.params.id),
      checklist_item_id: checklistItemId
    }
  });

  if (existingResult) {
    // Update existing
    const result = await prisma.inspectionResult.update({
      where: { id: existingResult.id },
      data: { status, comment, photo_url: photoUrl }
    });
    return res.json(result);
  }

  // Create new
  const result = await prisma.inspectionResult.create({
    data: {
      inspection_id: parseInt(req.params.id),
      checklist_item_id: checklistItemId,
      status,
      comment,
      photo_url: photoUrl
    }
  });
  res.json(result);
});

// Validate Inspection Completeness
app.get('/api/inspections/:id/validate', authenticateToken, async (req, res) => {
  try {
    const inspectionId = parseInt(req.params.id);

    // Get all checklist items
    const allItems = await prisma.checklistItem.findMany();

    // Get answered items for this inspection
    const answeredResults = await prisma.inspectionResult.findMany({
      where: { inspection_id: inspectionId }
    });

    const answeredItemIds = new Set(answeredResults.map(r => r.checklist_item_id));
    const skippedItems = allItems.filter(item => !answeredItemIds.has(item.id));

    const isComplete = skippedItems.length === 0;

    res.json({
      isComplete,
      totalItems: allItems.length,
      answeredCount: answeredResults.length,
      skippedCount: skippedItems.length,
      skippedItems: skippedItems.map(item => ({ id: item.id, text: item.text }))
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Complete Inspection - Add ended_at timestamp
app.post('/api/inspections/:id/complete', authenticateToken, async (req, res) => {
  try {
    const inspectionId = parseInt(req.params.id);

    // Update status to COMPLETED and set ended_at
    const inspection = await prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        status: 'COMPLETED',
        ended_at: new Date()
      },
      include: { property: true }
    });

    console.log(`[Inspection] Marked inspection #${inspectionId} as COMPLETED at ${inspection.ended_at}`);
    res.json(inspection);
  } catch (error) {
    console.error('Complete inspection error:', error);
    res.status(500).json({ error: 'Could not complete inspection' });
  }
});

// 5. PDF Report - Professional Layout
app.get('/api/inspections/:id/pdf', async (req, res) => {
  try {
    // Fetch inspection with ALL required relations
    const inspection = await prisma.inspection.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        property: true,
        results: {
          include: {
            checklist_item: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!inspection) {
      console.error(`[PDF] Inspection ${req.params.id} not found`);
      return res.status(404).json({ error: 'Inspection not found' });
    }

    console.log(`[PDF] Generating report for Inspection #${inspection.id}`);
    console.log(`[PDF] Found ${inspection.results.length} results`);

    // Create PDF with A4 size
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Prüfbericht - ${inspection.property.address}`,
        Author: inspection.inspector_name
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Pruefbericht-${inspection.id}.pdf`);
    doc.pipe(res);

    // ============ HEADER ============
    doc.rect(0, 0, 595, 120).fill('#1e3a5f');

    doc.fillColor('white')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('SICHERHEITSBEGEHUNG', 50, 35, { align: 'center' });

    doc.fontSize(14)
      .font('Helvetica')
      .text('nach ÖNORM B 1300', 50, 65, { align: 'center' });

    doc.fontSize(10)
      .text(`Bericht #${inspection.id}`, 50, 90, { align: 'center' });

    // ============ PROPERTY INFO BOX ============
    doc.fillColor('black');
    const infoY = 140;

    doc.rect(50, infoY, 495, 80).stroke('#ddd');

    doc.fontSize(10).font('Helvetica-Bold').text('OBJEKTDATEN', 60, infoY + 10);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Adresse: ${inspection.property.address}`, 60, infoY + 28);
    doc.text(`Eigentümer: ${inspection.property.owner_name}`, 60, infoY + 43);
    doc.text(`Einheiten: ${inspection.property.units_count}`, 60, infoY + 58);

    doc.fontSize(10).font('Helvetica-Bold').text('PRÜFUNG', 350, infoY + 10);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Datum: ${new Date(inspection.date).toLocaleDateString('de-AT')}`, 350, infoY + 28);
    doc.text(`Prüfer: ${inspection.inspector_name}`, 350, infoY + 43);
    doc.text(`Status: ${inspection.status === 'COMPLETED' ? 'Abgeschlossen' : 'Entwurf'}`, 350, infoY + 58);

    // ============ SUMMARY STATISTICS ============
    const okCount = inspection.results.filter(r => r.status === 'OK').length;
    const defectCount = inspection.results.filter(r => r.status === 'DEFECT').length;
    const naCount = inspection.results.filter(r => r.status === 'NOT_APPLICABLE').length;
    const totalAnswered = inspection.results.length;

    const statsY = 240;
    doc.fontSize(12).font('Helvetica-Bold').text('ZUSAMMENFASSUNG', 50, statsY);

    // Stats boxes
    const boxWidth = 150;
    const boxHeight = 50;
    const boxY = statsY + 20;

    // OK Box
    doc.rect(50, boxY, boxWidth, boxHeight).fill('#d4edda');
    doc.fillColor('#155724').fontSize(20).font('Helvetica-Bold').text(String(okCount), 50, boxY + 8, { width: boxWidth, align: 'center' });
    doc.fontSize(10).font('Helvetica').text('OK', 50, boxY + 32, { width: boxWidth, align: 'center' });

    // Defect Box
    doc.rect(220, boxY, boxWidth, boxHeight).fill('#f8d7da');
    doc.fillColor('#721c24').fontSize(20).font('Helvetica-Bold').text(String(defectCount), 220, boxY + 8, { width: boxWidth, align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Mängel', 220, boxY + 32, { width: boxWidth, align: 'center' });

    // N/A Box
    doc.rect(390, boxY, 155, boxHeight).fill('#e2e3e5');
    doc.fillColor('#383d41').fontSize(20).font('Helvetica-Bold').text(String(naCount), 390, boxY + 8, { width: 155, align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Nicht anwendbar', 390, boxY + 32, { width: 155, align: 'center' });

    // ============ RESULTS BY CATEGORY ============
    doc.fillColor('black');
    let currentY = 340;

    // Group results by category
    const resultsByCategory = {};
    inspection.results.forEach(result => {
      if (result.checklist_item && result.checklist_item.category) {
        const catName = result.checklist_item.category.name;
        if (!resultsByCategory[catName]) {
          resultsByCategory[catName] = [];
        }
        resultsByCategory[catName].push(result);
      } else {
        console.warn(`[PDF] Result ${result.id} missing checklist_item or category`);
      }
    });

    doc.fontSize(12).font('Helvetica-Bold').text('PRÜFERGEBNISSE', 50, currentY);
    currentY += 25;

    // Table Header
    const drawTableHeader = (y) => {
      doc.rect(50, y, 495, 20).fill('#f0f0f0');
      doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
      doc.text('Prüfpunkt', 55, y + 5, { width: 350 });
      doc.text('Status', 420, y + 5, { width: 80 });
      return y + 20;
    };

    Object.entries(resultsByCategory).forEach(([categoryName, results]) => {
      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      // Category Header
      doc.rect(50, currentY, 495, 22).fill('#1e3a5f');
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
        .text(categoryName.toUpperCase(), 55, currentY + 6);
      currentY += 22;

      // Table header
      currentY = drawTableHeader(currentY);

      // Results rows
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

        // Status with color
        let statusText = result.status;
        let statusColor = '#333';
        if (result.status === 'OK') {
          statusText = '✓ OK';
          statusColor = '#155724';
        } else if (result.status === 'DEFECT') {
          statusText = '✗ Mangel';
          statusColor = '#721c24';
        } else {
          statusText = '— N/A';
          statusColor = '#6c757d';
        }

        doc.fillColor(statusColor).font('Helvetica-Bold')
          .text(statusText, 420, currentY + 4, { width: 80 });

        currentY += 18;
      });

      currentY += 10;
    });

    // ============ DEFECTS DETAIL SECTION (Mängelbericht) ============
    const defects = inspection.results.filter(r => r.status === 'DEFECT');

    if (defects.length > 0) {
      doc.addPage();

      // Section Header
      doc.rect(0, 0, 595, 60).fill('#721c24');
      doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
        .text('MÄNGELBERICHT', 50, 20, { align: 'center' });
      doc.fontSize(12).font('Helvetica')
        .text(`${defects.length} Mangel/Mängel dokumentiert`, 50, 42, { align: 'center' });

      doc.fillColor('black');
      let defectY = 80;

      defects.forEach((defect, index) => {
        if (defectY > 650) {
          doc.addPage();
          defectY = 50;
        }

        // Defect box
        doc.rect(50, defectY, 495, 5).fill('#721c24');
        defectY += 10;

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#721c24')
          .text(`Mangel #${index + 1}`, 50, defectY);
        defectY += 18;

        doc.fontSize(10).font('Helvetica').fillColor('black')
          .text(`Kategorie: ${defect.checklist_item.category.name}`, 50, defectY);
        defectY += 15;

        doc.font('Helvetica-Bold').text(`Prüfpunkt: ${defect.checklist_item.text}`, 50, defectY);
        defectY += 18;

        if (defect.comment) {
          doc.font('Helvetica').text(`Anmerkung: ${defect.comment}`, 50, defectY, { width: 495 });
          defectY += doc.heightOfString(defect.comment, { width: 495 }) + 10;
        }

        // Photo
        if (defect.photo_url) {
          const imagePath = path.join(__dirname, defect.photo_url);
          console.log(`[PDF] Looking for image at: ${imagePath}`);

          if (fs.existsSync(imagePath)) {
            try {
              // Check if we need new page for image
              if (defectY > 500) {
                doc.addPage();
                defectY = 50;
              }
              doc.image(imagePath, 50, defectY, { width: 250 });
              defectY += 200;
              doc.fontSize(8).fillColor('#666')
                .text('Foto des Mangels', 50, defectY);
              defectY += 15;
            } catch (imgError) {
              console.error(`[PDF] Error embedding image: ${imgError.message}`);
              doc.fontSize(10).fillColor('#999')
                .text('[Bild konnte nicht geladen werden]', 50, defectY);
              defectY += 15;
            }
          } else {
            console.warn(`[PDF] Image file not found: ${imagePath}`);
            doc.fontSize(10).fillColor('#999')
              .text('[Bild fehlt]', 50, defectY);
            defectY += 15;
          }
        }

        doc.fillColor('black');
        defectY += 20;
      });
    }

    // ============ SIGNATURE SECTION ============
    doc.addPage();

    doc.fontSize(14).font('Helvetica-Bold').text('UNTERSCHRIFTEN', 50, 50);
    doc.moveDown(2);

    // Inspector signature
    doc.fontSize(10).font('Helvetica').text('Prüfer:', 50, 100);
    doc.moveTo(50, 160).lineTo(250, 160).stroke();
    doc.fontSize(9).text(inspection.inspector_name, 50, 165);
    doc.text('Datum: ' + new Date().toLocaleDateString('de-AT'), 50, 180);

    // Client signature
    doc.text('Auftraggeber / Eigentümer:', 300, 100);
    doc.moveTo(300, 160).lineTo(500, 160).stroke();
    doc.text('Name: _______________________', 300, 165);
    doc.text('Datum: _______________________', 300, 180);

    // Footer
    doc.fontSize(8).fillColor('#999')
      .text(`Generiert am ${new Date().toLocaleString('de-AT')} | PropSecure v1.0`, 50, 750, { align: 'center' });

    doc.end();
    console.log(`[PDF] Report generated successfully for Inspection #${inspection.id}`);

  } catch (error) {
    console.error('[PDF] Error generating report:', error);
    res.status(500).json({ error: 'Error generating PDF', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
