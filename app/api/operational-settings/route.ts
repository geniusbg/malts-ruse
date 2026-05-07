import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';
import { getDefaultBrandId } from '@/lib/brand';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({
      where: { brandId },
    });

    if (!ops) {
      return NextResponse.json({
        settings: {
          maxQrTables: 30,
          ordersEnabled: true,
          waiterCallEnabled: true,
        },
      });
    }

    return NextResponse.json({
      settings: {
        maxQrTables: ops.maxQrTables,
        ordersEnabled: ops.ordersEnabled,
        waiterCallEnabled: ops.waiterCallEnabled,
      },
    });
  } catch (e) {
    console.error('GET operational-settings', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { maxQrTables, ordersEnabled, waiterCallEnabled } = body as {
      maxQrTables?: number;
      ordersEnabled?: boolean;
      waiterCallEnabled?: boolean;
    };

    const brandId = await getDefaultBrandId();

    if (maxQrTables !== undefined && (maxQrTables < 1 || maxQrTables > 500)) {
      return NextResponse.json({ error: 'maxQrTables 1–500' }, { status: 400 });
    }

    const before = await prisma.operationalSettings.findUnique({
      where: { brandId },
    });

    const updated = await prisma.operationalSettings.upsert({
      where: { brandId },
      update: {
        ...(maxQrTables !== undefined ? { maxQrTables } : {}),
        ...(ordersEnabled !== undefined ? { ordersEnabled } : {}),
        ...(waiterCallEnabled !== undefined ? { waiterCallEnabled } : {}),
      },
      create: {
        brandId,
        maxQrTables: maxQrTables ?? 30,
        ordersEnabled: ordersEnabled ?? true,
        waiterCallEnabled: waiterCallEnabled ?? true,
      },
    });

    await prisma.operationalSettingsAuditLog.create({
      data: {
        brandId,
        actorUserId: (session.user as { id?: string }).id ?? null,
        actorEmail: (session.user as { email?: string }).email ?? null,
        action: 'UPDATE',
        before: {
          maxQrTables: before?.maxQrTables ?? 30,
          ordersEnabled: before?.ordersEnabled ?? true,
          waiterCallEnabled: before?.waiterCallEnabled ?? true,
        },
        after: {
          maxQrTables: updated.maxQrTables,
          ordersEnabled: updated.ordersEnabled,
          waiterCallEnabled: updated.waiterCallEnabled,
        },
      },
    });

    return NextResponse.json({
      settings: {
        maxQrTables: updated.maxQrTables,
        ordersEnabled: updated.ordersEnabled,
        waiterCallEnabled: updated.waiterCallEnabled,
      },
    });
  } catch (e) {
    console.error('PATCH operational-settings', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
