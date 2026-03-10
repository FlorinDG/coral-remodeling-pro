"use client";
import { supabase } from '@/components/time-tracker/integrations/supabase/client';

export async function translateToEnglish(text: string, sourceLanguage?: string): Promise<string> {
  if (!text.trim()) return text;
  
  // If already English, return as-is
  if (sourceLanguage === 'en') return text;
  
  try {
    const { data, error } = await supabase.functions.invoke('translate-text', {
      body: { text, targetLanguage: 'en', sourceLanguage },
    });
    
    if (error) {
      console.error('Translation error:', error);
      return text; // Return original if translation fails
    }
    
    return data.translatedText || text;
  } catch (err) {
    console.error('Translation service error:', err);
    return text;
  }
}
