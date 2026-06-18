'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

// Central store for UI preferences kept in localStorage, scoped by user ID
export function useUserPreferences<T>(key: string, defaultValue: T): [T, (val: T | ((prev: T) => T)) => void] {
    const { data: session } = useSession();
    const userId = (session?.user as any)?.id || 'anonymous';
    
    // Prefix with user ID to ensure "per-user" scoping on shared devices
    const storageKey = `coral_prefs_${userId}_${key}`;

    const [storedValue, setStoredValue] = useState<T>(defaultValue);

    // Load from local storage after mount
    useEffect(() => {
        try {
            const item = window.localStorage.getItem(storageKey);
            if (item) {
                setStoredValue(JSON.parse(item));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key "${storageKey}":`, error);
        }
    }, [storageKey]);

    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${storageKey}":`, error);
        }
    }, [storageKey, storedValue]);

    return [storedValue, setValue];
}
