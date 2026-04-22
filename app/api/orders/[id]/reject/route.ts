import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is ADMIN, SUPER_ADMIN, or STAFF (staff can also reject orders)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await request.json().catch(() => ({}));
    
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
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: user.id
      }
    });

    const rejectionReason = reason || 'Отхвърлена от администратор';

    // Update order status to 'cancelled'
    await prisma.order.update({
      where: { id: id },
      data: { 
        status: 'cancelled',
        cancellationReason: rejectionReason
      }
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

      try {
        await pusherServerInstance.trigger(`table-${approval.tableNumber}`, 'order-approval-status', {
          orderId: approval.orderId,
          orderNumber: approval.order?.orderNumber ?? null,
          status: 'rejected',
          reason: rejectionReason,
          items: itemPayload
        });
      } catch (tableNotifyError) {
        console.log('Table approval rejection notification skipped:', tableNotifyError);
      }

      try {
        const remainingPending = await prisma.pendingOrderApproval.count({
          where: { status: 'pending' }
        });

        await pusherServerInstance.trigger('admin-channel', 'order-approval-status', {
          orderId: approval.orderId,
          orderNumber: approval.order?.orderNumber ?? null,
          status: 'rejected',
          tableNumber: approval.tableNumber,
          pendingCount: remainingPending,
          reviewedBy: { id: user.id, name: user.name },
          reason: rejectionReason
        });
      } catch (pusherError) {
        console.log('Pusher admin rejection update skipped:', pusherError);
      }
    }

    return NextResponse.json({ success: true, status: 'rejected' });
  } catch (error) {
    console.error('Reject order error:', error);
    return NextResponse.json({ error: 'Failed to reject order' }, { status: 500 });
  }
}

