"use client";
import { useState, useCallback } from 'react';

/**
 * User Preferences — local state scaffold.
 * Will use tenant user settings in a future iteration.
 */

export interface UserPreference {
  theme: string;
  language: string;
  timezone: string;
}

const DEFAULT_PREFS: UserPreference = {
  theme: 'system',
  language: 'nl',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels',
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreference>(DEFAULT_PREFS);

  const updatePreference = useCallback(async (key: keyof UserPreference, value: string) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    return { error: null };
  }, []);

  return {
    preferences,
    isLoading: false,
    updateTheme: (theme: string) => updatePreference('theme', theme),
    updateLanguage: (language: string) => updatePreference('language', language),
    updateTimezone: (timezone: string) => updatePreference('timezone', timezone),
  };
}
