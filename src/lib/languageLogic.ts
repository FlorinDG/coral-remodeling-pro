export function resolveDocumentLanguage(tenantDocLang?: string | null, clientLang?: string | null): string {
    // Return early if tenant language exists and is not empty String
    if (tenantDocLang && tenantDocLang.trim() !== '') {
        return tenantDocLang.toLowerCase();
    }

    // Fall back to client language
    if (clientLang && clientLang.trim() !== '') {
        return clientLang.toLowerCase();
    }

    // Absolute default
    return 'fr';
}
