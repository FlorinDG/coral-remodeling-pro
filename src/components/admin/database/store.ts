import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';
import { Database, Page, Property, PropertyType, PropertyConfig, FilterRule, SortRule, Block, DatabaseView, ViewPropertyState } from './types';
import { saveGlobalDatabase, saveGlobalPage, saveGlobalPagesBatch, deleteGlobalDatabase, deleteGlobalPage } from '@/app/actions/global-databases';

// Helper to fire-and-forget syncs to Postgres without blocking UI
const syncDb = (db: Database | undefined) => {
    if (db) saveGlobalDatabase(db).catch(console.error);
};

/**
 * Helper to check if a database ID matches a "base" ID (e.g. 'db-invoices').
 * Handles both bare IDs and scoped IDs (e.g. 'db-invoices-abc12345').
 */
const isBaseDb = (id: string, base: string) => {
    return id === base || id.startsWith(base + '-');
};

/**
 * Save a page to Postgres. If the parent DB is provided and may not yet exist
 * in Postgres (first-session race for locked DBs like db-expenses), we upsert
 * the DB first to satisfy the foreign-key constraint, then save the page.
 * Tracks sync status in the store for the UI badge.
 */
const syncPage = (page: Page | undefined, parentDb?: Database) => {
    if (!page) return;
    const store = useDatabaseStore.getState();
    store._syncStart();

    const doSave = () => saveGlobalPage(page)
        .then(result => {
            if (result?.success === false) {
                console.warn('[syncPage] Server rejected page save:', result.error);
                // Retry once after 3s
                setTimeout(() => saveGlobalPage(page)
                    .then(() => store._syncDone())
                    .catch(() => store._syncError()), 3000);
            } else {
                store._syncDone();
            }
        })
        .catch(() => store._syncError());

    if (parentDb) {
        saveGlobalDatabase(parentDb).then(doSave).catch(doSave);
    } else {
        doSave();
    }
};

/**
 * Batch sync multiple pages to Postgres using the batch server action.
 * Used by addPages() during CSV import to avoid 2000+ individual server action calls.
 */
const syncPagesBatch = (pages: Page[], parentDb?: Database) => {
    if (!pages.length) return;
    const store = useDatabaseStore.getState();
    store._syncStart();

    const doSave = () => saveGlobalPagesBatch(pages)
        .then(result => {
            if (result?.success === false) {
                console.warn('[syncPagesBatch] Server rejected batch save:', result.error);
                store._syncError();
            } else {
                store._syncDone();
            }
        })
        .catch(() => store._syncError());

    if (parentDb) {
        saveGlobalDatabase(parentDb).then(doSave).catch(doSave);
    } else {
        doSave();
    }
};

// Custom IndexedDB storage object to bypass the 5MB browser localStorage limit
const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        let value = await get(name);
        // Silent migration: if IndexedDB is empty but legacy data exists, instantly rescue it over
        if (!value) {
            value = localStorage.getItem(name);
            if (value) {
                await set(name, value);
            }
        }
        return value || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
        localStorage.removeItem(name); // Cleanup legacy trace
    },
};

interface DatabaseState {
    databases: Database[];
    hydrateDatabases: (databases: Database[]) => void;

    // Sync status (for UI indicators)
    syncStatus: 'idle' | 'saving' | 'error';
    pendingSyncs: number;
    _syncStart: () => void;
    _syncDone: () => void;
    _syncError: () => void;

    // Database Operations
    createDatabase: (name: string, description?: string, specificId?: string, properties?: Property[]) => Database;
    updateDatabase: (id: string, updates: Partial<Database>) => void;
    deleteDatabase: (id: string) => void;
    getDatabase: (id: string) => Database | undefined;
    clearDatabase: (databaseId: string) => void;

    // View Operations
    addView: (databaseId: string, view: Omit<DatabaseView, 'id'>) => void;
    updateView: (databaseId: string, viewId: string, updates: Partial<DatabaseView>) => void;
    updateViewPropertyState: (databaseId: string, viewId: string, propertyId: string, updates: Partial<ViewPropertyState>) => void;
    updateViewPropertyOrder: (databaseId: string, viewId: string, sourceIndex: number, destinationIndex: number) => void;
    deleteView: (databaseId: string, viewId: string) => void;

    // Property Operations
    addProperty: (databaseId: string, name: string, type: PropertyType, config?: PropertyConfig) => string;
    updateProperty: (databaseId: string, propertyId: string, updates: Partial<Property>) => void;
    deleteProperty: (databaseId: string, propertyId: string) => void;
    updatePropertyOrder: (databaseId: string, sourceIndex: number, destinationIndex: number) => void;

    // Page (Row) Operations
    createPage: (databaseId: string, initialProperties?: Record<string, any>, customId?: string) => Page;
    /** Add a page that was already confirmed by the server (e.g. from /api/scan or createPageServerFirst) */
    addConfirmedPage: (page: Page) => void;
    addPages: (databaseId: string, pagesProperties: Record<string, any>[]) => void;
    updatePageProperty: (databaseId: string, pageId: string, propertyId: string, value: any) => void;
    updatePageBlocks: (databaseId: string, pageId: string, blocks: Block[]) => void;
    deletePage: (databaseId: string, pageId: string) => void;
    deletePages: (databaseId: string, pageIds: string[]) => void;
    updatePageOrder: (databaseId: string, sourceIndex: number, destinationIndex: number) => void;
    updatePageDriveId: (databaseId: string, pageId: string, driveId: string) => void;

    // Filter Operations
    addFilter: (databaseId: string, viewId: string | null | undefined, filter: Omit<FilterRule, 'id'>) => void;
    updateFilter: (databaseId: string, viewId: string | null | undefined, filterId: string, updates: Partial<FilterRule>) => void;
    removeFilter: (databaseId: string, viewId: string | null | undefined, filterId: string) => void;
    clearFilters: (databaseId: string, viewId: string | null | undefined) => void;

    // Sort Operations
    addSort: (databaseId: string, viewId: string | null | undefined, sort: Omit<SortRule, 'id'>) => void;
    updateSort: (databaseId: string, viewId: string | null | undefined, sortId: string, updates: Partial<SortRule>) => void;
    removeSort: (databaseId: string, viewId: string | null | undefined, sortId: string) => void;
    clearSorts: (databaseId: string, viewId: string | null | undefined) => void;
}

export const useDatabaseStore = create<DatabaseState>()(
    persist(
        (set, get) => ({
            databases: [],
            syncStatus: 'idle' as const,
            pendingSyncs: 0,

            _syncStart: () => set(s => ({ pendingSyncs: s.pendingSyncs + 1, syncStatus: 'saving' as const })),
            _syncDone: () => set(s => {
                const next = s.pendingSyncs - 1;
                return { pendingSyncs: Math.max(0, next), syncStatus: next <= 0 ? 'idle' as const : 'saving' as const };
            }),
            _syncError: () => set(s => ({
                pendingSyncs: Math.max(0, s.pendingSyncs - 1),
                syncStatus: 'error' as const
            })),

            hydrateDatabases: (serverDatabases) => {
                set({ databases: serverDatabases });
            },

            createDatabase: (name, description, specificId, properties) => {
                const newDatabase: Database = {
                    id: specificId || uuidv4(),
                    name,
                    description: description || null,
                    properties: properties || [
                        { id: 'title', name: 'Name', type: 'text' } // Every DB needs a Title
                    ],
                    pages: [],
                    views: [
                        { id: uuidv4(), name: 'Default View', type: 'table' } // Initialize with tabular view
                    ],
                    activeFilters: [],
                    activeSorts: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ownerId: 'current-user-fallback' // In a real app, this comes from AuthContext
                };

                set((state) => ({ databases: [...state.databases, newDatabase] }));
                syncDb(newDatabase);
                return newDatabase;
            },

            updateDatabase: (id, updates) => {
                set((state) => ({
                    databases: state.databases.map(db =>
                        db.id === id ? { ...db, ...updates, updatedAt: new Date().toISOString() } : db
                    )
                }));
                syncDb(get().databases.find(d => d.id === id));
            },

            deleteDatabase: (id) => {
                set((state) => ({
                    databases: state.databases.filter(db => db.id !== id)
                }));
                deleteGlobalDatabase(id).catch(console.error);
            },

            clearDatabase: (databaseId) => {
                // Capture page IDs before clearing locally
                const db = get().databases.find(d => d.id === databaseId);
                const pageIds = db?.pages.map((p: Page) => p.id) || [];

                set((state) => ({
                    databases: state.databases.map(d =>
                        d.id === databaseId
                            ? { ...d, pages: [] }
                            : d
                    )
                }));

                // Propagate each deletion to Prisma
                pageIds.forEach((pid: string) => deleteGlobalPage(pid).catch(console.error));
            },

            getDatabase: (id) => {
                return get().databases.find(db => db.id === id);
            },

            // --- VIEW OPERATIONS ---

            addView: (databaseId, view) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id === databaseId) {
                            const newView: DatabaseView = { ...view, id: uuidv4() };
                            return { ...db, views: [...(db.views || []), newView] };
                        }
                        return db;
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            updateView: (databaseId, viewId, updates) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id === databaseId && db.views) {
                            return {
                                ...db,
                                views: db.views.map((view: DatabaseView) => view.id === viewId ? { ...view, ...updates } : view)
                            };
                        }
                        return db;
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            updateViewPropertyState: (databaseId, viewId, propertyId, updates) => set((state) => ({
                databases: state.databases.map(db => {
                    if (db.id === databaseId && db.views) {
                        return {
                            ...db,
                            views: db.views.map((view: DatabaseView) => {
                                if (view.id === viewId) {
                                    const currentState = view.propertiesState || [];
                                    const existingProp = currentState.find(p => p.propertyId === propertyId);

                                    let newPropertiesState;
                                    if (existingProp) {
                                        newPropertiesState = currentState.map(p =>
                                            p.propertyId === propertyId ? { ...p, ...updates } : p
                                        );
                                    } else {
                                        newPropertiesState = [...currentState, { propertyId, ...updates }];
                                    }

                                    return { ...view, propertiesState: newPropertiesState };
                                }
                                return view;
                            })
                        };
                    }
                    return db;
                })
            })),

            updateViewPropertyOrder: (databaseId, viewId, sourceIndex, destinationIndex) => set((state) => ({
                databases: state.databases.map(db => {
                    if (db.id === databaseId && db.views) {
                        return {
                            ...db,
                            views: db.views.map((view: DatabaseView) => {
                                if (view.id === viewId) {
                                    // Ensure we have a baseline array of properties mapping to the DB schema
                                    let currentOrder = view.propertiesState || [];

                                    // If this is the first time dragging, initialize the order array from the raw properties
                                    if (currentOrder.length === 0) {
                                        currentOrder = db.properties.map((p: Property, index: number) => ({
                                            propertyId: p.id,
                                            order: index
                                        }));
                                    }

                                    // Create a new array, splice out the dragged item, and insert it at the destination
                                    const newOrder = Array.from(currentOrder);
                                    const [reorderedItem] = newOrder.splice(sourceIndex, 1);

                                    if (reorderedItem) {
                                        newOrder.splice(destinationIndex, 0, reorderedItem);
                                    }

                                    // Update the explicit 'order' integer on every item for predictable sorting
                                    const finalizedState = newOrder.map((item, index) => ({
                                        ...item,
                                        propertyId: item?.propertyId || '',
                                        order: index
                                    }));

                                    return { ...view, propertiesState: finalizedState };
                                }
                                return view;
                            })
                        };
                    }
                    return db;
                })
            })),

            deleteView: (databaseId, viewId) => set((state) => ({
                databases: state.databases.map(db => {
                    if (db.id === databaseId && db.views) {
                        // Prevent deleting the very last view to maintain UI sanity
                        if (db.views.length <= 1) return db;
                        return { ...db, views: db.views.filter((view: DatabaseView) => view.id !== viewId) };
                    }
                    return db;
                })
            })),

            // Property Operations
            addProperty: (databaseId, name, type, config) => {
                // Schema-locked databases: properties are hardcoded, block any additions
                const LOCKED_PREFIXES = ['db-clients', 'db-suppliers', 'db-invoices', 'db-expenses', 'db-tickets'];
                if (LOCKED_PREFIXES.some(prefix => isBaseDb(databaseId, prefix))) {
                    console.warn(`[Schema Lock] Cannot add property "${name}" to locked database ${databaseId}`);
                    return '';
                }
                const newId = uuidv4();
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        const newProperty: Property = { id: newId, name, type, config };
                        return {
                            ...db,
                            properties: [...db.properties, newProperty],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
                return newId;
            },

            updateProperty: (databaseId, propertyId, updates) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            properties: db.properties.map((p: Property) => p.id === propertyId ? { ...p, ...updates } : p),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            deleteProperty: (databaseId, propertyId) => {
                // Schema-locked databases: properties are hardcoded, block any deletions
                const LOCKED_PREFIXES = ['db-clients', 'db-suppliers', 'db-invoices', 'db-expenses', 'db-tickets'];
                if (LOCKED_PREFIXES.some(prefix => isBaseDb(databaseId, prefix))) {
                    console.warn(`[Schema Lock] Cannot delete property "${propertyId}" from locked database ${databaseId}`);
                    return;
                }
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            properties: db.properties.filter((p: Property) => p.id !== propertyId),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            updatePropertyOrder: (databaseId, sourceIndex, destinationIndex) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        const newProps = Array.from(db.properties);
                        const [reorderedProp] = newProps.splice(sourceIndex, 1);
                        if (reorderedProp) {
                            newProps.splice(destinationIndex, 0, reorderedProp);
                        }
                        return {
                            ...db,
                            properties: newProps,
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            createPage: (databaseId, initialProperties = {}, customId) => {
                let newPage: Page | null = null;

                set((state) => {
                    const db = state.databases.find(d => d.id === databaseId);
                    if (!db) return {};

                    // Initialize all properties defined in the schema to prevent DataSheetGrid from breaking
                    const fullProperties: Record<string, any> = { ...initialProperties };

                    // Custom Auto-Numbering for Quotations (CEO-YYYY-XXX.00)
                    if (isBaseDb(databaseId, 'db-quotations') && !fullProperties['title']) {
                        const year = new Date().getFullYear();
                        let maxNum = 0;
                        db.pages.forEach((p: Page) => {
                            const title = p.properties['title'] as string;
                            if (title && title.startsWith(`CEO-${year}-`)) {
                                const match = title.match(/CEO-\d{4}-(\d+)/);
                                if (match && match[1]) {
                                    const parsed = parseInt(match[1], 10);
                                    if (parsed > maxNum) maxNum = parsed;
                                }
                            }
                        });
                        const nextStr = String(maxNum + 1).padStart(3, '0');
                        fullProperties['title'] = `CEO-${year}-${nextStr}.00`;
                    }

                    // Custom Auto-Numbering for Articles (ART-XX-XXX)
                    if (databaseId === 'db-articles' && !fullProperties['prop-art-id']) {
                        let groupCode = '00';
                        const groupVal = fullProperties['prop-art-group'];
                        if (groupVal === 'opt-ruwbouw') groupCode = '01';
                        else if (groupVal === 'opt-afwerking') groupCode = '02';
                        else if (groupVal === 'opt-elektriciteit') groupCode = '03';
                        else if (groupVal === 'opt-sanitaire') groupCode = '04';
                        else if (groupVal === 'opt-ventilatie') groupCode = '05';
                        else if (groupVal === 'opt-verwarming') groupCode = '06';

                        let maxNum = 0;
                        db.pages.forEach((p: Page) => {
                            const artId = p.properties['prop-art-id'] as string;
                            if (artId && artId.startsWith(`ART-${groupCode}-`)) {
                                const m = artId.match(new RegExp(`ART-${groupCode}-(\\d+)`));
                                if (m && m[1]) {
                                    const parsed = parseInt(m[1], 10);
                                    if (parsed > maxNum) maxNum = parsed;
                                }
                            }
                        });
                        const nextStr = String(maxNum + 1).padStart(4, '0');
                        fullProperties['prop-art-id'] = `ART-${groupCode}-${nextStr}`;
                    }

                    db.properties.forEach((prop: Property) => {
                        if (fullProperties[prop.id] === undefined) {
                            if (prop.type === 'multi_select' || prop.type === 'relation') {
                                fullProperties[prop.id] = [];
                            } else if (prop.type === 'checkbox') {
                                fullProperties[prop.id] = false;
                            } else if (prop.type === 'number') {
                                fullProperties[prop.id] = null;
                            } else {
                                fullProperties[prop.id] = '';
                            }
                        }
                    });

                    newPage = {
                        id: customId || uuidv4(),
                        databaseId,
                        order: db.pages.length,
                        properties: fullProperties,
                        blocks: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: 'system',
                        lastEditedBy: 'system'
                    };

                    return {
                        databases: state.databases.map(d => {
                            if (d.id !== databaseId) return d;
                            return {
                                ...d,
                                pages: [...d.pages, newPage!],
                                updatedAt: new Date().toISOString()
                            };
                        })
                    };
                });

                // The store contract expects the created page to be returned synchronously
                // Zustand's set() is synchronous here so newPage will be populated
                if (!newPage) {
                    newPage = {
                        id: uuidv4(),
                        databaseId,
                        order: 0,
                        properties: initialProperties,
                        blocks: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: 'system',
                        lastEditedBy: 'system'
                    };
                }

                // Pass the parent DB so syncPage can guarantee the DB exists in Postgres first
                const parentDb = get().databases.find(d => d.id === databaseId);
                syncPage(newPage, parentDb);
                return newPage;
            },

            addConfirmedPage: (page: Page) => {
                set(state => {
                    const dbExists = state.databases.some(db => db.id === page.databaseId);

                    if (!dbExists) {
                        // Race condition: DB was just provisioned but GlobalDatabaseSyncer
                        // hasn't fetched it yet. Create a minimal in-memory stub so the
                        // page is visible immediately without waiting for next sync.
                        return {
                            databases: [
                                ...state.databases,
                                {
                                    id: page.databaseId,
                                    name: page.databaseId,
                                    description: null,
                                    pages: [page],
                                    properties: [],
                                    views: [],
                                    activeFilters: [],
                                    activeSorts: [],
                                    isTemplate: false,
                                    tenantId: '',
                                    ownerId: 'system',
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                }
                            ]
                        };
                    }

                    return {
                        databases: state.databases.map(db => {
                            if (db.id !== page.databaseId) return db;
                            // Avoid duplicates if the page somehow already exists
                            const exists = db.pages.some((p: Page) => p.id === page.id);
                            if (exists) return db;
                            return {
                                ...db,
                                pages: [...db.pages, page],
                                updatedAt: new Date().toISOString()
                            };
                        })
                    };
                });
                // Already in Postgres — no syncPage needed
            },

            addPages: (databaseId, pagesProperties) => {
                let createdPages: Page[] = [];
                set((state) => {
                    return {
                        databases: state.databases.map(db => {
                            if (db.id !== databaseId) return db;

                            // Evaluate max sequence number if handling quotations
                            let currentMax = 0;
                            const year = new Date().getFullYear();
                            if (isBaseDb(databaseId, 'db-quotations')) {
                                db.pages.forEach((p: Page) => {
                                    const title = p.properties['title'] as string;
                                    if (title && title.startsWith(`CEO-${year}-`)) {
                                        const m = title.match(/CEO-\d{4}-(\d+)/);
                                        if (m && m[1]) {
                                            const pNum = parseInt(m[1], 10);
                                            if (pNum > currentMax) currentMax = pNum;
                                        }
                                    }
                                });
                            }

                            // Evaluate max sequence counters for articles
                            let currentArticleMax: Record<string, number> = {};
                            if (databaseId === 'db-articles') {
                                db.pages.forEach((p: Page) => {
                                    const artId = p.properties['prop-art-id'] as string;
                                    if (artId && artId.startsWith('ART-')) {
                                        const m = artId.match(/ART-(\d{2})-(\d+)/);
                                        if (m && m[1] && m[2]) {
                                            const groupCode = m[1];
                                            const pNum = parseInt(m[2], 10);
                                            if (!currentArticleMax[groupCode] || pNum > currentArticleMax[groupCode]) {
                                                currentArticleMax[groupCode] = pNum;
                                            }
                                        }
                                    }
                                });
                            }

                            const newPages: Page[] = pagesProperties.map((initialProperties, index) => {
                                const pProps = { ...initialProperties };
                                if (isBaseDb(databaseId, 'db-quotations') && !pProps['title']) {
                                    currentMax++;
                                    pProps['title'] = `CEO-${year}-${String(currentMax).padStart(3, '0')}.00`;
                                }

                                if (databaseId === 'db-articles' && !pProps['prop-art-id']) {
                                    let groupCode = '00';
                                    const groupVal = pProps['prop-art-group'];
                                    if (groupVal === 'opt-ruwbouw') groupCode = '01';
                                    else if (groupVal === 'opt-afwerking') groupCode = '02';
                                    else if (groupVal === 'opt-elektriciteit') groupCode = '03';
                                    else if (groupVal === 'opt-sanitaire') groupCode = '04';
                                    else if (groupVal === 'opt-ventilatie') groupCode = '05';
                                    else if (groupVal === 'opt-verwarming') groupCode = '06';

                                    if (!currentArticleMax[groupCode]) currentArticleMax[groupCode] = 0;
                                    currentArticleMax[groupCode]++;
                                    pProps['prop-art-id'] = `ART-${groupCode}-${String(currentArticleMax[groupCode]).padStart(4, '0')}`;
                                }

                                return {
                                    id: uuidv4(),
                                    databaseId,
                                    order: db.pages.length + index,
                                    properties: pProps,
                                    blocks: [],
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    createdBy: 'system',
                                    lastEditedBy: 'system'
                                };
                            });

                            createdPages = [...createdPages, ...newPages];
                            return {
                                ...db,
                                pages: [...db.pages, ...newPages],
                                updatedAt: new Date().toISOString()
                            };
                        })
                    };
                });
                const parentDb = get().databases.find(d => d.id === databaseId);
                syncPagesBatch(createdPages, parentDb);
            },

            updatePageProperty: (databaseId, pageId, propertyId, value) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            pages: db.pages.map((page: Page) => {
                                if (page.id !== pageId) return page;

                                const newProps = { ...page.properties, [propertyId]: value };

                                // Automated Google Drive Folder generation when a title is first defined
                                if (propertyId === 'title' && typeof value === 'string' && value.trim() !== '' && !page.driveFolderId) {
                                if (isBaseDb(databaseId, 'db-clients') || ['db-1', 'db-portals'].includes(databaseId)) {
                                        fetch('/api/drive/init', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ databaseId, pageId, title: value })
                                        })
                                            .then(res => res.json())
                                            .then(data => {
                                                if (data.driveFolderId) {
                                                    get().updatePageDriveId(databaseId, pageId, data.driveFolderId);
                                                }
                                            }).catch(console.error);
                                    }
                                }

                                // Automations mapping for Project Tracker Execution Status
                                if (isBaseDb(databaseId, 'db-1') && propertyId === 'prop-execution-status') {
                                    const today = new Date().toISOString().split('T')[0];
                                    if (value === 'opt-in-prog' && !newProps['prop-actual-start']) {
                                        newProps['prop-actual-start'] = today; // In Progress sets Start Date
                                    } else if (value === 'opt-done' && !newProps['prop-actual-end']) {
                                        newProps['prop-actual-end'] = today; // Done sets End Date
                                    }
                                }

                                // Automations for Invoice: status → 'sent' sets invoiceDate to today
                                if (isBaseDb(databaseId, 'db-invoices') && propertyId === 'status') {
                                    if (value === 'opt-sent' && !newProps['invoiceDate']) {
                                        newProps['invoiceDate'] = new Date().toISOString().split('T')[0];
                                    }
                                }

                                return {
                                    ...page,
                                    properties: newProps,
                                    updatedAt: new Date().toISOString()
                                };
                            }),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                const db = get().databases.find(d => d.id === databaseId);
                if (db) {
                    syncPage(db.pages.find((p: Page) => p.id === pageId));
                }
            },

            updatePageDriveId: (databaseId, pageId, driveId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            pages: db.pages.map((page: Page) => {
                                if (page.id !== pageId) return page;
                                return { ...page, driveFolderId: driveId, updatedAt: new Date().toISOString() };
                            }),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                const db = get().databases.find(d => d.id === databaseId);
                if (db) {
                    syncPage(db.pages.find((p: Page) => p.id === pageId));
                }
            },

            updatePageBlocks: (databaseId, pageId, blocks) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            pages: db.pages.map((page: Page) => {
                                if (page.id !== pageId) return page;
                                return {
                                    ...page,
                                    blocks,
                                    updatedAt: new Date().toISOString()
                                };
                            }),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                const db = get().databases.find(d => d.id === databaseId);
                if (db) {
                    syncPage(db.pages.find((p: Page) => p.id === pageId));
                }
            },

            deletePage: (databaseId, pageId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            pages: db.pages.filter((page: Page) => page.id !== pageId),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                deleteGlobalPage(pageId).catch(console.error);
            },

            deletePages: (databaseId, pageIds) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            pages: db.pages.filter((page: Page) => !pageIds.includes(page.id)),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                // Propagate each deletion to Prisma
                pageIds.forEach(pid => deleteGlobalPage(pid).catch(console.error));
            },

            updatePageOrder: (databaseId: string, sourceIndex: number, destinationIndex: number) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;

                        const newPages: any[] = Array.from(db.pages);
                        const [reorderedPage] = newPages.splice(sourceIndex, 1);

                        if (reorderedPage) {
                            newPages.splice(destinationIndex, 0, reorderedPage);
                        }

                        // Re-index explicit order variables
                        const finalizedPages = newPages.map((page: Page, index: number) => ({
                            ...page,
                            order: index
                        })) as Page[];

                        return {
                            ...db,
                            pages: finalizedPages,
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            addFilter: (databaseId, viewId, filter) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, filters: [...(v.filters || []), { ...filter, id: uuidv4() }] } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeFilters: [...(db.activeFilters || []), { ...filter, id: uuidv4() }],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            updateFilter: (databaseId, viewId, filterId, updates) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, filters: (v.filters || []).map((f: FilterRule) => f.id === filterId ? { ...f, ...updates } : f) } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeFilters: db.activeFilters.map((f: FilterRule) => f.id === filterId ? { ...f, ...updates } : f),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            removeFilter: (databaseId, viewId, filterId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, filters: (v.filters || []).filter((f: FilterRule) => f.id !== filterId) } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeFilters: db.activeFilters.filter((f: FilterRule) => f.id !== filterId),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            clearFilters: (databaseId, viewId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, filters: [] } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeFilters: [],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            addSort: (databaseId, viewId, sort) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, sorts: [...(v.sorts || []), { ...sort, id: uuidv4() }] } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeSorts: [...(db.activeSorts || []), { ...sort, id: uuidv4() }],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            updateSort: (databaseId, viewId, sortId, updates) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, sorts: (v.sorts || []).map((s: SortRule) => s.id === sortId ? { ...s, ...updates } : s) } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeSorts: (db.activeSorts || []).map((s: SortRule) => s.id === sortId ? { ...s, ...updates } : s),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            removeSort: (databaseId, viewId, sortId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, sorts: (v.sorts || []).filter((s: SortRule) => s.id !== sortId) } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeSorts: (db.activeSorts || []).filter((s: SortRule) => s.id !== sortId),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            },

            clearSorts: (databaseId, viewId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        if (viewId) {
                            return {
                                ...db,
                                views: db.views.map((v: DatabaseView) => v.id === viewId ? { ...v, sorts: [] } : v),
                                updatedAt: new Date().toISOString()
                            };
                        }
                        return {
                            ...db,
                            activeSorts: [],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
                syncDb(get().databases.find(d => d.id === databaseId));
            }
        }),
        {
            name: 'coral-database-storage-v4', // Nuclear Option to abandon all legacy schemas
            version: 4,
            storage: createJSONStorage(() => idbStorage),
            migrate: (persistedState: any, version: number) => {
                if (version < 3) {
                    // Force an absolute wipe of db-1 to force deep hydration of the new 
                    // Financial/Execution bifurcated trackers and Nacalculatie properties.
                    if (persistedState.databases) {
                        persistedState.databases = persistedState.databases.filter((d: any) => d.id !== 'db-1');
                    }
                }
                return persistedState as DatabaseState;
            },
            merge: (persistedState: any, currentState: DatabaseState) => {
                if (!persistedState?.databases) return currentState;

                // Intelligently merge the freshly loaded source-code schemas (currentState) 
                // with the user's localized row additions and edits (persistedState).
                const mergedDbs = currentState.databases.map(currentDb => {
                    const savedDb = persistedState.databases.find((d: Database) => d.id === currentDb.id);
                    if (savedDb) {
                        // User Schema Migration Request for 'db-bestek'
                        if (savedDb.id === 'db-bestek') {
                            const oldTitleProp = savedDb.properties.find((p: Property) => p.id === 'title');
                            const numericArtikelProp = savedDb.properties.find((p: Property) => p.name === 'Artikel' && p.id !== 'title');

                            if (numericArtikelProp) {
                                const numericId = numericArtikelProp.id;

                                // Transplant data
                                if (savedDb.pages) {
                                    savedDb.pages.forEach((page: Page) => {
                                        if (page.properties[numericId] !== undefined) {
                                            page.properties['title'] = page.properties[numericId];
                                            delete page.properties[numericId];
                                        }
                                    });
                                }

                                // Elevate to primary title
                                numericArtikelProp.id = 'title';
                            }

                            // Delete the old "Artikel" (title), "Category", and "Code Reference" properties eternally
                            savedDb.properties = savedDb.properties.filter((p: Property) =>
                                p.name !== 'Category' &&
                                p.name !== 'Code Reference' &&
                                p !== oldTitleProp
                            );
                        }
                        // Merge properties: preserve user's dynamic CSV columns while inheriting codebase static updates
                        const mergedProperties = [...(savedDb.properties || [])];
                        currentDb.properties.forEach((devProp: Property) => {
                            const existingIdx = mergedProperties.findIndex(p => p.id === devProp.id);
                            if (existingIdx === -1) {
                                mergedProperties.push(devProp);
                            } else {
                                // Override codebase modifications (like new config options) into the saved state
                                mergedProperties[existingIdx] = { ...mergedProperties[existingIdx], ...devProp };
                            }
                        });

                        // Strip out legacy view-5 from db-1 to prevent duplicate timeline tabs
                        const mergedViews = (savedDb.views || currentDb.views).filter((v: any) => !(currentDb.id === 'db-1' && v.id === 'view-5'));

                        // Inherit new source code properties/views, but keep the user's row data and view customizations
                        return {
                            ...currentDb,
                            properties: mergedProperties,
                            pages: savedDb.pages || [],
                            activeFilters: savedDb.activeFilters || [],
                            activeSorts: savedDb.activeSorts || [],
                            views: mergedViews
                        };
                    }
                    return currentDb;
                });

                return {
                    ...currentState,
                    databases: mergedDbs
                };
            }
        }
    )
);
