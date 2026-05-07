import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getOrCreateBrandAppearanceSettings,
  updateBrandAppearanceSettings,
} from '@/lib/brand-appearance-settings';

export async function GET() {
  try {
    const settings = await getOrCreateBrandAppearanceSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (e) {
    console.error('GET brand-appearance error:', e);
    return NextResponse.json({ error: 'Failed to load brand appearance' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (session.user as any)?.role;
    if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const settings = await updateBrandAppearanceSettings(body ?? {});
    return NextResponse.json({ settings }, { status: 200 });
  } catch (e) {
    console.error('PUT brand-appearance error:', e);
    return NextResponse.json({ error: 'Failed to update brand appearance' }, { status: 500 });
  }
}

