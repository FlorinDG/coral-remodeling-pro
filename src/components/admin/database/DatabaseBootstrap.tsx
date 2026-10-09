import { getGlobalDatabases, getGlobalDatabaseSchemas, getGlobalPageIndex } from "@/app/actions/global-databases";
import { IS_LAZY_DATA_ENABLED } from "@/lib/feature-flags";
import { prepareTenantDatabases } from "@/lib/data/tenant-databases";
import GlobalDatabaseSyncer from "./GlobalDatabaseSyncer";

/**
 * MOBILE-PERF-1 · the store's server data — the ONE loader for every app shell (admin, the mobile office), rendered
 * under <Suspense> so the shell is on screen before it (Florin 2026-10-09: "go for 1-3"; was a white screen of ~7 s
 * while the layout awaited all of this).
 *
 * `prepare`: run the system-database preparation here (the mobile office — its shell takes the tenant's stored
 * bindings). Without it the layout prepared already (admin — its shell needs the bindings checked first).
 * The schemas and the page index don't depend on each other: read in parallel. One timing line per load, so the
 * next step (R2-4: index + working set) is decided on measurements.
 */
export default async function DatabaseBootstrap({ tenantId, userId, prepare, label }: {
    tenantId: string;
    userId: string | null | undefined;
    prepare?: { planType: string; activeModules: string[] };
    label: string;
}) {
    const t0 = performance.now();
    const ms: Record<string, number | undefined> = {};
    if (prepare) {
        try {
            const prepared = await prepareTenantDatabases(prepare);
            if (prepared) Object.assign(ms, prepared.ms);
        } catch (e) {
            console.error(`[${label}/data] preparing databases failed:`, e);
        }
    }
    const s = performance.now();
    const [databases, pageIndex] = await Promise.all([
        (IS_LAZY_DATA_ENABLED ? getGlobalDatabaseSchemas() : getGlobalDatabases())
            .then(r => { ms.databases = Math.round(performance.now() - s); return r; })
            .catch(e => { console.error(`[${label}/data] database fetch failed:`, e); return []; }),
        getGlobalPageIndex()
            .then(r => { ms.pageIndex = Math.round(performance.now() - s); return r; })
            .catch(e => { console.error(`[${label}/data] page index failed:`, e); return []; }),
    ]);
    const pages = databases.reduce((n, d) => n + (d.pages?.length || 0), 0);
    console.info(`[${label}/data] tenant=${tenantId} total=${Math.round(performance.now() - t0)}ms ${JSON.stringify(ms)} lazy=${IS_LAZY_DATA_ENABLED} databases=${databases.length} pages=${pages} index=${pageIndex.length}`);
    return <GlobalDatabaseSyncer databases={databases} pageIndex={pageIndex} tenantId={tenantId} userId={userId ?? null} />;
}
