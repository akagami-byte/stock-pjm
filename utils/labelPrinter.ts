// utils/labelPrinter.ts
// Kalkulasi layout label & generator HTML template untuk cetak QR Code.
// Digunakan di halaman label/create.tsx → Preview step.

import QRCodeLib from 'qrcode'

// ═══════════════════════════════════════════════════
// Tipe
// ═══════════════════════════════════════════════════

export interface PaperSize {
  name: string          // contoh: 'A4'
  label: string         // contoh: 'A4 (210 × 297 mm)'
  widthMm: number
  heightMm: number
}

export interface LabelSize {
  name: string
  label: string
  widthMm: number
  heightMm: number
}

export interface LayoutConfig {
  paper: PaperSize
  label: LabelSize
  marginMm: number       // margin keliling kertas (default 10mm)
  columns: number
  rows: number
  labelsPerPage: number
  totalPages: number
  totalLabels: number
}

export interface BatchLabelItem {
  batchCode: string      // contoh: 'AA0001'
  batchIndex: number     // #1, #2, ...
  status: string         // 'DRAFT'
  productName: string    // '[ENG] Engsel Konsilet Biasa'
  sku: string            // 'HGP-00-C'
  barcodeUrl: string     // URL public S3
  qtyPerBatch: number    // 50
}

// ═══════════════════════════════════════════════════
// Paper Sizes (mm)
// ═══════════════════════════════════════════════════

export const PAPER_SIZES: PaperSize[] = [
  { name: 'A4',     label: 'A4 (210 × 297 mm)',     widthMm: 210, heightMm: 297 },
  { name: 'F4',     label: 'F4 (210 × 330 mm)',      widthMm: 210, heightMm: 330 },
  { name: 'Letter', label: 'Letter (216 × 279 mm)',   widthMm: 216, heightMm: 279 },
  { name: 'A5',     label: 'A5 (148 × 210 mm)',       widthMm: 148, heightMm: 210 },
]

// ═══════════════════════════════════════════════════
// Label Sizes (mm) — presets umum
// ═══════════════════════════════════════════════════

export const LABEL_SIZES: LabelSize[] = [
  { name: '40x40', label: '40 × 40 mm (kecil)',   widthMm: 40, heightMm: 40 },
  { name: '60x60', label: '60 × 60 mm (sedang)',   widthMm: 60, heightMm: 60 },
  { name: '80x80', label: '80 × 80 mm (besar)',    widthMm: 80, heightMm: 80 },
]

// ═══════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════

function mmToPx(mm: number, dpi: number = 96): number {
  // 1 inch = 25.4 mm, 1 inch = dpi pixels
  return Math.round((mm / 25.4) * dpi)
}

// ═══════════════════════════════════════════════════
// 1. Kalkulasi Layout
// ═══════════════════════════════════════════════════

/**
 * Hitung layout label: berapa kolom, baris, per halaman, total halaman.
 *
 * @param paperSize  Ukuran kertas (dari PAPER_SIZES)
 * @param labelSize  Ukuran label per pcs (dari LABEL_SIZES)
 * @param totalLabels Total jumlah label yang akan dicetak
 * @param marginMm   Margin keliling kertas (default 10mm)
 */
export function calculateLabelLayout(
  paperSize: PaperSize,
  labelSize: LabelSize,
  totalLabels: number,
  marginMm: number = 10,
): LayoutConfig {
  // Area efektif setelah margin
  const effectiveW = paperSize.widthMm - marginMm * 2
  const effectiveH = paperSize.heightMm - marginMm * 2

  // Berapa kolom & baris maksimum
  const columns = Math.floor(effectiveW / labelSize.widthMm)
  const rows = Math.floor(effectiveH / labelSize.heightMm)

  const labelsPerPage = columns * rows
  const totalPages = Math.ceil(totalLabels / labelsPerPage)

  return {
    paper: paperSize,
    label: labelSize,
    marginMm,
    columns,
    rows,
    labelsPerPage,
    totalPages,
    totalLabels,
  }
}

// ═══════════════════════════════════════════════════
// 2. QR Code Generator (via qrcode npm — SVG output)
// ═══════════════════════════════════════════════════

/**
 * Generate QR code SVG string dari data.
 * Pure JS — tidak butuh canvas/DOM.
 * Pakai error correction HIGH untuk cetak label.
 */
async function generateQrSvg(data: string, size: number): Promise<string> {
  const svg: string = await QRCodeLib.toString(data, {
    type: 'svg',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000', light: '#fff' },
  })
  return svg
}

// ═══════════════════════════════════════════════════
// 3. Generator HTML Template (QR Code)
// ═══════════════════════════════════════════════════

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Generate HTML template label barcode dalam struktur <table> grid.
 *
 * @param items        Array data batch + barcode URL
 * @param config       LayoutConfig dari calculateLabelLayout()
 */
export async function generateLabelHtml(
  items: BatchLabelItem[],
  config: LayoutConfig,
): Promise<string> {
  const { columns, rows, paper, label, marginMm } = config

  const labelWPx = mmToPx(label.widthMm)
  const labelHPx = mmToPx(label.heightMm)
  const paperWPx = mmToPx(paper.widthMm)
  const paperHPx = mmToPx(paper.heightMm)
  const marginPx = mmToPx(marginMm)

  // Cell CSS — bersih tanpa border, maksimalkan ruang barcode
  const cellStyle = [
    `width:${labelWPx}px`,
    `height:${labelHPx}px`,
    'padding:2px',
    'vertical-align:top',
    'text-align:center',
    'page-break-inside:avoid',
    'overflow:hidden',
  ].join(';')

  // Label content renderer — produk + QR code + kode
  const renderCell = async (item: BatchLabelItem): Promise<string> => {
    const qrData = `${item.sku}-${item.batchCode}`
    console.log('[Label-QR] Encoding:', qrData)
    // QR code — square, 70% tinggi cell
    const qrSize = Math.round(labelHPx * 0.65)
    const qrSvg = await generateQrSvg(qrData, qrSize)

    return `
      <td style="${cellStyle}">
        <!-- Product Name (compact) -->
        <div style="font-size:6pt;font-family:sans-serif;color:#333;line-height:1.1;margin-bottom:1px;text-align:center;">
          ${escapeHtml(item.productName)}
        </div>

        <!-- QR Code — square, centered -->
        <div style="width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${qrSvg}
        </div>

        <!-- Full code below QR -->
        <div style="
          font-size:5pt;font-family:monospace;color:#000;text-align:center;
          margin-top:1px;line-height:1.1;
        ">${escapeHtml(qrData)}</div>
      </td>`
  }

  // Build <tr> rows
  const pagesHtml: string[] = []
  let itemIndex = 0

  while (itemIndex < items.length) {
    const rowsHtml: string[] = []

    for (let r = 0; r < rows && itemIndex < items.length; r++) {
      const cells: string[] = []

      for (let c = 0; c < columns && itemIndex < items.length; c++) {
        const item = items[itemIndex]
        itemIndex++
        cells.push(await renderCell(item))
      }

      // Isi sisa kolom kosong
      while (cells.length < columns) {
        cells.push(`<td style="${cellStyle}">&nbsp;</td>`)
      }

      rowsHtml.push(`<tr>${cells.join('')}</tr>`)
    }

    // Isi sisa baris kosong
    while (rowsHtml.length < rows) {
      const emptyCells = Array(columns)
        .fill(`<td style="${cellStyle}">&nbsp;</td>`)
        .join('')
      rowsHtml.push(`<tr>${emptyCells}</tr>`)
    }

    const pageHtml = `
      <table style="
        width:${paperWPx - marginPx * 2}px;
        height:${paperHPx - marginPx * 2}px;
        border-collapse:collapse;
        margin:${marginPx}px auto;
        table-layout:fixed;
      ">
        ${rowsHtml.join('\n')}
      </table>`

    pagesHtml.push(pageHtml)
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: ${paper.widthMm}mm ${paper.heightMm}mm;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${paperWPx}px;
      height: ${paperHPx}px;
      overflow: hidden;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  ${pagesHtml
    .map((p) => `<div class="page">${p}</div>`)
    .join('\n')}
</body>
</html>`

  return fullHtml
}
