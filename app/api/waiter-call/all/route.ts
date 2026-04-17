import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;
    const userId = (session?.user as any)?.id as string | undefined;
    if (!session?.user || !userId || (role !== 'STAFF' && role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandId = await getDefaultBrandId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { canSeeAllTables: true, role: true },
    });
    const canSeeAllTables = Boolean(user?.canSeeAllTables || role === 'ADMIN' || role === 'SUPER_ADMIN');

    const assignedTableIds: string[] = canSeeAllTables
      ? []
      : (
          await prisma.staffTableAssignment.findMany({
            where: { brandId, userId },
            select: { tableId: true },
          })
        ).map((a) => a.tableId);

    const calls = await prisma.waiterCall.findMany({
      where: {
        brandId,
        createdAt: { gte: today },
        ...(canSeeAllTables
          ? {}
          : {
              tableId: { in: assignedTableIds.length ? assignedTableIds : ['__none__'] },
            }),
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Get all calls error:', error);
    return NextResponse.json({ error: 'Failed to get calls' }, { status: 500 });
  }
}

