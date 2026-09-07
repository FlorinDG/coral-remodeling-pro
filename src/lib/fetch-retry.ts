/**
 * Idempotent retry wrapper for read-only fetches.
 * Only use this for GET requests or strictly idempotent operations.
 * Do not wrap mutations (POST, PATCH, DELETE) to avoid duplicate records on connection loss.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        const isNetworkError = 
            error.name === 'TypeError' || 
            error.message?.toLowerCase().includes('fetch') || 
            error.message?.toLowerCase().includes('load failed') ||
            error.name === 'NetworkError' ||
            error.name === 'AbortError';

        if (retries > 0 && isNetworkError) {
            console.warn(`[fetch-retry] Transient network error detected, retrying in ${delayMs}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return withRetry(fn, retries - 1, delayMs * 2);
        }
        
        throw error;
    }
}
