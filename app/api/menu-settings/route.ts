import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getMenuSettings, updateMenuSettings } from '@/lib/menu-settings';

// GET - Public endpoint to fetch menu settings
export async function GET() {
  try {
    const settings = await getMenuSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    console.error('Get menu settings error:', error);
    return NextResponse.json({ error: 'Failed to get menu settings' }, { status: 500 });
  }
}

// PUT - Admin only endpoint to update menu settings
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const updated = await updateMenuSettings({
      titleBg: data?.titleBg,
      titleEn: data?.titleEn,
      titleRo: data?.titleRo,
      titleColor: data?.titleColor ?? null,
      subtitleBg: data?.subtitleBg,
      subtitleEn: data?.subtitleEn,
      subtitleRo: data?.subtitleRo,
      subtitleColor: data?.subtitleColor ?? null,
      backgroundImageUrl: data?.backgroundImageUrl,
    });

    return NextResponse.json({ settings: updated }, { status: 200 });
  } catch (error) {
    console.error('Update menu settings error:', error);
    return NextResponse.json({ error: 'Failed to update menu settings' }, { status: 500 });
  }
}

