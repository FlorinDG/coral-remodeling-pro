import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import enMessages from '../messages/en.json';

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
        locale = routing.defaultLocale;
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
        getMessageFallback({ namespace, key, error }) {
            const path = namespace ? `${namespace}.${key}` : key;
            if (error.code === 'MISSING_MESSAGE') {
                const enStr = path.split('.').reduce((obj: any, k: string) => (obj || {})[k], enMessages);
                if (typeof enStr === 'string') return enStr;
                return path;
            }
            return path;
        }
    };
});
