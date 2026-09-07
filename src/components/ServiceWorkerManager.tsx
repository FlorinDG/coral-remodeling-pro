'use client';

import { useEffect } from 'react';

export function ServiceWorkerManager({ appVersion }: { appVersion: string }) {
    useEffect(() => {
        try {
            const subdomain = window.location.hostname;

            // WorkHub subdomain: register versioned service worker
            if (subdomain.startsWith('work.')) {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw-workhub.js?v=' + appVersion, { scope: '/' })
                        .then((reg) => {
                            console.log('[WorkHub] SW registered, scope:', reg.scope, 'version:', appVersion);
                            
                            const onFocus = () => { reg.update().catch(() => {}); };
                            const onVisibilityChange = () => {
                                if (document.visibilityState === 'visible') {
                                    reg.update().catch(() => {});
                                }
                            };

                            window.addEventListener('focus', onFocus);
                            document.addEventListener('visibilitychange', onVisibilityChange);

                            // Clean up listeners for this registration scope
                            return () => {
                                window.removeEventListener('focus', onFocus);
                                document.removeEventListener('visibilitychange', onVisibilityChange);
                            };
                        })
                        .catch((err) => {
                            console.warn('[WorkHub] SW registration failed:', err);
                        });

                    const onControllerChange = () => {
                        console.log('[WorkHub] New SW controller — reloading for fresh assets');
                        window.location.reload();
                    };
                    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

                    return () => {
                        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                    };
                }
                return;
            }

            // Other subdomains: kill stale service workers
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                    regs.forEach((r) => { r.unregister(); });
                });
            }
            // Nuke all Cache API entries on ERP/storefront subdomains
            if (subdomain.startsWith('app.') || subdomain.startsWith('coral-sys.')) {
                if ('caches' in window) {
                    caches.keys().then((keys) => {
                        keys.forEach((key) => { caches.delete(key); });
                    });
                }
            }
        } catch(e) {}
    }, [appVersion]);

    return null;
}
