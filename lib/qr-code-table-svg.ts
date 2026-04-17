import QRCode from 'qrcode';

/** Полета от запазените QR настройки, които влизат в матрицата (същите като при bulk generate). */
export type QrMatrixSettings = {
  backgroundColor?: string;
  qrCodeBackgroundColor?: string;
  textColor?: string;
  qrCodeColor?: string;
  qrCodeSize?: number;
};

/** Мапва JSON от `qRCodeSettings.settings` към параметри за генериране на SVG QR. */
export function qrMatrixSettingsFromStored(stored: unknown): QrMatrixSettings {
  if (!stored || typeof stored !== 'object') return {};
  const s = stored as Record<string, unknown>;
  const qrCodeSize =
    typeof s.qrCodeSize === 'number' && Number.isFinite(s.qrCodeSize) ? s.qrCodeSize : undefined;
  return {
    backgroundColor: typeof s.backgroundColor === 'string' ? s.backgroundColor : undefined,
    qrCodeBackgroundColor:
      typeof s.qrCodeBackgroundColor === 'string' ? s.qrCodeBackgroundColor : undefined,
    textColor: typeof s.textColor === 'string' ? s.textColor : undefined,
    qrCodeColor: typeof s.qrCodeColor === 'string' ? s.qrCodeColor : undefined,
    qrCodeSize,
  };
}

/**
 * QR матрица с номер на маса в центъра (SVG data URL) — същата логика като bulk generate.
 */
export async function generateQRCodeWithTableNumber(
  qrUrl: string,
  tableNumber: number,
  width: number = 400,
  settings: QrMatrixSettings = {}
): Promise<string> {
  const {
    backgroundColor = '#FFFFFF',
    textColor = '#000000',
    qrCodeColor = '#000000',
    qrCodeSize = width,
  } = settings;

  const qrLight =
    settings.qrCodeBackgroundColor != null && String(settings.qrCodeBackgroundColor).trim() !== ''
      ? String(settings.qrCodeBackgroundColor).trim()
      : backgroundColor;

  const svgWidth = qrCodeSize;
  const svgHeight = qrCodeSize;

  const qrCodeSvg = await QRCode.toString(qrUrl, {
    type: 'svg',
    width: qrCodeSize,
    margin: 0,
    errorCorrectionLevel: 'H',
    color: {
      dark: qrCodeColor,
      light: qrLight,
    },
  });

  if (!qrCodeSvg || qrCodeSvg.length === 0) {
    throw new Error('Failed to generate QR code SVG');
  }

  const viewBoxMatch = qrCodeSvg.match(/viewBox=["']([^"']+)["']/i);
  let viewBox = `0 0 ${qrCodeSize} ${qrCodeSize}`;
  if (viewBoxMatch) {
    viewBox = viewBoxMatch[1];
  }

  const viewBoxParts = viewBox.split(/\s+/).map(Number);
  const qrViewBoxX = viewBoxParts[0] || 0;
  const qrViewBoxY = viewBoxParts[1] || 0;
  const qrViewBoxWidth = viewBoxParts[2] || qrCodeSize;
  const qrViewBoxHeight = viewBoxParts[3] || qrCodeSize;

  const svgContentMatch = qrCodeSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let qrSvgContent = '';
  if (svgContentMatch && svgContentMatch[1]) {
    qrSvgContent = svgContentMatch[1].trim();
  } else {
    qrSvgContent = qrCodeSvg
      .replace(/^<\?xml[^>]*\?>\s*/i, '')
      .replace(/^<svg[^>]*>/i, '')
      .replace(/<\/svg>\s*$/i, '')
      .trim();
  }

  qrSvgContent = qrSvgContent
    .replace(/fill="#000000"/g, `fill="${qrCodeColor}"`)
    .replace(/fill="#ffffff"/g, `fill="${qrLight}"`)
    .replace(/fill="black"/gi, `fill="${qrCodeColor}"`)
    .replace(/fill="white"/gi, `fill="${qrLight}"`)
    .replace(/fill="#000"/g, `fill="${qrCodeColor}"`)
    .replace(/fill="#fff"/gi, `fill="${qrLight}"`)
    .replace(/fill="none"/g, `fill="${qrLight}"`);

  const fontSize = Math.floor(qrCodeSize * 0.18);
  const circleRadius = Math.floor(fontSize * 1.05);
  const text = tableNumber.toString();

  if (!qrSvgContent || qrSvgContent.length < 10) {
    throw new Error(`Invalid QR code SVG content. Length: ${qrSvgContent?.length || 0}`);
  }

  const scaleX = svgWidth / qrViewBoxWidth;
  const scaleY = svgHeight / qrViewBoxHeight;

  const combinedSvg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <rect width="${svgWidth}" height="${svgHeight}" fill="${qrLight}" x="0" y="0"/>
    <g transform="scale(${scaleX}, ${scaleY}) translate(${-qrViewBoxX}, ${-qrViewBoxY})">
      ${qrSvgContent}
    </g>
    <circle cx="${svgWidth / 2}" cy="${svgHeight / 2}" r="${circleRadius}" fill="${qrLight}" opacity="0.85"/>
    <text 
      x="${svgWidth / 2}" 
      y="${svgHeight / 2}" 
      font-family="Arial, Helvetica, sans-serif" 
      font-size="${fontSize}px" 
      font-weight="bold" 
      fill="${textColor}" 
      text-anchor="middle" 
      dominant-baseline="central"
      alignment-baseline="central"
      style="pointer-events: none; user-select: none;"
    >${text}</text>
  </svg>`;

  if (!combinedSvg || combinedSvg.length < 100) {
    throw new Error(`Failed to create combined SVG. Length: ${combinedSvg?.length || 0}`);
  }

  let dataUrl: string;
  try {
    const svgBase64 = Buffer.from(combinedSvg, 'utf-8').toString('base64');
    dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
  } catch {
    const svgEncoded = encodeURIComponent(combinedSvg);
    dataUrl = `data:image/svg+xml;charset=utf-8,${svgEncoded}`;
  }

  if (!dataUrl || !dataUrl.startsWith('data:image/svg+xml')) {
    throw new Error(`Invalid data URL format. Starts with: ${dataUrl?.substring(0, 50) || 'null'}`);
  }

  return dataUrl;
}
