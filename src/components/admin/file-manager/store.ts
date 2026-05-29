import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileNode, FileContextType } from './types';
import { toast } from 'sonner';

interface FileManagerState {
    nodes: FileNode[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchNodes: (contextType: FileContextType, contextId?: string, tag?: string | null, driveFolderId?: string) => Promise<void>;
    createFolder: (name: string, parentId: string | null, contextType: FileContextType, contextId?: string, driveFolderId?: string) => Promise<void>;
    createGoogleFile: (name: string, type: 'document' | 'spreadsheet', parentId: string | null, contextType: FileContextType, contextId?: string, driveFolderId?: string) => Promise<void>;
    uploadFile: (file: File, parentId: string | null, contextType: FileContextType, contextId?: string, driveFolderId?: string) => Promise<void>;
    deleteNode: (id: string) => Promise<void>;
    initializeContextFolder: (folderName: string, contextType: FileContextType, contextId: string) => Promise<string | null>;

    // Selectors
    getNodesByContext: (contextType: FileContextType, contextId?: string) => FileNode[];
    getChildren: (parentId: string | null, contextType?: FileContextType, contextId?: string) => FileNode[];
}

// Helper to determine the correct Google Drive folder ID based on the app's context
const getDriveFolderIdForContext = (contextType: FileContextType, contextId?: string, driveFolderId?: string) => {
    // Return explicit driveFolderId if provided (used for scoped projects)
    return driveFolderId || undefined;
};

export const useFileManagerStore = create<FileManagerState>()(
    persist(
        (set, get) => ({
            nodes: [],
            isLoading: false,
            error: null,

            fetchNodes: async (contextType, contextId, tag, driveFolderId) => {
                set({ isLoading: true, error: null });
                try {
                    const folderId = getDriveFolderIdForContext(contextType, contextId, driveFolderId);
                    const url = new URL('/api/drive', window.location.origin);
                    if (folderId) url.searchParams.append('folderId', folderId);
                    if (tag) url.searchParams.append('tag', tag);

                    const res = await fetch(url.toString());
                    if (!res.ok) throw new Error(await res.text());

                    const data = await res.json();

                    // The API returns raw Drive nodes. We tag them with the current context before tossing them in the store.
                    const contextualNodes: FileNode[] = (data.nodes as FileNode[]).map((n) => ({
                        ...n,
                        contextType,
                        contextId
                    }));

                    set((state) => {
                        // Remove old nodes from this context and merge in the fresh ones
                        const otherNodes = state.nodes.filter(n => n.contextType !== contextType || n.contextId !== contextId);
                        return { nodes: [...otherNodes, ...contextualNodes], isLoading: false };
                    });

                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('Failed to fetch Drive nodes:', err);
                    set({ error: message, isLoading: false });
                }
            },

            createFolder: async (name, parentId, contextType, contextId, driveFolderId) => {
                try {
                    const driveParentId = parentId || getDriveFolderIdForContext(contextType, contextId, driveFolderId);

                    const formData = new FormData();
                    formData.append('action', 'create_folder');
                    formData.append('name', name);
                    if (driveParentId) formData.append('parentId', driveParentId);

                    const res = await fetch('/api/drive', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();

                    // Format the newly created Drive folder into our FileNode format
                    const newNode: FileNode = {
                        id: data.node.id,
                        name: data.node.name,
                        type: 'folder',
                        mimeType: data.node.mimeType,
                        // Ensure the parentId exactly matches what the File Manager is looking for
                        parentId: data.node.parents ? data.node.parents[0] : (driveParentId || null),
                        createdAt: data.node.createdTime,
                        updatedAt: data.node.modifiedTime,
                        contextType,
                        contextId
                    };

                    set((state) => ({ nodes: [...state.nodes, newNode] }));
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('Failed to create folder:', err);
                    toast.error(`Folder maken mislukt: ${message}`);
                }
            },

            createGoogleFile: async (name, type, parentId, contextType, contextId, driveFolderId) => {
                try {
                    const driveParentId = parentId || getDriveFolderIdForContext(contextType, contextId, driveFolderId);

                    const formData = new FormData();
                    formData.append('action', 'create_file');
                    formData.append('name', name);
                    formData.append('mimeType', `application/vnd.google-apps.${type}`);
                    if (contextType && contextType !== 'global') formData.append('moduleTag', contextType);
                    if (driveParentId) formData.append('parentId', driveParentId);

                    const res = await fetch('/api/drive', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();

                    const newNode: FileNode = {
                        id: data.node.id,
                        name: data.node.name,
                        type: 'file',
                        mimeType: data.node.mimeType,
                        url: data.node.webViewLink,
                        parentId: data.node.parents ? data.node.parents[0] : (driveParentId || null),
                        createdAt: data.node.createdTime,
                        updatedAt: data.node.modifiedTime,
                        contextType,
                        contextId
                    };

                    set((state) => ({ nodes: [...state.nodes, newNode] }));
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('Failed to create google file:', err);
                    toast.error(`Bestand maken mislukt: ${message}`);
                }
            },

            initializeContextFolder: async (folderName, contextType, contextId) => {
                try {
                    let databaseId = '';
                    if (contextType === 'project') databaseId = 'db-1';
                    else if (contextType === 'client') databaseId = 'db-clients';
                    else if (contextType === 'hr') databaseId = 'db-hr';
                    else if (contextType === 'contract' || contextType === 'documents' || contextType === 'document') databaseId = 'db-documents';

                    if (databaseId) {
                        const initRes = await fetch('/api/drive/init', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                databaseId,
                                pageId: contextId,
                                title: folderName,
                            }),
                        });
                        if (initRes.ok) {
                            const initData = await initRes.json();
                            if (initData.driveFolderId) {
                                return initData.driveFolderId;
                            }
                        }
                    }

                    // Fallback to generic simple folder creation
                    const formData = new FormData();
                    formData.append('action', 'create_folder');
                    formData.append('name', folderName || `New ${contextType}`);

                    const res = await fetch('/api/drive', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();

                    return data.node.id;
                } catch (err) {
                    console.error('Failed to initialize context folder:', err);
                    return null;
                }
            },

            uploadFile: async (file, parentId, contextType, contextId, driveFolderId) => {
                try {
                    const MAX_FILE_SIZE = 4.2 * 1024 * 1024; // 4.2 MB safe serverless payload threshold
                    if (file.size > MAX_FILE_SIZE) {
                        throw new Error(`Bestand "${file.name}" is te groot. Directe uploads zijn beperkt tot 4 MB vanwege serverless payload-limieten.`);
                    }

                    const driveParentId = parentId || getDriveFolderIdForContext(contextType, contextId, driveFolderId);

                    const formData = new FormData();
                    formData.append('action', 'upload_file');
                    formData.append('file', file);
                    if (contextType && contextType !== 'global') formData.append('moduleTag', contextType);
                    if (driveParentId) formData.append('parentId', driveParentId);

                    const res = await fetch('/api/drive', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();

                    const newNode: FileNode = {
                        id: data.node.id,
                        name: data.node.name,
                        type: 'file',
                        mimeType: data.node.mimeType,
                        size: data.node.size ? parseInt(data.node.size, 10) : file.size,
                        url: data.node.webViewLink,
                        // Ensure the parentId exactly matches what the File Manager is looking for
                        parentId: data.node.parents ? data.node.parents[0] : (driveParentId || null),
                        createdAt: data.node.createdTime || new Date().toISOString(),
                        updatedAt: data.node.modifiedTime || new Date().toISOString(),
                        contextType,
                        contextId
                    };

                    set((state) => ({ nodes: [...state.nodes, newNode] }));
                    toast.success(`Bestand "${file.name}" succesvol geüpload!`);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('Failed to upload file:', err);
                    toast.error(message);
                }
            },

            deleteNode: async (id) => {
                try {
                    const res = await fetch(`/api/drive?fileId=${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error(await res.text());

                    set((state) => ({
                        nodes: state.nodes.filter(n => n.id !== id)
                    }));
                    toast.success('Bestand succesvol verwijderd.');
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('Failed to delete node:', err);
                    toast.error(`Verwijderen mislukt: ${message}`);
                }
            },

            getNodesByContext: (contextType, contextId) => {
                const { nodes } = get();
                if (contextType === 'global') {
                    return nodes.filter(n => n.contextType === 'global');
                }
                return nodes.filter(n => n.contextType === contextType && n.contextId === contextId);
            },

            getChildren: (parentId, contextType, contextId) => {
                const { nodes } = get();
                let pool = nodes;

                if (contextType) {
                    pool = get().getNodesByContext(contextType, contextId);
                }

                return pool.filter(n => n.parentId === parentId);
            }
        }),
        {
            name: 'file-manager-storage-v1',
            partialize: (state) => ({ nodes: state.nodes }),
        }
    )
);
