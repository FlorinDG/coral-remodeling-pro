"use client";

export async function translateToEnglish(text: string, sourceLanguage?: string): Promise<string> {
  if (!text.trim()) return text;
  
  // If already English, return as-is
  if (sourceLanguage === 'en') return text;
  
  // Note: Translation has been temporarily disabled during migration
  // Will be re-implemented via a Server Action or internal API route
  console.log('Stub: translation to english disabled during migration. Returning original text.');
  return text;
}
