export async function updatePageServerFirst(pageId: string, properties: any) {
    return { success: true, page: { id: pageId, properties, updatedAt: new Date().toISOString() } };
}

export async function createPageServerFirst(databaseId: string, properties: any, customId?: string) {
    return { success: true, page: { id: customId || 'p1', databaseId, properties, updatedAt: new Date().toISOString() } };
}
