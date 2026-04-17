import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { completeGoogleDriveOauthCallback } from '@/lib/backup-google';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  let ok = false;
  let message = 'OAuth callback failed';
  try {
    const result = await completeGoogleDriveOauthCallback(prisma, {
      code: query.code,
      state: query.state,
      error: query.error,
      error_description: query.error_description,
    });
    ok = !!result.ok;
    message = result.message || (ok ? 'Connected' : message);
  } catch (e: unknown) {
    message = e instanceof Error ? e.message : String(e);
  }

  const payload = JSON.stringify({
    type: 'malts_google_drive_oauth_result',
    ok,
    message,
  });

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Google Drive</title></head>
<body>
<script>
  (function () {
    var payload = ${payload};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
      }
    } catch (e) {}
    setTimeout(function(){ window.close(); }, 80);
  })();
</script>
<p>${ok ? 'Google Drive connected.' : 'Google Drive connection failed.'}</p>
</body>
</html>`;

  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
