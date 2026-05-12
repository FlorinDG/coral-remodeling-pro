const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create a realistic Belgian construction quotation PDF
const doc = new PDFDocument({ size: 'A4', margin: 50 });
const outputPath = path.join(__dirname, 'test-quotation.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// ── Header ──────────────────────────────────────────
doc.fontSize(20).font('Helvetica-Bold').text('OFFERTE', { align: 'right' });
doc.fontSize(10).font('Helvetica').text('Ref: OFF-2026-0042', { align: 'right' });
doc.text('Datum: 10/05/2026', { align: 'right' });
doc.moveDown(0.5);

// Vendor info
doc.fontSize(12).font('Helvetica-Bold').text('Van Pelt Renovaties BVBA');
doc.fontSize(9).font('Helvetica')
  .text('BTW: BE0456.789.012')
  .text('Industrieweg 23, 2800 Mechelen')
  .text('info@vanpelt-renovaties.be')
  .text('Tel: +32 15 12 34 56');

doc.moveDown(1);

// Customer
doc.fontSize(10).font('Helvetica-Bold').text('Klant:');
doc.fontSize(9).font('Helvetica')
  .text('Dhr. & Mevr. Janssens')
  .text('Kerkstraat 45, 2000 Antwerpen')
  .text('BTW: BE0123.456.789');

doc.moveDown(1);
doc.fontSize(10).font('Helvetica-Bold').text('Betreft: Totaalrenovatie woning Kerkstraat 45');
doc.moveDown(1);

// ── Section 1: Ruwbouw ──────────────────────────────
doc.fontSize(12).font('Helvetica-Bold').fillColor('#d35400').text('1. RUWBOUW');
doc.fillColor('#000000');
doc.moveDown(0.3);

const drawLine = (desc, qty, unit, price) => {
  const total = (qty * price).toFixed(2);
  doc.fontSize(9).font('Helvetica')
    .text(`  ${desc}`, 50, doc.y, { continued: false, width: 280 });
  const y = doc.y - 12;
  doc.text(`${qty}`, 340, y, { width: 40, align: 'right' });
  doc.text(unit, 385, y, { width: 30, align: 'center' });
  doc.text(`€${price.toFixed(2)}`, 420, y, { width: 60, align: 'right' });
  doc.text(`€${total}`, 485, y, { width: 70, align: 'right' });
};

// Table header
doc.fontSize(8).font('Helvetica-Bold')
  .text('Omschrijving', 50, doc.y, { width: 280 });
let hy = doc.y - 10;
doc.text('Hoeveelheid', 330, hy, { width: 50, align: 'right' });
doc.text('Eenheid', 385, hy, { width: 30, align: 'center' });
doc.text('Eenheidsprijs', 420, hy, { width: 60, align: 'right' });
doc.text('Totaal excl.', 485, hy, { width: 70, align: 'right' });
doc.moveDown(0.5);

// Draw a line
doc.moveTo(50, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.3);

drawLine('Afbraak bestaande keuken en sanitair', 1, 'forfait', 2500.00);
drawLine('Afvoer puin incl. container 10m³', 2, 'stk', 450.00);
drawLine('Metselwerk buitenmuur - snelbouwblokken 14cm', 45, 'm²', 68.50);
drawLine('Metselwerk binnenmuur - gipsblokken 10cm', 32, 'm²', 42.00);
drawLine('Lateien in gewapend beton (prefab)', 6, 'stk', 185.00);
drawLine('Betonvloer 12cm + wapening - inclusief pomp', 85, 'm²', 45.00);

doc.moveDown(1);

// ── Section 2: Elektriciteit ────────────────────────
doc.fontSize(12).font('Helvetica-Bold').fillColor('#d35400').text('2. ELEKTRICITEIT');
doc.fillColor('#000000');
doc.moveDown(0.3);
doc.moveTo(50, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.3);

drawLine('Nieuw verdeelbord 4 rijen - Hager', 1, 'stk', 1250.00);
drawLine('Bekabeling VMvKas 3G2.5 - per meter', 280, 'm', 3.80);
drawLine('Stopcontact dubbel - Niko Intense wit', 28, 'stk', 45.00);
drawLine('Schakelaar enkelvoudig - Niko Intense wit', 14, 'stk', 35.00);
drawLine('LED inbouwspot Philips 8W 3000K', 22, 'stk', 38.50);
drawLine('Aarding conform AREI - keuring inclusief', 1, 'forfait', 680.00);

doc.moveDown(1);

// ── Section 3: Sanitair ─────────────────────────────
doc.fontSize(12).font('Helvetica-Bold').fillColor('#d35400').text('3. SANITAIR');
doc.fillColor('#000000');
doc.moveDown(0.3);
doc.moveTo(50, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.3);

drawLine('Aanvoerleidingen koper 15mm', 35, 'm', 28.00);
drawLine('Afvoerleidingen PVC 40-110mm', 25, 'm', 22.50);
drawLine('Hangtoilet Grohe Essence keramiek wit', 1, 'stk', 485.00);
drawLine('Lavabo Villeroy & Boch Subway 2.0 - 60cm', 1, 'stk', 320.00);
drawLine('Regendouche Hansgrohe Raindance S 240 - incl.\nmengkraan en thermostatische regeling', 1, 'set', 890.00);
drawLine('Boiler Vaillant ecoTEC plus 25kW', 1, 'stk', 2450.00);

doc.moveDown(1);

// ── Section 4: Afwerking ────────────────────────────
doc.fontSize(12).font('Helvetica-Bold').fillColor('#d35400').text('4. AFWERKING');
doc.fillColor('#000000');
doc.moveDown(0.3);
doc.moveTo(50, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.3);

drawLine('Bepleistering muren - Knauf MP75', 180, 'm²', 18.50);
drawLine('Chape vloer - anhydrietvloer 6cm', 85, 'm²', 22.00);
drawLine('Tegels badkamer vloer 60x60 - incl. lijm', 12, 'm²', 75.00);
drawLine('Tegels badkamer wanden 30x60 - incl. lijm', 28, 'm²', 65.00);
drawLine('Schilderwerken muren en plafonds - 2 lagen', 320, 'm²', 12.50);
drawLine('Binnendeur massief eik met kader - RAL 9010', 5, 'stk', 680.00);

doc.moveDown(1.5);

// ── Totals ──────────────────────────────────────────
doc.moveTo(350, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.3);

const subtotal = 2500 + 900 + 3082.50 + 1344 + 1110 + 3825 + 1250 + 1064 + 1260 + 490 + 847 + 680 + 980 + 562.50 + 485 + 320 + 890 + 2450 + 3330 + 1870 + 900 + 1820 + 4000 + 3400;
const vat = subtotal * 0.06; // 6% renovation VAT
const total = subtotal + vat;

doc.fontSize(10).font('Helvetica')
  .text('Subtotaal excl. BTW:', 350, doc.y, { width: 135, align: 'right' })
  .text(`€${subtotal.toFixed(2)}`, 485, doc.y - 12, { width: 70, align: 'right' });

doc.text('BTW 6% (renovatie):', 350, doc.y, { width: 135, align: 'right' })
  .text(`€${vat.toFixed(2)}`, 485, doc.y - 12, { width: 70, align: 'right' });

doc.moveDown(0.3);
doc.moveTo(350, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.3);

doc.fontSize(12).font('Helvetica-Bold')
  .text('TOTAAL INCL. BTW:', 350, doc.y, { width: 135, align: 'right' })
  .text(`€${total.toFixed(2)}`, 485, doc.y - 14, { width: 70, align: 'right' });

doc.moveDown(2);

// Legal
doc.fontSize(7.5).font('Helvetica').fillColor('#999999')
  .text('Deze offerte is 30 dagen geldig. Alle prijzen zijn exclusief BTW tenzij anders vermeld. ' +
    'Na akkoord wordt een voorschot van 30% gevraagd. Betalingsvoorwaarden: 30 dagen na factuurdatum. ' +
    'Elke klacht dient schriftelijk gemeld te worden binnen de 8 dagen na uitvoering.',
    50, doc.y, { align: 'center', width: 505 });

doc.end();

stream.on('finish', () => {
  console.log(`✅ Test PDF generated: ${outputPath}`);
  console.log(`   Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
});
