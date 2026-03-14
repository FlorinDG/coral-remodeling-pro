import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Database, Page, Property, PropertyType, PropertyConfig, FilterRule, SortRule, Block, DatabaseView } from './types';

import { mockDatabases } from './mockData';

interface DatabaseState {
    databases: Database[];

    // Database Operations
    createDatabase: (name: string, description?: string) => Database;
    updateDatabase: (id: string, updates: Partial<Database>) => void;
    deleteDatabase: (id: string) => void;
    getDatabase: (id: string) => Database | undefined;

    // View Operations
    addView: (databaseId: string, view: Omit<DatabaseView, 'id'>) => void;
    updateView: (databaseId: string, viewId: string, updates: Partial<DatabaseView>) => void;
    deleteView: (databaseId: string, viewId: string) => void;

    // Property Operations
    addProperty: (databaseId: string, name: string, type: PropertyType, config?: PropertyConfig) => void;
    updateProperty: (databaseId: string, propertyId: string, updates: Partial<Property>) => void;
    deleteProperty: (databaseId: string, propertyId: string) => void;

    // Page (Row) Operations
    createPage: (databaseId: string, initialProperties?: Record<string, any>) => Page;
    updatePageProperty: (databaseId: string, pageId: string, propertyId: string, value: any) => void;
    updatePageBlocks: (databaseId: string, pageId: string, blocks: Block[]) => void;
    deletePage: (databaseId: string, pageId: string) => void;

    // Filter Operations
    addFilter: (databaseId: string, filter: Omit<FilterRule, 'id'>) => void;
    updateFilter: (databaseId: string, filterId: string, updates: Partial<FilterRule>) => void;
    removeFilter: (databaseId: string, filterId: string) => void;
    clearFilters: (databaseId: string) => void;

    // Sort Operations
    addSort: (databaseId: string, sort: Omit<SortRule, 'id'>) => void;
    updateSort: (databaseId: string, sortId: string, updates: Partial<SortRule>) => void;
    removeSort: (databaseId: string, sortId: string) => void;
    clearSorts: (databaseId: string) => void;
}

export const useDatabaseStore = create<DatabaseState>()(
    persist(
        (set, get) => ({
            databases: mockDatabases,

            createDatabase: (name, description) => {
                const newDatabase: Database = {
                    id: uuidv4(),
                    name,
                    description: description || null,
                    properties: [
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
                return newDatabase;
            },

            updateDatabase: (id, updates) => {
                set((state) => ({
                    databases: state.databases.map(db =>
                        db.id === id ? { ...db, ...updates, updatedAt: new Date().toISOString() } : db
                    )
                }));
            },

            deleteDatabase: (id) => {
                set((state) => ({
                    databases: state.databases.filter(db => db.id !== id)
                }));
            },

            getDatabase: (id) => {
                return get().databases.find(db => db.id === id);
            },

            // --- VIEW OPERATIONS ---

            addView: (databaseId, view) => set((state) => ({
                databases: state.databases.map(db => {
                    if (db.id === databaseId) {
                        const newView: DatabaseView = { ...view, id: uuidv4() };
                        return { ...db, views: [...(db.views || []), newView] };
                    }
                    return db;
                })
            })),

            updateView: (databaseId, viewId, updates) => set((state) => ({
                databases: state.databases.map(db => {
                    if (db.id === databaseId && db.views) {
                        return {
                            ...db,
                            views: db.views.map((view: DatabaseView) => view.id === viewId ? { ...view, ...updates } : view)
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
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        const newProperty: Property = { id: uuidv4(), name, type, config };
                        return {
                            ...db,
                            properties: [...db.properties, newProperty],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
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
            },

            deleteProperty: (databaseId, propertyId) => {
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
            },

            createPage: (databaseId, initialProperties = {}) => {
                let newPage: Page | null = null;

                set((state) => {
                    const db = state.databases.find(d => d.id === databaseId);
                    if (!db) return {};

                    // Initialize all properties defined in the schema to prevent DataSheetGrid from breaking
                    const fullProperties: Record<string, any> = { ...initialProperties };
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
                        id: uuidv4(),
                        databaseId,
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
                        properties: initialProperties,
                        blocks: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: 'system',
                        lastEditedBy: 'system'
                    };
                }

                return newPage;
            },

            updatePageProperty: (databaseId, pageId, propertyId, value) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            pages: db.pages.map((page: Page) => {
                                if (page.id !== pageId) return page;
                                return {
                                    ...page,
                                    properties: {
                                        ...page.properties,
                                        [propertyId]: value
                                    },
                                    updatedAt: new Date().toISOString()
                                };
                            }),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
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
            },

            addFilter: (databaseId, filter) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeFilters: [...db.activeFilters, { ...filter, id: uuidv4() }],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            updateFilter: (databaseId, filterId, updates) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeFilters: db.activeFilters.map((f: FilterRule) => f.id === filterId ? { ...f, ...updates } : f),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            removeFilter: (databaseId, filterId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeFilters: db.activeFilters.filter((f: FilterRule) => f.id !== filterId),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            clearFilters: (databaseId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeFilters: [],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            addSort: (databaseId, sort) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeSorts: [...(db.activeSorts || []), { ...sort, id: uuidv4() }],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            updateSort: (databaseId, sortId, updates) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeSorts: (db.activeSorts || []).map((s: SortRule) => s.id === sortId ? { ...s, ...updates } : s),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            removeSort: (databaseId, sortId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeSorts: (db.activeSorts || []).filter((s: SortRule) => s.id !== sortId),
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            },

            clearSorts: (databaseId) => {
                set((state) => ({
                    databases: state.databases.map(db => {
                        if (db.id !== databaseId) return db;
                        return {
                            ...db,
                            activeSorts: [],
                            updatedAt: new Date().toISOString()
                        };
                    })
                }));
            }
        }),
        {
            name: 'coral-database-storage', // unique name for localStorage key
            version: 2, // Cache buster for major structural changes
            migrate: (persistedState: any, version: number) => {
                if (version < 2) {
                    // Version bumping handled mostly by merge strategy below,
                    // but we must provide a migrate function to satisfy persist middleware.
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
                        // Inherit new source code properties/views, but keep the user's row data
                        return {
                            ...currentDb,
                            pages: savedDb.pages,
                            activeFilters: savedDb.activeFilters,
                            activeSorts: savedDb.activeSorts
                        };
                    }
                    return currentDb;
                });

                // Preserve entirely custom databases the user created that aren't in mockData.ts
                const userAddedDbs = persistedState.databases.filter((savedDb: Database) =>
                    !currentState.databases.some(c => c.id === savedDb.id)
                );

                return {
                    ...currentState,
                    databases: [...mergedDbs, ...userAddedDbs]
                };
            }
        }
    )
);
