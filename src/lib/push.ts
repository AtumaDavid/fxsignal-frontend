import { notificationsApi } from './api';

/** Browser push needs a service worker, the Push API and Notification permission. */
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function keyBytes(base64Url: string) {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

/** The push subscription for this browser, if any. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe this browser and register it with the API. */
export async function enablePush(vapidPublicKey: string) {
  if (!pushSupported())
    throw new Error('This browser does not support push notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error(
      'Notifications are blocked for this site. Allow them in the browser settings.'
    );
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(vapidPublicKey),
    }));
  await notificationsApi.subscribe(sub.toJSON());
}

/** Remove this browser's subscription. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await notificationsApi.unsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}
