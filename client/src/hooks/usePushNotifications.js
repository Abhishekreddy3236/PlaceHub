import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    let supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    // Apple only allows Web Push when the application is installed as a Home Screen PWA.
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;

    // Prevent broken notification prompts in standard Safari tabs
    if (isIOS && !isStandalone) {
      supported = false;
    }

    // Restrict to mobile devices only
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobileUA = /Mobi/i.test(navigator.userAgent);
    const mobilePushSupported = isIOS || isAndroid || isMobileUA;

    if (!mobilePushSupported) {
      supported = false;
    }

    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!isSupported) return false;

    setIsSubscribing(true);
    try {
      let currentPerm = Notification.permission;

      if (currentPerm === 'default') {
        // 1. Request Browser Permission (explicit user action required)
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // 2. Wait for Service Worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // 3. Check for existing subscription to prevent duplicates
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // 4. Create new subscription
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) {
          throw new Error('VAPID public key not found in environment');
        }

        const applicationServerKey = urlBase64ToUint8Array(publicVapidKey);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // 5. Send to backend
      await api.post('/notifications/subscribe', {
        provider: 'webpush',
        deviceType: 'browser',
        token: subscription.toJSON(),
        deviceMetadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      });

      return true;
    } catch (error) {
      console.error('[Push Notifications] Subscription failed:', error);
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribing,
    subscribeToPush
  };
}
