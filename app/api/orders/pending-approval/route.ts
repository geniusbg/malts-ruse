import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is ADMIN, SUPER_ADMIN, or STAFF (staff can also approve orders)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all pending approvals with order details
    let approvals;
    try {
      approvals = await prisma.pendingOrderApproval.findMany({
        where: { status: 'pending' },
        include: {
          order: {
            include: {
              items: true
            }
          }
        },
        orderBy: { requestedAt: 'asc' }
      });
    } catch (dbError: any) {
      // If table doesn't exist (P2021), return empty array
      if (dbError.code === 'P2021') {
        console.log('PendingOrderApproval table does not exist yet');
        return NextResponse.json({ approvals: [] });
      }
      throw dbError;
    }

    // Convert Decimal to Number for JSON serialization
    const formattedApprovals = approvals.map(approval => ({
      id: approval.id,
      orderId: approval.orderId,
      tableNumber: approval.tableNumber,
      orderCount: approval.orderCount,
      reason: approval.reason,
      status: approval.status,
      requestedAt: approval.requestedAt.toISOString(),
      order: {
        id: approval.order.id,
        orderNumber: approval.order.orderNumber,
        tableNumber: approval.order.tableNumber,
        status: approval.order.status,
        totalBgn: Number(approval.order.totalBgn),
        totalEur: Number(approval.order.totalEur),
        createdAt: approval.order.createdAt.toISOString(),
        items: approval.order.items.map(item => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          priceBgn: Number(item.priceBgn),
          priceEur: Number(item.priceEur)
        }))
      }
    }));

    return NextResponse.json({ approvals: formattedApprovals });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    return NextResponse.json({ error: 'Failed to get pending approvals' }, { status: 500 });
  }
}

