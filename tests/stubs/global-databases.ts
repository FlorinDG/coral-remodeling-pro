export let mockGetDatabasePages = async (_databaseId: string): Promise<any[]> => [];
export let mockSaveGlobalDatabase = async (_database: any): Promise<any> => ({ success: true });
export let mockSaveGlobalPage = async (_page: any): Promise<any> => ({ success: true, updatedAt: new Date().toISOString() });

export function setMockGetDatabasePages(fn: (dbId: string) => Promise<any[]>) {
    mockGetDatabasePages = fn;
}

export function setMockSaveGlobalPage(fn: (page: any) => Promise<any>) {
    mockSaveGlobalPage = fn;
}

export async function getDatabasePages(databaseId: string) {
    return mockGetDatabasePages(databaseId);
}

export async function saveGlobalDatabase(database: any) {
    return mockSaveGlobalDatabase(database);
}

export async function saveGlobalPage(page: any) {
    return mockSaveGlobalPage(page);
}

export async function saveGlobalPagesBatch(pages: any[]) {
    return { success: true, count: pages.length, results: [] };
}

export async function deleteGlobalDatabase(_databaseId: string) {
    return { success: true };
}

export async function deleteGlobalPage(_pageId: string) {
    return { success: true };
}


export let mockGetDatabaseVersion = async (_databaseId: string): Promise<{ count: number; lastUpdatedAt: string | null }> => ({ count: 0, lastUpdatedAt: null });
export function setMockGetDatabaseVersion(fn: (dbId: string) => Promise<{ count: number; lastUpdatedAt: string | null }>) {
    mockGetDatabaseVersion = fn;
}
export async function getDatabaseVersion(databaseId: string) {
    return mockGetDatabaseVersion(databaseId);
}
