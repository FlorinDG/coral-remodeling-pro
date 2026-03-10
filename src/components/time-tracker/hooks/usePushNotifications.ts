"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

// This should match your VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'default';
  loading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    loading: true,
    error: null,
  });

  // Check if push notifications are supported
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  // Convert VAPID key from base64 to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
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

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!isSupported || !user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setState(prev => ({
        ...prev,
        isSupported: true,
        isSubscribed: !!subscription,
        permission: Notification.permission,
        loading: false,
      }));
    } catch (error) {
      console.error('Error checking subscription:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check notification status',
      }));
    }
  }, [isSupported, user]);

  // Register service worker
  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  };

  // Subscribe to push notifications
  const subscribe = async (): Promise<boolean> => {
    if (!isSupported || !user) {
      setState(prev => ({ ...prev, error: 'Push notifications not supported' }));
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          permission,
          loading: false,
          error: 'Notification permission denied',
        }));
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subscriptionJson = subscription.toJSON();

      // Save subscription to database
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth,
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (dbError) {
        throw dbError;
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        permission: 'granted',
        loading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }));
      return false;
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async (): Promise<boolean> => {
    if (!isSupported || !user) {
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        loading: false,
      }));

      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (isSupported) {
      registerServiceWorker().then(() => {
        checkSubscription();
      });
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [checkSubscription, isSupported]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}
