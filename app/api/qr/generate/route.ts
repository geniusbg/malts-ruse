import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

function requireAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

interface QRCodeSettings {
  /** Фон на цялата картка (в админ прегледа). */
  backgroundColor?: string;
  /** Фон на светлите полета на матрицата + задният квадрат на SVG изображението на QR. */
  qrCodeBackgroundColor?: string;
  textColor?: string;
  qrCodeColor?: string;
  qrCodeSize?: number;
}

/**
 * Generate QR code with embedded table number text in the center
 * Uses pure SVG approach - no Sharp needed!
 */
async function generateQRCodeWithTableNumber(
  qrUrl: string,
  tableNumber: number,
  width: number = 400,
  settings: QRCodeSettings = {}
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

  // Use qrCodeSize as the actual size for the entire SVG canvas
  // This ensures the QR code takes exactly the space specified in settings
  const svgWidth = qrCodeSize;
  const svgHeight = qrCodeSize;

  // Step 1: Generate QR code as SVG string
  const qrCodeSvg = await QRCode.toString(qrUrl, {
    type: 'svg',
    width: qrCodeSize,
    margin: 0, // No margin to avoid white border
    errorCorrectionLevel: 'H', // High error correction for embedded text
    color: {
      dark: qrCodeColor,
      light: qrLight,
    },
  });

  // Debug: Check if SVG was generated
  if (!qrCodeSvg || qrCodeSvg.length === 0) {
    throw new Error('Failed to generate QR code SVG');
  }

  // Parse viewBox from original SVG to understand coordinate system
  const viewBoxMatch = qrCodeSvg.match(/viewBox=["']([^"']+)["']/i);
  let viewBox = `0 0 ${qrCodeSize} ${qrCodeSize}`; // Default viewBox
  if (viewBoxMatch) {
    viewBox = viewBoxMatch[1];
  }
  
  // Parse viewBox to get actual dimensions
  const viewBoxParts = viewBox.split(/\s+/).map(Number);
  const qrViewBoxX = viewBoxParts[0] || 0;
  const qrViewBoxY = viewBoxParts[1] || 0;
  const qrViewBoxWidth = viewBoxParts[2] || qrCodeSize;
  const qrViewBoxHeight = viewBoxParts[3] || qrCodeSize;

  // Extract the SVG content (paths, rects, etc.)
  const svgContentMatch = qrCodeSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let qrSvgContent = '';
  if (svgContentMatch && svgContentMatch[1]) {
    qrSvgContent = svgContentMatch[1].trim();
  } else {
    // Fallback: try to extract without regex
    qrSvgContent = qrCodeSvg
      .replace(/^<\?xml[^>]*\?>\s*/i, '')
      .replace(/^<svg[^>]*>/i, '')
      .replace(/<\/svg>\s*$/i, '')
      .trim();
  }

  // Apply custom colors (light cells = qrLight, not necessarily card background)
  qrSvgContent = qrSvgContent
    .replace(/fill="#000000"/g, `fill="${qrCodeColor}"`)
    .replace(/fill="#ffffff"/g, `fill="${qrLight}"`)
    .replace(/fill="black"/gi, `fill="${qrCodeColor}"`)
    .replace(/fill="white"/gi, `fill="${qrLight}"`)
    .replace(/fill="#000"/g, `fill="${qrCodeColor}"`)
    .replace(/fill="#fff"/gi, `fill="${qrLight}"`)
    .replace(/fill="none"/g, `fill="${qrLight}"`);

  // Step 2: Calculate text overlay dimensions
  // Use larger font size (18% of QR code width) for better visibility
  const fontSize = Math.floor(qrCodeSize * 0.18); // ~18% of QR code width
  // Circle should be just slightly larger than text (smaller circle for less darkening)
  const circleRadius = Math.floor(fontSize * 1.05); // Smaller circle behind text
  const text = tableNumber.toString();
  
  // Validate that we have QR code content
  if (!qrSvgContent || qrSvgContent.length < 10) {
    throw new Error(`Invalid QR code SVG content. Length: ${qrSvgContent?.length || 0}`);
  }

  // Step 3: Create combined SVG with background, QR code, and text overlay
  // Scale QR code to fill the entire SVG canvas
  // Calculate scale factor to map QR code's viewBox to our canvas size
  const scaleX = svgWidth / qrViewBoxWidth;
  const scaleY = svgHeight / qrViewBoxHeight;
  
  // Create combined SVG - scale QR code to fill entire canvas
  // Text should be added after scaling to maintain correct size
  const combinedSvg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <!-- Background of QR image (matches light modules) -->
    <rect width="${svgWidth}" height="${svgHeight}" fill="${qrLight}" x="0" y="0"/>
    
    <!-- QR Code scaled to fill entire canvas -->
    <g transform="scale(${scaleX}, ${scaleY}) translate(${-qrViewBoxX}, ${-qrViewBoxY})">
      ${qrSvgContent}
    </g>
    
    <!-- Text overlay (positioned in canvas coordinates, not scaled) -->
    <!-- Use lower opacity circle to avoid darkening the QR code too much -->
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

  // Validate combined SVG
  if (!combinedSvg || combinedSvg.length < 100) {
    throw new Error(`Failed to create combined SVG. Length: ${combinedSvg?.length || 0}`);
  }

  // Step 4: Convert SVG to data URL
  // Try base64 encoding first (more reliable for complex SVGs)
  // If that fails, fall back to URL encoding
  let dataUrl: string;
  
  try {
    // Base64 encoding - works well for most browsers
    const svgBase64 = Buffer.from(combinedSvg, 'utf-8').toString('base64');
    dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
  } catch (error) {
    // Fallback to URL encoding if base64 fails
    const svgEncoded = encodeURIComponent(combinedSvg);
    dataUrl = `data:image/svg+xml;charset=utf-8,${svgEncoded}`;
  }

  // Validate data URL
  if (!dataUrl || !dataUrl.startsWith('data:image/svg+xml')) {
    throw new Error(`Invalid data URL format. Starts with: ${dataUrl?.substring(0, 50) || 'null'}`);
  }

  return dataUrl;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tableNumber, settings } = await request.json();

    if (!tableNumber) {
      return NextResponse.json({ error: 'Table number required' }, { status: 400 });
    }

    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    const maxTables = ops?.maxQrTables ?? 30;
    const n = parseInt(tableNumber, 10);
    if (!Number.isFinite(n) || n < 1 || n > maxTables) {
      return NextResponse.json({ error: 'Невалидна маса' }, { status: 400 });
    }

    const table = await prisma.barTable.findUnique({
      where: {
        brandId_tableNumber: { brandId, tableNumber: n },
      },
    });

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Generate SHORT QR code URL (dynamic redirect)
    const { getAppUrl } = await import('@/lib/app-url');
    const qrUrl = `${getAppUrl()}/t/${n}`;

    // Generate QR code with embedded table number in center
    const qrCodeSize = settings?.qrCodeSize || 400;
    // Use fixed width for the SVG canvas (same as QR code size, no padding needed)
    const qrCodeDataUrl = await generateQRCodeWithTableNumber(qrUrl, n, qrCodeSize, settings);

    // Update table with QR code data and default redirect URL
    await prisma.barTable.update({
      where: { id: table.id },
      data: {
        qrCodeUrl: qrUrl,
        qrCodeData: qrCodeDataUrl,
        redirectUrl: `/bg/order?table=${n}` // Default redirect
      }
    });

    return NextResponse.json({
      qrCodeDataUrl,
      qrUrl,
      tableNumber: n,
      tableName: table.tableName
    });

  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Generate all QR codes at once (with settings support)
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { settings } = await request.json();
    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    const maxTables = ops?.maxQrTables ?? 30;

    const tables = await prisma.barTable.findMany({
      where: { brandId, tableNumber: { lte: maxTables } },
      orderBy: { tableNumber: 'asc' },
    });

    const results = [];

    for (const table of tables) {
      // Generate SHORT QR code URL (dynamic redirect)
      const { getAppUrl } = await import('@/lib/app-url');
      const qrUrl = `${getAppUrl()}/t/${table.tableNumber}`;
      
      // Generate QR code with embedded table number in center
      const qrCodeSize = settings?.qrCodeSize || 400;
      const qrCodeDataUrl = await generateQRCodeWithTableNumber(qrUrl, table.tableNumber, qrCodeSize, settings || {});

      await prisma.barTable.update({
        where: { id: table.id },
        data: {
          qrCodeUrl: qrUrl,
          qrCodeData: qrCodeDataUrl,
          redirectUrl: `/bg/order?table=${table.tableNumber}` // Default redirect
        }
      });

      results.push({
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        qrCodeDataUrl,
        qrUrl,
        redirectUrl: `/order?table=${table.tableNumber}`
      });
    }

    return NextResponse.json({ tables: results, count: results.length });

  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Generate all QR codes at once (default settings)
export async function GET() {
  try {
    const brandId = await getDefaultBrandId();
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    const maxTables = ops?.maxQrTables ?? 30;
    const tables = await prisma.barTable.findMany({
      where: { brandId, tableNumber: { lte: maxTables } },
      orderBy: { tableNumber: 'asc' },
    });

    const results = [];

    // Use default settings
    const settings: QRCodeSettings = {};

    for (const table of tables) {
      // Generate SHORT QR code URL (dynamic redirect)
      const { getAppUrl } = await import('@/lib/app-url');
      const qrUrl = `${getAppUrl()}/t/${table.tableNumber}`;
      
      // Generate QR code with embedded table number in center
      const qrCodeSize = settings.qrCodeSize || 400;
      const qrCodeDataUrl = await generateQRCodeWithTableNumber(qrUrl, table.tableNumber, qrCodeSize, settings);

      await prisma.barTable.update({
        where: { id: table.id },
        data: {
          qrCodeUrl: qrUrl,
          qrCodeData: qrCodeDataUrl,
          redirectUrl: `/bg/order?table=${table.tableNumber}` // Default redirect
        }
      });

      results.push({
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        qrCodeDataUrl,
        qrUrl,
        redirectUrl: `/order?table=${table.tableNumber}`
      });
    }

    return NextResponse.json({ tables: results, count: results.length });

  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


