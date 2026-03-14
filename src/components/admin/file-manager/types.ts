export type FileNodeType = 'file' | 'folder';

export type FileContextType = 'project' | 'task' | 'client' | 'global' | 'invoice' | 'quotation' | 'contract';

export interface FileNode {
    id: string;
    name: string;
    type: FileNodeType;

    // File-specific properties
    mimeType?: string; // e.g., 'image/png', 'application/pdf', 'text/csv'
    size?: number; // in bytes
    url?: string; // Public or internal URL to the actual asset

    // Hierarchy
    parentId: string | null; // null for root level nodes

    // Contextual Scoping (for embedding in specific modules)
    contextType: FileContextType;
    contextId?: string; // e.g., 'db-1-page-1'

    // Metadata
    createdAt: string;
    updatedAt: string;
    ownerId?: string;
}
