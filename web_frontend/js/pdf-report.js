/**
 * Shared PDF report pieces used by the admin and guard pages:
 *   loadPdfLogoDataUrl()  - the university logo as a data URL (null if it can't load)
 *   drawPdfReportHeader() - logo, title, coloured "Check Point", rule and details rows
 *   drawPdfPageNumber()   - "Page N" at the bottom right
 * Needs jsPDF; loaded before export.js / admin.js / user.js.
 */
/**
 * Shared PDF report header: university logo (left), report title + coloured
 * "Check Point" (right), a rule, then two rows of label/value details.
 * Returns the Y position where the table should start.
 *
 * @param {jsPDF} doc
 * @param {Object} opts
 * @param {string} opts.title        e.g. "Security Information Report"
 * @param {string|null} opts.logo    data URL from loadPdfLogoDataUrl() (null = no logo)
 * @param {Array<Array<[string,string]>>} opts.details  rows of [label, value] pairs (max 4 per row)
 */
async function loadPdfLogoDataUrl() {
  try {
    const res = await fetch('images/aus_logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

function drawPdfReportHeader(doc, { title, logo, details }) {
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;

  if (logo) {
    const logoH = 11;
    doc.addImage(logo, 'PNG', marginX, 8, logoH * (1766 / 229), logoH);
  }

  doc.setTextColor(18, 33, 58);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(14);
  doc.text(title, pageW - marginX, 13, { align: 'right' });

  // "Check Point" in the logo's two colours (orange + blue), right-aligned.
  doc.setFontSize(12);
  const cpX = pageW - marginX - doc.getTextWidth('Check Point');
  doc.setTextColor(244, 112, 37);
  doc.text('Check', cpX, 19.5);
  doc.setTextColor(3, 81, 155);
  doc.text('Point', cpX + doc.getTextWidth('Check '), 19.5);
  doc.setFont(undefined, 'normal');

  doc.setDrawColor(18, 33, 58);
  doc.setLineWidth(0.5);
  doc.line(marginX, 22, pageW - marginX, 22);

  const colW = (pageW - marginX * 2) / 4;
  details.forEach((row, rIdx) => {
    row.forEach(([label, value], cIdx) => {
      const x = marginX + cIdx * colW;
      const y = 29 + rIdx * 7;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(90, 100, 120);
      doc.text(`${label}:`, x, y);
      const labelW = doc.getTextWidth(`${label}:`);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(18, 33, 58);
      doc.text(String(value), x + labelW + 2, y);
    });
  });
  doc.setTextColor(0, 0, 0);
  return 29 + (details.length - 1) * 7 + 9;
}

function drawPdfPageNumber(doc, pageNumber) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 150);
  doc.text(`Page ${pageNumber}`, pageW - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

