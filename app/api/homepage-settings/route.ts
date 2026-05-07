import { NextResponse } from 'next/server';
import { getHomepageSettings, updateHomepageSettings, getHomepageOfferingCards } from '@/lib/homepage-settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// GET homepage settings (public - no auth required)
export async function GET() {
  try {
    const [settings, cards] = await Promise.all([
      getHomepageSettings(),
      getHomepageOfferingCards()
    ]);
    return NextResponse.json({ settings, cards });
  } catch (error) {
    console.error('Get homepage settings error:', error);
    return NextResponse.json({ error: 'Failed to get homepage settings' }, { status: 500 });
  }
}

// PUT homepage settings (admin only)
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
    const settings = await updateHomepageSettings(data);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Update homepage settings error:', error);
    return NextResponse.json({ error: 'Failed to update homepage settings' }, { status: 500 });
  }
}

