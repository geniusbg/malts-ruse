import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: Request) {
  try {
    // Get current user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const data = await request.json();
    const { subscription, deviceName, userAgent } = data;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Extract keys from subscription
    const keys = subscription.keys;
    
    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint }
    });

    if (existing) {
      // Update last used and ensure userId is set
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId: userId, // Ensure user is linked
          lastUsed: new Date(),
          isActive: true
        }
      });
      
      console.log('✅ Push subscription updated for user:', userId);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Subscription updated',
        subscriptionId: existing.id 
      });
    }

    // Create new subscription with userId
    const newSubscription = await prisma.pushSubscription.create({
      data: {
        userId: userId,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceName: deviceName || null,
        userAgent: userAgent || null,
        isActive: true
      }
    });

    console.log('✅ New push subscription created for user:', userId, 'subscription:', newSubscription.id);

    return NextResponse.json({ 
      success: true,
      message: 'Subscribed successfully',
      subscriptionId: newSubscription.id
    });

  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

// Unsubscribe
export async function DELETE(request: Request) {
  try {
    const { endpoint } = await request.json();

    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}

