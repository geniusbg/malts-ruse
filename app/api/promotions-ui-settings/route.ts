import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getPromotionsUiSettings, updatePromotionsUiSettings } from '@/lib/promotions-ui-settings';

// GET promotions UI settings (public)
export async function GET() {
  try {
    const settings = await getPromotionsUiSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get promotions UI settings error:', error);
    return NextResponse.json({ error: 'Failed to get promotions UI settings' }, { status: 500 });
  }
}

// PUT promotions UI settings (admin only)
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
    const settings = await updatePromotionsUiSettings(data);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Update promotions UI settings error:', error);
    return NextResponse.json({ error: 'Failed to update promotions UI settings' }, { status: 500 });
  }
}

