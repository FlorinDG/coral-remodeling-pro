import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileNode, FileContextType } from './types';
import { toast } from 'sonner';
import { listRecordFiles, listAllTenantFiles, deleteFileAction, uploadFileAction } from '@/app/actions/files';

interface FileManagerState {
    nodes: FileNode[];
    isLoading: boolean;
    error: string | null;

    fetchNodes: (contextType: FileContextType, contextId?: string) => Promise<void>;
    uploadFile: (file: File, contextType: FileContextType, contextId?: string) => Promise<void>;
    deleteNode: (id: string) => Promise<void>;

    // Selectors
    getNodesByContext: (contextType: FileContextType, contextId?: string) => FileNode[];
}

export const useFileManagerStore = create<FileManagerState>()(
    persist(
        (set, get) => ({
            nodes: [],
            isLoading: false,
            error: null,

            fetchNodes: async (contextType, contextId) => {
                set({ isLoading: true, error: null });
                try {
                    let data;
                    if (contextType === 'global') {
                        data = await listAllTenantFiles();
                        // Replace ALL nodes when loading globally to ensure sync
                        set({ nodes: data, isLoading: false });
                    } else {
                        data = await listRecordFiles(contextType, contextId);
                        const contextualNodes: FileNode[] = data.map((n) => ({
                            ...n,
                            contextType,
                            contextId
                        }));
                        set((state) => {
                            const otherNodes = state.nodes.filter(n => n.contextType !== contextType || n.contextId !== contextId);
                            return { nodes: [...otherNodes, ...contextualNodes], isLoading: false };
                        });
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error('Failed to fetch Blob files:', err);
                    set({ error: message, isLoading: false });
                }
            },

            uploadFile: async (file, contextType, contextId) => {
                try {
                    const MAX_FILE_SIZE = 4.2 * 1024 * 1024; // 4.2 MB safe serverless payload threshold
                    if (file.size > MAX_FILE_SIZE) {
                        throw new Error(`Bestand "${file.name}" is te groot. Directe uploads zijn beperkt tot 4 MB vanwege serverless payload-limieten.`);
                    }

                    const formData = new FormData();
                    formData.append('file', file);

                    const result = await uploadFileAction(formData, contextType, contextId);

                    if (!result.success || !result.key) {
                        throw new Error(result.error || 'Upload failed');
                    }

                    const newNode: FileNode = {
                        id: result.key,
                        name: file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_'),
                        type: 'file' as const,
                        size: file.size,
                        url: `/api/files/${result.key}`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
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
                    const res = await deleteFileAction(id);
                    if (!res.success) throw new Error(res.error || 'Delete failed');

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
                    return nodes; // Return all files in global view
                }
                return nodes.filter(n => n.contextType === contextType && n.contextId === contextId);
            }
        }),
        {
            name: 'file-manager-storage-v2', // bump version to bust cache
            partialize: (state) => ({ nodes: state.nodes }),
        }
    )
);
