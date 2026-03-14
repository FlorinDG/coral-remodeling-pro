import { create } from 'zustand';
import { FileNode, FileContextType } from './types';

interface FileManagerState {
    nodes: FileNode[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchNodes: (contextType: FileContextType, contextId?: string, tag?: string | null) => Promise<void>;
    createFolder: (name: string, parentId: string | null, contextType: FileContextType, contextId?: string) => Promise<void>;
    createGoogleFile: (name: string, type: 'document' | 'spreadsheet', parentId: string | null, contextType: FileContextType, contextId?: string) => Promise<void>;
    uploadFile: (file: File, parentId: string | null, contextType: FileContextType, contextId?: string) => Promise<void>;
    deleteNode: (id: string) => Promise<void>;
    initializeContextFolder: (folderName: string, contextType: FileContextType, contextId: string) => Promise<string | null>;

    // Selectors
    getNodesByContext: (contextType: FileContextType, contextId?: string) => FileNode[];
    getChildren: (parentId: string | null, contextType?: FileContextType, contextId?: string) => FileNode[];
}

// Helper to determine the correct Google Drive folder ID based on the app's context
// In a full production app, you might look up `contextId` in Prisma to get its matching `driveFolderId`.
// For Phase 7.1, we map the global context to a base env variable folder.
const getDriveFolderIdForContext = (contextType: FileContextType, contextId?: string) => {
    // If we're looking at a specific project row, Ideally we stored its GDrive folder ID in the DB.
    // For now, if no ID is passed, the API route defaults to `process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID`
    return contextId || undefined;
};

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
    nodes: [],
    isLoading: false,
    error: null,

    fetchNodes: async (contextType, contextId, tag) => {
        set({ isLoading: true, error: null });
        try {
            const folderId = getDriveFolderIdForContext(contextType, contextId);
            const url = new URL('/api/drive', window.location.origin);
            if (folderId) url.searchParams.append('folderId', folderId);
            if (tag) url.searchParams.append('tag', tag);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();

            // The API returns raw Drive nodes. We tag them with the current context before tossing them in the store.
            const contextualNodes: FileNode[] = data.nodes.map((n: any) => ({
                ...n,
                contextType,
                contextId
            }));

            set((state) => {
                // Remove old nodes from this context and merge in the fresh ones
                const otherNodes = state.nodes.filter(n => n.contextType !== contextType || n.contextId !== contextId);
                return { nodes: [...otherNodes, ...contextualNodes], isLoading: false };
            });

        } catch (err: any) {
            console.error('Failed to fetch Drive nodes:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    createFolder: async (name, parentId, contextType, contextId) => {
        try {
            const driveParentId = parentId || getDriveFolderIdForContext(contextType, contextId);

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
        } catch (err: any) {
            console.error('Failed to create folder:', err);
            set({ error: err.message });
        }
    },

    createGoogleFile: async (name, type, parentId, contextType, contextId) => {
        try {
            const driveParentId = parentId || getDriveFolderIdForContext(contextType, contextId);

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
        } catch (err: any) {
            console.error('Failed to create google file:', err);
            set({ error: err.message });
        }
    },

    initializeContextFolder: async (folderName, contextType, contextId) => {
        try {
            const formData = new FormData();
            formData.append('action', 'create_folder');
            formData.append('name', folderName || `New ${contextType}`);
            // Omitting parentId tells the backend to place it in the Root Folder

            const res = await fetch('/api/drive', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            return data.node.id;
        } catch (err: any) {
            console.error('Failed to initialize context folder:', err);
            return null;
        }
    },

    uploadFile: async (file, parentId, contextType, contextId) => {
        try {
            const driveParentId = parentId || getDriveFolderIdForContext(contextType, contextId);

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
        } catch (err: any) {
            console.error('Failed to upload file:', err);
            set({ error: err.message });
        }
    },

    deleteNode: async (id) => {
        try {
            const res = await fetch(`/api/drive?fileId=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());

            set((state) => ({
                nodes: state.nodes.filter(n => n.id !== id)
            }));
        } catch (err: any) {
            console.error('Failed to delete node:', err);
            set({ error: err.message });
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
}));
