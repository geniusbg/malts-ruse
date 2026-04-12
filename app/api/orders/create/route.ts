import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bgnToEur } from '@/lib/currency';
import { getSecuritySettings } from '@/lib/security-settings';
import { getDefaultBrandId } from '@/lib/brand';
import { expectedUnitPriceBgn, indexActivePromotionsByProductId } from '@/lib/pricing';
import { TABLE_SESSION_COOKIE_NAME, TableSessionInvalidReason, validateTableSession } from '@/lib/table-sessions';

// In-memory rate limiting storage (per table)
const orderRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, maxOrders: number = 2, windowMs: number = 5 * 60 * 1000): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = orderRateLimits.get(key);

  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    orderRateLimits.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: maxOrders - 1, resetTime };
  }

  if (record.count >= maxOrders) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  orderRateLimits.set(key, record);
  return { allowed: true, remaining: maxOrders - record.count, resetTime: record.resetTime };
}

const SESSION_ERROR_MESSAGES: Record<TableSessionInvalidReason, string> = {
  missing: 'Сесията е изтекла. Моля, сканирайте QR кода отново.',
  expired: 'Сесията е изтекла. Моля, сканирайте QR кода отново.',
  revoked: 'Сесията е невалидна. Моля, сканирайте QR кода отново.',
  invalid: 'Невалидна сесия. Моля, сканирайте QR кода отново.'
};

function buildInvalidSessionResponse(reason: TableSessionInvalidReason) {
  const response = NextResponse.json(
    { error: SESSION_ERROR_MESSAGES[reason], reason },
    { status: 401 }
  );
  response.cookies.delete(TABLE_SESSION_COOKIE_NAME);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedTableNumber = parseInt(body.tableNumber || '0');
    const items = body.items;
    const legacySessionToken = body.sessionToken as string | undefined;
    const securitySettings = await getSecuritySettings();
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    const sessionToken = request.cookies.get(TABLE_SESSION_COOKIE_NAME)?.value || legacySessionToken;
    const sessionValidation = await validateTableSession(sessionToken);
    if (!sessionValidation.valid) {
      return buildInvalidSessionResponse(sessionValidation.reason);
    }
    const tableNumber = sessionValidation.session.tableNumber;

    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    if (ops && !ops.ordersEnabled) {
      return NextResponse.json(
        { error: 'Поръчките са временно изключени.' },
        { status: 403 }
      );
    }
    const maxTables = ops?.maxQrTables ?? 30;
    if (tableNumber < 1 || tableNumber > maxTables) {
      return NextResponse.json({ error: 'Невалидна маса' }, { status: 400 });
    }

    const barTable = await prisma.barTable.findFirst({
      where: { brandId, tableNumber, isActive: true },
    });
    if (!barTable) {
      return NextResponse.json({ error: 'Невалидна маса' }, { status: 400 });
    }

    const productIds = [...new Set(items.map((i: { productId?: string }) => i.productId).filter(Boolean))] as string[];
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    const priceCheckNow = new Date();
    const [dbProducts, activePromos] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: { in: productIds },
          category: { brandId },
        },
      }),
      prisma.productPromotion.findMany({
        where: {
          brandId,
          productId: { in: productIds },
          startsAt: { lte: priceCheckNow },
          endsAt: { gte: priceCheckNow },
        },
      }),
    ]);

    if (dbProducts.length !== productIds.length) {
      return NextResponse.json({ error: 'Невалидни продукти' }, { status: 400 });
    }

    const promoMap = indexActivePromotionsByProductId(activePromos, priceCheckNow);
    let serverTotalBgn = 0;
    for (const item of items as { productId: string; priceBgn: number; quantity: number }[]) {
      const prod = dbProducts.find((p) => p.id === item.productId);
      if (!prod) {
        return NextResponse.json({ error: 'Невалидни продукти' }, { status: 400 });
      }
      const expected = expectedUnitPriceBgn(prod, promoMap.get(item.productId));
      const got = Number(item.priceBgn);
      if (!Number.isFinite(got) || Math.abs(got - expected) > 0.02) {
        return NextResponse.json(
          { error: 'Невалидна цена. Моля, презаредете менюто.' },
          { status: 400 }
        );
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      serverTotalBgn += expected * qty;
    }
    serverTotalBgn = Number(serverTotalBgn.toFixed(2));

    if (requestedTableNumber && requestedTableNumber !== tableNumber) {
      console.warn(
        `Order create: table mismatch detected (cookie: ${tableNumber}, body: ${requestedTableNumber})`
      );
    }

    // Check if there's a pending approval for this table
    try {
      const pendingApproval = await prisma.pendingOrderApproval.findFirst({
        where: {
          tableNumber,
          status: 'pending'
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              createdAt: true
            }
          }
        }
      });

      if (pendingApproval) {
        const pendingTime = Math.floor((Date.now() - pendingApproval.requestedAt.getTime()) / 1000 / 60);
        return NextResponse.json({ 
          error: 'Има изчакваща поръчка за одобрение от тази маса.',
          details: `Поръчка #${pendingApproval.order.orderNumber} изчаква одобрение от администратор (преди ${pendingTime} минути). Моля, изчакайте одобрението или отказването на изчакващата поръчка преди да направите нова.`,
          pendingOrderId: pendingApproval.orderId,
          pendingOrderNumber: pendingApproval.order.orderNumber
        }, { status: 409 }); // 409 Conflict
      }
    } catch (approvalCheckError: any) {
      // If table doesn't exist (P2021), continue without check
      if (approvalCheckError.code !== 'P2021') {
        console.error('Error checking pending approvals:', approvalCheckError);
        // Continue anyway - don't block order creation if check fails
      }
    }
    
    // Rate limiting: Check only by table number (not by IP to avoid blocking legitimate customers)
    const tableKey = `table:${tableNumber}`;
    
    // Check table-based rate limit (5 orders per 5 minutes per table)
    const approvalWindowMs = (securitySettings.approvalTimeWindowMinutes || 5) * 60 * 1000;
    const approvalThreshold = securitySettings.approvalOrderThreshold || 5;

    const tableLimit = checkRateLimit(tableKey, approvalThreshold, approvalWindowMs);
    
    // Count orders in last 5 minutes for approval check
    // Note: This counts existing orders BEFORE creating the current one
    const windowStart = new Date(Date.now() - approvalWindowMs);
    const recentOrderCount = await prisma.order.count({
      where: {
        brandId,
        tableNumber,
        createdAt: { gte: windowStart },
      },
    });

    // If >= threshold existing orders in last window, the current one will require approval
    const requiresApproval = recentOrderCount >= approvalThreshold;
    
    // If rate limit exceeded (but not approval threshold), return error
    if (!tableLimit.allowed && !requiresApproval) {
      const resetMinutes = Math.ceil((tableLimit.resetTime - Date.now()) / 60000);
      return NextResponse.json({ 
        error: 'Твърде много поръчки от тази маса. Моля, изчакайте преди да направите нова поръчка.',
        details: `Можете да направите нова поръчка след ${resetMinutes} минути.`
      }, { status: 429 });
    }

    // Get today's order count for sequential numbering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrderCount = await prisma.order.count({
      where: {
        brandId,
        createdAt: { gte: today },
      },
    });

    const orderNumber = todayOrderCount + 1;

    const totalBgn = serverTotalBgn;

    // Create order (status will be 'pending_approval' if requires approval, otherwise 'pending')
    const orderStatus = requiresApproval ? 'pending_approval' : 'pending';
    const order = await prisma.order.create({
      data: {
        brandId,
        tableId: barTable.id,
        tableNumber,
        orderNumber,
        status: orderStatus,
        totalBgn,
        totalEur: bgnToEur(totalBgn),
        isPaid: false,
      },
    });

    // Create order items (server-side unit prices)
    try {
      for (const item of items as { productId: string; productName?: string; name?: string; quantity: number; priceBgn: number }[]) {
        const prod = dbProducts.find((p) => p.id === item.productId)!;
        const unitBgn = expectedUnitPriceBgn(prod, promoMap.get(item.productId));
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.productName || item.name || '',
            quantity: qty,
            priceBgn: unitBgn,
            priceEur: bgnToEur(unitBgn),
          },
        });
      }
    } catch (itemsError: any) {
      console.error('Failed to create order items:', itemsError);
      // If items creation fails, delete the order and return error
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // Create PendingOrderApproval if required
    if (requiresApproval) {
      try {
        await prisma.pendingOrderApproval.create({
          data: {
            orderId: order.id,
            tableNumber,
            orderCount: recentOrderCount + 1, // Include current order
            reason: 'rate_limit_exceeded',
            status: 'pending'
          }
        });

        // Send push notification to admins
        try {
          const { buildAppUrl } = await import('@/lib/app-url');
          const response = await fetch(buildAppUrl('/api/push/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '⚠️ Поръчка изисква одобрение',
              body: `Маса ${tableNumber} - ${recentOrderCount + 1} поръчки за ${securitySettings.approvalTimeWindowMinutes || 5} минути`,
              url: `/bg/admin/orders?tab=approvals&approval=${order.id}`,
              role: 'ADMIN' // Send only to admins
            })
          });
          
          if (response.ok) {
            console.log('✅ Approval push notification sent to admins');
          }
        } catch (pushError) {
          console.error('Web push failed:', pushError);
          // Don't fail the order creation if push fails
        }

        // Send push notification to staff (informational)
        try {
          const { buildAppUrl } = await import('@/lib/app-url');
          const response = await fetch(buildAppUrl('/api/push/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: '⚠️ Поръчка изисква одобрение',
              body: `Маса ${tableNumber} - ${recentOrderCount + 1} поръчки за ${securitySettings.approvalTimeWindowMinutes || 5} минути`,
              url: `/bg/admin/orders?tab=approvals&approval=${order.id}`,
              role: 'STAFF' // Send to staff for information
            })
          });
          
          if (response.ok) {
            console.log('✅ Approval push notification sent to staff');
          }
        } catch (pushError) {
          console.error('Web push to staff failed:', pushError);
          // Don't fail the order creation if push fails
        }

        // Send Pusher notification to admin dashboard
        try {
          const { pusherServer } = await import('@/lib/pusher-server');
          await pusherServer.trigger('admin-channel', 'order-approval-needed', {
            orderId: order.id,
            tableNumber,
            orderCount: recentOrderCount + 1,
            timestamp: new Date().toISOString()
          });
        } catch (pusherError) {
          console.log('Pusher notification skipped:', pusherError);
          // Don't fail the order creation if Pusher fails
        }
      } catch (approvalError: any) {
        // If table doesn't exist (P2021), log and continue without approval
        if (approvalError.code === 'P2021') {
          console.log('PendingOrderApproval table does not exist yet, skipping approval creation');
        } else {
          console.error('Failed to create pending approval:', approvalError);
        }
        // If approval creation fails, log but don't fail the order
        // The order is already created, so we continue
      }
    }

    // Get full order with items for notification
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true }
    });

    // Only send notifications to staff if order does NOT require approval
    if (!requiresApproval) {
      // Send real-time notification to staff (optional)
      try {
        const { pusherServer } = await import('@/lib/pusher-server');
        
        // Convert Decimal to Number for proper JSON serialization
        const orderData = {
          id: order.id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          status: order.status,
          totalBgn: Number(order.totalBgn),
          totalEur: Number(order.totalEur),
          createdAt: order.createdAt.toISOString(),
          items: fullOrder?.items.map(item => ({
            id: item.id,
            productName: item.productName,
            quantity: item.quantity,
            priceBgn: Number(item.priceBgn),
            priceEur: Number(item.priceEur),
          })) || []
        };
        
        await pusherServer.trigger('staff-channel', 'new-order', orderData);
      } catch (pusherError) {
        console.log('Pusher notification skipped:', pusherError);
        // Order still created, just no real-time notification
      }

      // Send Web Push notification (works even when app closed!)
      try {
        const { buildAppUrl } = await import('@/lib/app-url');
        const response = await fetch(buildAppUrl('/api/push/send'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `🔔 Нова поръчка #${order.orderNumber}`,
            body: `Маса ${tableNumber} - ${items.length} артикула - €${bgnToEur(Number(totalBgn)).toFixed(2)} (${Number(totalBgn).toFixed(2)} лв.)`,
            url: '/bg/staff'
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Web push sent to ${result.sent} devices`);
        }
      } catch (pushError) {
        console.error('Web push failed:', pushError);
        // Continue even if push fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      order: fullOrder,
      orderNumber: order.orderNumber,
      requiresApproval: requiresApproval || false,
      orderId: order.id,
      approvalConfig: {
        threshold: approvalThreshold,
        windowMinutes: securitySettings.approvalTimeWindowMinutes || 5,
        autoRejectMinutes: securitySettings.autoRejectMinutes || 30
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create order error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Return more detailed error for debugging
    return NextResponse.json({ 
      error: 'Failed to create order',
      details: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}


