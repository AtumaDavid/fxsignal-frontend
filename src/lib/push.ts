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

/**
 * Registers the service worker at startup, so an installed app (and the
 * iPhone Home Screen app) always has it for push.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

async function registration() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

/** iPhone / iPad (iPadOS reports itself as a Mac with touch). */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Opened from the Home Screen / as an installed app. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Browsers inside other apps (Instagram, Facebook, …) have no push. */
function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat/i.test(
    navigator.userAgent
  );
}

export type PushBlocker = 'ios-install' | 'in-app' | 'unsupported' | 'denied';

/** Why push can't be turned on here, or null when it can. */
export function pushBlocker(): PushBlocker | null {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (isInAppBrowser()) return 'in-app';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return null;
}

// ---- Install prompt (Android / desktop Chrome) ------------------------------

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstall: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // show our own button instead of the mini-bar
    deferredInstall = event as InstallPromptEvent;
    installListeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    installListeners.forEach((fn) => fn());
  });
}

/** True when the browser offers to install the app right now. */
export function canInstall() {
  return deferredInstall !== null;
}

export function onInstallChange(fn: () => void) {
  installListeners.add(fn);
  return () => {
    installListeners.delete(fn);
  };
}

/** Shows the browser's install dialog; resolves true when accepted. */
export async function installApp() {
  if (!deferredInstall) return false;
  const event = deferredInstall;
  deferredInstall = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  installListeners.forEach((fn) => fn());
  return outcome === 'accepted';
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
    throw new Error(
      isIOS()
        ? 'On iPhone, add FXSignal to the Home Screen and open it from there first.'
        : 'This browser does not support push notifications.'
    );
  // Asked straight from the tap: iPhone ignores requests that aren't.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in the browser settings, then try again.'
        : 'Notifications were not allowed. Tap the switch again and choose Allow.'
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
