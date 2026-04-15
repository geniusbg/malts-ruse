import { NextResponse } from 'next/server';
import { getLocationSettings, updateLocationSettings } from '@/lib/location-settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET location settings (public - no auth required)
export async function GET() {
  try {
    const settings = await getLocationSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get location settings error:', error);
    return NextResponse.json({ error: 'Failed to get location settings' }, { status: 500 });
  }
}

// PUT location settings (admin only)
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();

    if (!data.addressBg || !data.addressEn || !data.addressRo) {
      return NextResponse.json(
        { error: 'Всички адреси (BG, EN, RO) са задължителни' },
        { status: 400 }
      );
    }

    const settings = await updateLocationSettings({
      addressBg: data.addressBg,
      addressEn: data.addressEn,
      addressRo: data.addressRo,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      instagramUrl: typeof data.instagramUrl === 'string' ? data.instagramUrl : undefined,
      facebookUrl: typeof data.facebookUrl === 'string' ? data.facebookUrl : undefined,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Update location settings error:', error);
    return NextResponse.json({ error: 'Failed to update location settings' }, { status: 500 });
  }
}

