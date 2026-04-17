import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  generateQRCodeWithTableNumber,
  qrMatrixSettingsFromStored,
} from '@/lib/qr-code-table-svg';

function requireAdmin(role: unknown) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandId = await getDefaultBrandId();
    const tables = await prisma.barTable.findMany({
      where: { brandId },
      orderBy: { tableNumber: 'asc' },
      select: {
        id: true,
        tableNumber: true,
        tableName: true,
        isActive: true,
        redirectUrl: true,
        scanCount: true,
        lastScannedAt: true,
        qrCodeUrl: true,
      },
    });
    return NextResponse.json({ tables });
  } catch (e) {
    console.error('GET /api/qr/tables error:', e);
    return NextResponse.json({ error: 'Failed to get tables' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const tableNumber = Number(body?.tableNumber);
    const tableName = typeof body?.tableName === 'string' ? body.tableName.trim() : '';

    if (!Number.isFinite(tableNumber) || tableNumber < 1 || !Number.isInteger(tableNumber)) {
      return NextResponse.json({ error: 'Невалиден номер на маса' }, { status: 400 });
    }

    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    const maxTables = ops?.maxQrTables ?? 30;

    const activeCount = await prisma.barTable.count({
      where: { brandId, isActive: true },
    });
    if (activeCount >= maxTables) {
      return NextResponse.json({ error: `Достигнат лимит: ${maxTables} активни маси` }, { status: 400 });
    }

    const existing = await prisma.barTable.findUnique({
      where: { brandId_tableNumber: { brandId, tableNumber } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Този номер маса вече съществува' }, { status: 400 });
    }

    const created = await prisma.barTable.create({
      data: {
        brandId,
        tableNumber,
        tableName: tableName ? tableName.slice(0, 18) : null,
        isActive: true,
        redirectUrl: `/bg/order?table=${tableNumber}`,
      },
      select: { id: true, tableNumber: true, tableName: true, isActive: true },
    });

    // Само тази маса: QR по запазените настройки (без bulk по останалите)
    let qrGenerated = false;
    try {
      const settingsRow = await prisma.qRCodeSettings.findUnique({ where: { brandId } });
      const genSettings = qrMatrixSettingsFromStored(settingsRow?.settings ?? null);
      const { getAppUrl } = await import('@/lib/app-url');
      const qrUrl = `${getAppUrl()}/t/${tableNumber}`;
      const cellSize = genSettings.qrCodeSize ?? 400;
      const qrCodeDataUrl = await generateQRCodeWithTableNumber(qrUrl, tableNumber, cellSize, genSettings);

      await prisma.barTable.update({
        where: { id: created.id },
        data: {
          qrCodeUrl: qrUrl,
          qrCodeData: qrCodeDataUrl,
        },
      });
      qrGenerated = true;
    } catch (e) {
      console.error('POST /api/qr/tables: single-table QR generation failed', e);
    }

    return NextResponse.json({ table: created, qrGenerated }, { status: 201 });
  } catch (e) {
    console.error('POST /api/qr/tables error:', e);
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const brandId = await getDefaultBrandId();
    const table = await prisma.barTable.findFirst({
      where: { id, brandId },
      select: { id: true, tableNumber: true, tableName: true, isActive: true },
    });
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const [orderCount, callCount, assignmentCount] = await Promise.all([
      prisma.order.count({ where: { brandId, tableId: table.id } }),
      prisma.waiterCall.count({ where: { brandId, tableId: table.id } }),
      prisma.staffTableAssignment.count({ where: { brandId, tableId: table.id } }),
    ]);

    if (orderCount > 0 || callCount > 0) {
      await prisma.barTable.updateMany({
        where: { id: table.id, brandId },
        data: { isActive: false },
      });
      return NextResponse.json(
        {
          success: true,
          deleted: false,
          deactivated: true,
          counts: { orders: orderCount, waiterCalls: callCount, assignments: assignmentCount },
          message:
            'Масата има история (поръчки/повиквания) и не може да бъде изтрита перманентно. Беше деактивирана.',
        },
        { status: 200 }
      );
    }

    // Safe delete: no orders/calls reference this table. Related scans/assignments are cascade-deleted.
    await prisma.barTable.delete({
      where: { id: table.id },
    });

    return NextResponse.json(
      {
        success: true,
        deleted: true,
        counts: { orders: orderCount, waiterCalls: callCount, assignments: assignmentCount },
        message: '✅ Масата е изтрита перманентно.',
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('DELETE /api/qr/tables error:', e);
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
  }
}

