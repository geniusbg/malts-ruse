import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getOrCreateLoadingUiSettings,
  updateLoadingUiSettings,
  type LoadingAsset,
  type LoadingRule,
} from '@/lib/loading-ui-settings';

export async function GET() {
  try {
    const settings = await getOrCreateLoadingUiSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    console.error('GET loading-ui-settings error:', error);
    return NextResponse.json({ error: 'Failed to get loading settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;
    const defaultAssetId =
      body.defaultAssetId === null || typeof body.defaultAssetId === 'string' ? body.defaultAssetId : undefined;
    const assets: LoadingAsset[] | undefined = Array.isArray(body.assets) ? body.assets : undefined;
    const rules: LoadingRule[] | undefined = Array.isArray(body.rules) ? body.rules : undefined;

    const updated = await updateLoadingUiSettings({ enabled, defaultAssetId, assets, rules });
    return NextResponse.json({ settings: updated }, { status: 200 });
  } catch (error) {
    console.error('PUT loading-ui-settings error:', error);
    return NextResponse.json({ error: 'Failed to update loading settings' }, { status: 500 });
  }
}

