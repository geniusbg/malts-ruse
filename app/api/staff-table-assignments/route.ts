import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDefaultBrandId } from '@/lib/brand';

function isAdminRole(role: unknown) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

// GET ?userId=... -> { canSeeAllTables, tableIds, tables }
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || !isAdminRole(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const brandId = await getDefaultBrandId();

    const [user, tables, assignments] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, canSeeAllTables: true },
      }),
      prisma.barTable.findMany({
        where: { brandId },
        select: { id: true, tableNumber: true, tableName: true, isActive: true },
        orderBy: { tableNumber: 'asc' },
      }),
      prisma.staffTableAssignment.findMany({
        where: { brandId, userId },
        select: { tableId: true },
      }),
    ]);

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      userId,
      canSeeAllTables: Boolean(user.canSeeAllTables || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'),
      tableIds: assignments.map((a) => a.tableId),
      tables,
    });
  } catch (e) {
    console.error('GET staff-table-assignments error:', e);
    return NextResponse.json({ error: 'Failed to get assignments' }, { status: 500 });
  }
}

// PUT { userId, canSeeAllTables, tableIds: string[] }
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || !isAdminRole(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const tableIds = (body?.tableIds ?? []) as unknown;
    const canSeeAllTables = Boolean(body?.canSeeAllTables);

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!Array.isArray(tableIds)) return NextResponse.json({ error: 'tableIds must be an array' }, { status: 400 });

    const brandId = await getDefaultBrandId();

    // Update user flag
    await prisma.user.update({
      where: { id: userId },
      data: { canSeeAllTables },
    });

    // Replace assignments
    await prisma.staffTableAssignment.deleteMany({
      where: { brandId, userId },
    });

    const uniqueTableIds = Array.from(
      new Set(tableIds.filter((t) => typeof t === 'string' && t.trim()).map((t) => String(t)))
    );

    if (uniqueTableIds.length) {
      await prisma.staffTableAssignment.createMany({
        data: uniqueTableIds.map((tableId) => ({
          brandId,
          userId,
          tableId,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PUT staff-table-assignments error:', e);
    return NextResponse.json({ error: 'Failed to update assignments' }, { status: 500 });
  }
}

