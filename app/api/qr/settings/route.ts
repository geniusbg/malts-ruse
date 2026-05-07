import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDefaultBrandId } from '@/lib/brand';

// Get QR code settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = session.user as { role?: string };

    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brandId = await getDefaultBrandId();
    const settingsRecord = await prisma.qRCodeSettings.findUnique({
      where: { brandId },
    });

    if (settingsRecord) {
      return NextResponse.json({
        success: true,
        settings: settingsRecord.settings,
      });
    }

    return NextResponse.json({
      success: true,
      settings: null,
    });
  } catch (error) {
    console.error('Error fetching QR code settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Save QR code settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = session.user as { role?: string };

    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { settings } = await request.json();

    if (!settings) {
      return NextResponse.json({ error: 'Settings are required' }, { status: 400 });
    }

    const brandId = await getDefaultBrandId();

    await prisma.qRCodeSettings.upsert({
      where: { brandId },
      update: { settings },
      create: { brandId, settings },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving QR code settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
