// @ts-ignore - web-push doesn't have official types
import webpush from 'web-push';

// Configure VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

console.log('🔑 VAPID Configuration:');
console.log('  Public key:', vapidPublicKey ? '✅ Present' : '❌ MISSING');
console.log('  Private key:', vapidPrivateKey ? '✅ Present' : '❌ MISSING');

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:info@theme-ruse.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('✅ Web Push configured successfully!');
} else {
  console.error('❌ VAPID keys missing! Push notifications will NOT work!');
  console.error('   Add to .env:');
  console.error('   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...');
  console.error('   VAPID_PRIVATE_KEY=...');
}

export { webpush };

// Helper to send push to all subscribed devices
export async function sendPushToAll(
  subscriptions: any[],
  payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
  }
) {
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify(payload)
        );
        return { success: true, staffId: sub.staffId };
      } catch (error: any) {
        // Handle expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Subscription expired for staff ${sub.staffId}`);
          return { success: false, expired: true, staffId: sub.staffId };
        }
        throw error;
      }
    })
  );

  return results;
}

