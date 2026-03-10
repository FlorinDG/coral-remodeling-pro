"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/time-tracker/contexts/ThemeContext';

interface UserPreferences {
  id: string;
  user_id: string;
  language: string;
  theme: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const { setTheme } = useTheme();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserPreferences | null;
    },
    enabled: !!user?.id,
  });

  // Sync language when preferences load
  useEffect(() => {
    if (preferences?.language && preferences.language !== i18n.language) {
      i18n.changeLanguage(preferences.language);
    }
  }, [preferences?.language, i18n]);

  // Sync theme when preferences load
  useEffect(() => {
    if (preferences?.theme) {
      setTheme(preferences.theme as 'light' | 'dark' | 'auto');
    }
  }, [preferences?.theme, setTheme]);

  const upsertPreferences = useMutation({
    mutationFn: async (updates: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('user_preferences')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('user_preferences')
          .insert({ user_id: user.id, ...updates })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences', user?.id] });
    },
  });

  const updateLanguage = async (language: string) => {
    await i18n.changeLanguage(language);
    return upsertPreferences.mutateAsync({ language });
  };

  const updateTheme = async (theme: string) => {
    setTheme(theme as 'light' | 'dark' | 'auto');
    return upsertPreferences.mutateAsync({ theme });
  };

  const updateTimezone = async (timezone: string) => {
    return upsertPreferences.mutateAsync({ timezone });
  };

  return {
    preferences,
    isLoading,
    updateLanguage,
    updateTheme,
    updateTimezone,
    isUpdating: upsertPreferences.isPending,
  };
}
