"use client";
import { useState, useCallback } from 'react';

/**
 * Push Notifications — scaffold.
 * No-op for now since we don't have a push service configured.
 */

export function usePushNotifications() {
  const [isSubscribed] = useState(false);
  const [isSupported] = useState(false);

  const subscribe = useCallback(async () => {
    console.log('[PushNotifications] subscribe — scaffold, no-op');
    return { error: null };
  }, []);

  const unsubscribe = useCallback(async () => {
    console.log('[PushNotifications] unsubscribe — scaffold, no-op');
    return { error: null };
  }, []);

  return {
    isSubscribed,
    isSupported,
    subscribe,
    unsubscribe,
    loading: false,
  };
}
