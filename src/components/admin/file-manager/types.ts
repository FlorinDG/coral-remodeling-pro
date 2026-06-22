export type FileNodeType = 'file';

export type FileContextType = 'project' | 'task' | 'client' | 'global' | 'invoice' | 'quotation' | 'contract' | 'hr' | 'documents' | 'document' | 'receipt' | 'expense' | 'purchase-invoice';

export interface FileNode {
    id: string;
    name: string;
    type: FileNodeType;

    // File-specific properties
    mimeType?: string; // e.g., 'image/png', 'application/pdf', 'text/csv'
    size?: number; // in bytes
    url?: string; // Public or internal URL to the actual asset

    // Contextual Scoping (for embedding in specific modules)
    contextType: FileContextType;
    contextId?: string; // e.g., 'db-1-page-1'

    // Metadata
    createdAt: string;
    updatedAt: string;
    ownerId?: string;
}
