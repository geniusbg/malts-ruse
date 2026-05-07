import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

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

    const orders = await prisma.order.findMany({
      where: {
        brandId,
        createdAt: { gte: today },
        ...(canSeeAllTables
          ? {}
          : {
              tableId: { in: assignedTableIds.length ? assignedTableIds : ['__none__'] },
            }),
      },
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Convert Decimal to Number for proper JSON serialization
    const ordersWithNumbers = orders.map(order => ({
      ...order,
      totalBgn: Number(order.totalBgn),
      totalEur: Number(order.totalEur),
      items: order.items.map(item => ({
        ...item,
        priceBgn: Number(item.priceBgn),
        priceEur: Number(item.priceEur)
      }))
    }));

    return NextResponse.json({ orders: ordersWithNumbers });
  } catch (error) {
    console.error('Get all orders error:', error);
    return NextResponse.json({ error: 'Failed to get orders' }, { status: 500 });
  }
}

