import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { generateQRCodeWithTableNumber, type QrMatrixSettings } from '@/lib/qr-code-table-svg';

function requireAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
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
    const n = parseInt(tableNumber, 10);
    if (!Number.isFinite(n) || n < 1) {
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
    const qrCodeDataUrl = await generateQRCodeWithTableNumber(qrUrl, n, qrCodeSize, (settings || {}) as QrMatrixSettings);

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
    const tables = await prisma.barTable.findMany({
      where: { brandId, isActive: true },
      orderBy: { tableNumber: 'asc' },
    });

    const results = [];

    for (const table of tables) {
      // Generate SHORT QR code URL (dynamic redirect)
      const { getAppUrl } = await import('@/lib/app-url');
      const qrUrl = `${getAppUrl()}/t/${table.tableNumber}`;
      
      // Generate QR code with embedded table number in center
      const qrCodeSize = settings?.qrCodeSize || 400;
      const qrCodeDataUrl = await generateQRCodeWithTableNumber(
        qrUrl,
        table.tableNumber,
        qrCodeSize,
        (settings || {}) as QrMatrixSettings
      );

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

    const tables = await prisma.barTable.findMany({
      where: { brandId, isActive: true },
      orderBy: { tableNumber: 'asc' },
    });

    const results = [];

    // Use default settings
    const settings: QrMatrixSettings = {};

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


