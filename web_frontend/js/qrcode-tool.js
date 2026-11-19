/**
 * QR code generation with a centered logo.
 *
 * Uses `qrcode-generator` (the `qrcode` global, loaded via CDN in
 * admin.html) purely for the raw module matrix - the QR is then drawn onto
 * a canvas we fully control, so a white backdrop + the Aditya University
 * logo can be composited cleanly into the center. Error correction is
 * fixed at level H (~30% redundancy), which is what keeps the code
 * scannable even with a logo covering the middle.
 *
 * Nothing here is persisted to the database - the QR's payload is derived
 * on the fly from the main place + sub place names, not a stored code.
 */

// Loads an <img> and resolves once it's ready to be drawn onto a canvas.
function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

// qrcode-generator's own "auto type" mode (typeNumber 0) is unreliable in
// the minified CDN build - it can throw a bare "Cannot read properties of
// undefined (reading 'length')" instead of picking a size. So instead we
// try increasing type numbers ourselves until one is large enough to hold
// the text at error-correction level H, which is the standard workaround.
//
// We also start at type 6 (41x41 modules) rather than 1. A short place name
// would otherwise produce a tiny 25-33 module code, and the large centered
// logo would wipe out too big a share of it to scan reliably. A denser code
// keeps the same visual logo size while covering a smaller fraction of the
// data, so it still scans (tested down to 25% scale). Longer names simply
// move up to a larger type automatically.
const QR_MIN_TYPE = 6;

function makeQrCode(text) {
  let lastErr;
  for (let type = QR_MIN_TYPE; type <= 40; type++) {
    try {
      const qr = qrcode(type, 'H');
      qr.addData(text);
      qr.make();
      return qr;
    } catch (err) {
      lastErr = err; // too small for this type - try the next one
    }
  }
  throw lastErr || new Error('Could not generate a QR code for this text.');
}

/**
 * @param {string} text        Data to encode.
 * @param {HTMLImageElement} [logoImg]  Optional logo drawn centered on top.
 * @param {Object} [opts]
 * @param {number} [opts.targetSize=1000] Roughly how wide the canvas should be, in
 *   pixels - drives how crisp the QR (and the embedded logo) look once
 *   scaled into the on-screen preview or a printed PDF. Higher = sharper.
 * @param {number} [opts.marginCells=4] Quiet-zone width, in modules.
 * @param {number} [opts.logoRatio=0.32] Logo width as a fraction of the whole QR.
 * @returns {HTMLCanvasElement}
 */
function generateQrCanvas(text, logoImg, opts = {}) {
  const targetSize = opts.targetSize || 1000;
  const marginCells = opts.marginCells != null ? opts.marginCells : 4;
  const logoRatio = opts.logoRatio || 0.32;

  const qr = makeQrCode(text);
  const moduleCount = qr.getModuleCount();

  // Round to a whole number of pixels per module so module edges land on
  // exact pixel boundaries - a fractional cell size is what makes a QR
  // (and anything drawn on top of it) look soft/blurry. This also keeps
  // the canvas large (well beyond the ~220px preview size), so the logo
  // is drawn at high resolution and only ever scaled down, never up.
  const cellSize = Math.max(1, Math.round(targetSize / (moduleCount + marginCells * 2)));
  const margin = marginCells * cellSize;
  const size = moduleCount * cellSize + margin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Size of the logo, and the clear zone behind it. Dark modules whose
  // centre falls inside the clear zone are simply not drawn, which leaves
  // a clean blocky circle (whole modules removed, no half-covered cells)
  // around the logo - the look of the reference design, and also easier on
  // scanners than a smooth backdrop slicing through modules.
  const logoSize = logoImg ? size * logoRatio : 0;
  const clearR = logoImg ? logoSize / 2 + cellSize * 1.4 : 0;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#000000';
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!qr.isDark(row, col)) continue;
      const mx = margin + col * cellSize + cellSize / 2;
      const my = margin + row * cellSize + cellSize / 2;
      if (logoImg && Math.hypot(mx - cx, my - cy) < clearR) continue;
      ctx.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
    }
  }

  if (logoImg) {
    // High-quality downscaling for the logo specifically (the 1000+ px
    // source logo image is being shrunk - without this the browser can
    // default to a cheap/blurry resize).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
  }

  return canvas;
}

/**
 * Builds a one-page PDF matching the printed-QR-card look: a report-style
 * header (logo, title, coloured "Check Point", rule) at the top, then a
 * rounded black frame around the QR with the place name printed underneath.
 * The QR block is centered horizontally and vertically in the space below
 * the header.
 *
 * @param {Object} opts
 * @param {string} opts.dataUrl   PNG data URL from generateQrCanvas(...).toDataURL('image/png')
 * @param {string} opts.caption   Text printed below the QR (the sub place name).
 * @param {string} [opts.subCaption] Optional smaller line printed above the caption (the main place name).
 * @param {string} [opts.title]   Header title (default "Duty Place QR Code").
 * @param {string} opts.filename
 */
async function exportQrCodeToPdf({ dataUrl, caption, subCaption, title = 'Duty Place QR Code', filename }) {
  if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
    alert('The PDF export library did not load. Check your internet connection and try again.');
    return;
  }

  const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ---------- Header ----------
  const marginX = 40;
  const headerRuleY = 76;

  let logo = null;
  if (typeof loadPdfLogoDataUrl === 'function') logo = await loadPdfLogoDataUrl();
  if (logo) {
    const logoH = 30;
    doc.addImage(logo, 'PNG', marginX, 26, logoH * (900 / 117), logoH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(18, 33, 58);
  doc.setFontSize(18);
  doc.text(title, pageWidth - marginX, 42, { align: 'right' });

  // "Check Point" in the logo's two colours (orange + blue), right-aligned.
  doc.setFontSize(14);
  const cpX = pageWidth - marginX - doc.getTextWidth('Check Point');
  doc.setTextColor(244, 112, 37);
  doc.text('Check', cpX, 62);
  doc.setTextColor(3, 81, 155);
  doc.text('Point', cpX + doc.getTextWidth('Check '), 62);

  doc.setDrawColor(18, 33, 58);
  doc.setLineWidth(1.2);
  doc.line(marginX, headerRuleY, pageWidth - marginX, headerRuleY);

  // ---------- QR block, centered in the area below the header ----------
  const qrSize = 260;
  const framePad = 24;
  const frameR = 20;
  const frameSize = qrSize + framePad * 2;
  const captionGap = 44;          // frame bottom -> first text baseline
  const subCaptionStep = subCaption ? 26 : 0;
  const blockH = frameSize + captionGap + subCaptionStep;

  const areaTop = headerRuleY;
  const areaH = pageHeight - areaTop;
  // Center the QR frame itself in the area below the header, so the gap
  // between the header and the QR is balanced; the place names hang below it.
  const frameY = areaTop + (areaH - frameSize) / 2;
  const frameX = (pageWidth - frameSize) / 2;
  const qrX = frameX + framePad;
  const qrY = frameY + framePad;

  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(7);
  doc.roundedRect(frameX, frameY, frameSize, frameSize, frameR, frameR, 'S');

  doc.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  let textY = frameY + frameSize + captionGap;
  if (subCaption) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(15);
    doc.setTextColor(80, 80, 80);
    doc.text(subCaption, pageWidth / 2, textY, { align: 'center' });
    textY += 26;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(20, 20, 20);
  doc.text(caption, pageWidth / 2, textY, { align: 'center' });

  doc.save(filename);
}
