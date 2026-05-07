import { NextResponse } from 'next/server';
import { getSecuritySettings, updateSecuritySettings, DEFAULT_SECURITY_SETTINGS } from '@/lib/security-settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

function sanitizeNumber(value: any, fallback: number, min = 1, max = 100000): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET() {
  const settings = await getSecuritySettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const approvalOrderThreshold = sanitizeNumber(
    body.approvalOrderThreshold,
    DEFAULT_SECURITY_SETTINGS.approvalOrderThreshold,
    1,
    50
  );

  const approvalTimeWindowMinutes = sanitizeNumber(
    body.approvalTimeWindowMinutes,
    DEFAULT_SECURITY_SETTINGS.approvalTimeWindowMinutes,
    1,
    120
  );

  const sessionDurationHours = sanitizeNumber(
    body.sessionDurationHours,
    DEFAULT_SECURITY_SETTINGS.sessionDurationHours,
    1,
    24
  );

  const autoRejectMinutes = sanitizeNumber(
    body.autoRejectMinutes,
    DEFAULT_SECURITY_SETTINGS.autoRejectMinutes,
    5,
    240
  );

  const updated = await updateSecuritySettings({
    id: body.id,
    approvalOrderThreshold,
    approvalTimeWindowMinutes,
    sessionDurationHours,
    autoRejectMinutes
  });

  return NextResponse.json({ settings: updated });
}


