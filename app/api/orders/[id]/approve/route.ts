import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    
    // Find approval record
    let approval;
    try {
      approval = await prisma.pendingOrderApproval.findUnique({
        where: { orderId: id },
        include: {
          order: {
            include: { items: true }
          }
        }
      });
    } catch (dbError: any) {
      // If table doesn't exist (P2021), return error
      if (dbError.code === 'P2021') {
        console.log('PendingOrderApproval table does not exist yet');
        return NextResponse.json({ error: 'Approval system not available' }, { status: 503 });
      }
      throw dbError;
    }

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    if (approval.status !== 'pending') {
      return NextResponse.json({ error: 'Одобрението вече е обработено' }, { status: 400 });
    }

    // Update approval status
    await prisma.pendingOrderApproval.update({
      where: { id: approval.id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: user.id
      }
    });

    // Update order status to 'pending' (activate order)
    await prisma.order.update({
      where: { id: id },
      data: { status: 'pending' }
    });

    let pusherServerInstance: any = null;
    try {
      const pusherModule = await import('@/lib/pusher-server');
      pusherServerInstance = pusherModule.pusherServer;
    } catch (pusherInitError) {
      console.log('Pusher not available:', pusherInitError);
    }

    if (pusherServerInstance) {
      const itemPayload = approval.order?.items?.map(item => ({
        productName: item.productName,
        quantity: item.quantity
      })) || [];

      // Notify staff that a new order is ready to be processed
      try {
        await pusherServerInstance.trigger('staff-channel', 'new-order', {
          id: approval.order.id,
          orderNumber: approval.order.orderNumber,
          tableNumber: approval.order.tableNumber,
          status: 'pending',
          totalBgn: Number(approval.order.totalBgn),
          totalEur: Number(approval.order.totalEur),
          createdAt: approval.order.createdAt.toISOString()
        });
      } catch (pusherError) {
        console.log('Pusher staff notification skipped:', pusherError);
      }

      try {
        await pusherServerInstance.trigger(`table-${approval.tableNumber}`, 'order-approval-status', {
          orderId: approval.orderId,
          orderNumber: approval.order.orderNumber,
          status: 'approved',
          items: itemPayload
        });
      } catch (tableNotifyError) {
        console.log('Table approval notification skipped:', tableNotifyError);
      }

      // Notify admin/staff dashboards to refresh pending approvals banner
      try {
        const remainingPending = await prisma.pendingOrderApproval.count({
          where: { status: 'pending' }
        });

        await pusherServerInstance.trigger('admin-channel', 'order-approval-status', {
          orderId: approval.orderId,
          orderNumber: approval.order.orderNumber,
          tableNumber: approval.tableNumber,
          status: 'approved',
          pendingCount: remainingPending,
          reviewedBy: { id: user.id, name: user.name }
        });
      } catch (pusherError) {
        console.log('Pusher admin approval update skipped:', pusherError);
      }
    }

    return NextResponse.json({ success: true, status: 'approved' });
  } catch (error) {
    console.error('Approve order error:', error);
    return NextResponse.json({ error: 'Failed to approve order' }, { status: 500 });
  }
}

