import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TABLE_SESSION_COOKIE_NAME, TableSessionInvalidReason, validateTableSession } from '@/lib/table-sessions';
import { getDefaultBrandId } from '@/lib/brand';

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
    console.log('📞 Waiter call API called');
    const body = await request.json();
    console.log('Body:', body);
    
    const { callType, message } = body;
    if (!callType) {
      console.log('❌ Invalid data');
      return NextResponse.json({ error: 'Invalid call data' }, { status: 400 });
    }

    const sessionToken = request.cookies.get(TABLE_SESSION_COOKIE_NAME)?.value || body.sessionToken;
    const validation = await validateTableSession(sessionToken);
    if (!validation.valid) {
      console.log('❌ Invalid session for waiter call:', validation.reason);
      return buildInvalidSessionResponse(validation.reason);
    }

    const tableNumber = validation.session.tableNumber;
    const bodyTableNumber = parseInt(body.tableNumber || '0');
    if (bodyTableNumber && bodyTableNumber !== tableNumber) {
      console.warn(`Waiter call: table mismatch (cookie ${tableNumber}, body ${bodyTableNumber})`);
    }

    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    if (ops && !ops.waiterCallEnabled) {
      return NextResponse.json(
        { error: 'Повикването на сервитьор е временно изключено.' },
        { status: 403 }
      );
    }

    const barTable = await prisma.barTable.findFirst({
      where: { brandId, tableNumber, isActive: true },
    });
    if (!barTable) {
      return NextResponse.json({ error: 'Невалидна маса' }, { status: 400 });
    }

    console.log('💾 Creating waiter call in DB...');
    const waiterCall = await prisma.waiterCall.create({
      data: {
        brandId,
        tableId: barTable.id,
        tableNumber,
        callType,
        message: message || null,
        status: 'pending',
      },
    });
    console.log('✅ Waiter call created:', waiterCall.id);

    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      await pusherServer.trigger('staff-channel', 'waiter-call', {
        callId: waiterCall.id,
        tableNumber: waiterCall.tableNumber,
        callType: waiterCall.callType,
        message: waiterCall.message,
        timestamp: waiterCall.createdAt.toISOString(),
        urgent: callType.includes('payment')
      });
    } catch (pusherError) {
      console.log('Pusher notification skipped:', pusherError);
    }

    try {
      const icon = callType.includes('payment') ? '💰' : '🆘';
      const typeText = callType === 'payment_cash' ? 'Плащане с брой' :
                      callType === 'payment_card' ? 'Плащане с карта' : 
                      'Нужна помощ';
      
      const { buildAppUrl } = await import('@/lib/app-url');
      await fetch(buildAppUrl('/api/push/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${icon} Повикване от Маса ${tableNumber}`,
          body: typeText,
          url: '/bg/staff',
          tableId: barTable.id,
          tableNumber
        })
      });
      console.log('✅ Web push sent for waiter call');
    } catch (pushError) {
      console.error('Web push failed:', pushError);
    }

    return NextResponse.json({ 
      success: true, 
      call: waiterCall
    }, { status: 201 });

  } catch (error: any) {
    console.error('Waiter call error:', error);
    return NextResponse.json({ 
      error: 'Failed to call waiter',
      details: error.message 
    }, { status: 500 });
  }
}

// Get all waiter calls for today
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const brandId = await getDefaultBrandId();

    const calls = await prisma.waiterCall.findMany({
      where: {
        brandId,
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Get calls error:', error);
    return NextResponse.json({ error: 'Failed to get calls' }, { status: 500 });
  }
}


