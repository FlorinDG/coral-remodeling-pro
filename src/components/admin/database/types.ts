export type PropertyType =
    | 'text'
    | 'number'
    | 'select'
    | 'multi_select'
    | 'date'
    | 'checkbox'
    | 'url'
    | 'email'
    | 'phone'
    | 'places'
    | 'relation'
    | 'rollup'
    | 'formula'
    | 'currency'
    | 'percent'
    | 'person'
    | 'created_time'
    | 'created_by'
    | 'last_edited_time'
    | 'last_edited_by'
    | 'variants';

export interface SelectOption {
    id: string;
    name: string;
    color: string;
}

export interface PropertyConfig {
    options?: SelectOption[]; // For select and multi_select
    format?: 'number' | 'number_with_commas' | 'percent' | 'euro' | 'dollar'; // For numbers
    relationDatabaseId?: string; // For relations
    relationDisplayPropertyId?: string; // Property to display instead of title
    rollupPropertyId?: string; // For rollups
    rollupTargetPropertyId?: string;
    rollupAggregation?: 'show_original' | 'extract_numbers' | 'sum' | 'count' | 'average'; // Defines calculation over fetched array
    formulaExpression?: string; // For formulas
}

export interface Property {
    id: string;
    name: string;
    type: PropertyType;
    config?: PropertyConfig;
}

export interface VariantOption {
    id: string;
    name: string;
    priceDelta: number; // +/- adjustment to the article's base price
}

export interface VariantAxis {
    id: string;
    name: string; // e.g. "Color", "Length"
    options: VariantOption[];
}

export type VariantsConfig = VariantAxis[];

export type BlockType = 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'todo' | 'toggle' | 'code' | 'quote' | 'callout' | 'divider' | 'image' | 'video' | 'text' | 'article' | 'bestek' | 'post' | 'section' | 'subsection' | 'line' | 'property_mention';

export interface Block {
    id: string;
    type: BlockType;
    content: string; // Rich text content or URL or Post Title
    properties?: Record<string, any>; // Formatting like bold, italic, color

    // --- Quotation Engine Pillars ---
    articleId?: string; // Foreign key to Articles DB
    bestekId?: string;  // Foreign key to Bestek DB

    quantity?: number;  // Standard row quantity
    unit?: string;      // Measurement standard (e.g., m2, stuks)

    brutoPrice?: number;
    discountPercent?: number;
    costPrice?: number; // Derived: Bruto - Discount
    margePercent?: number;
    verkoopPrice?: number; // Derived: Cost + Marge

    // --- Invoice Engine Fields ---
    unitPrice?: number;   // Unit price excl. VAT (invoice-specific, replaces verkoopPrice column)
    vatRate?: number;     // Per-line VAT rate: 21, 12, 6, 0 (default 21)
    vatMedecontractant?: boolean; // Per-line medecontractant flag (BTW verlegd → 0%)

    children?: Block[]; // Compound nesting architecture (essential for `section` / `subsection` / `post` blocks)

    // --- Phase 10: Advanced Profitability & Hierarchies ---
    isOptional?: boolean; // If true, omit from Grand Total
    calculationType?: 'levering' | 'materieel' | 'loon' | 'indirect'; // Used for the final Reporting Matrix

    // --- Phase 11: Product Variants ---
    selectedVariants?: Record<string, string>; // Maps axisId -> optionId

    // --- @prop / @this_page Mention Config ---
    mentionConfig?: {
        type: 'prop' | 'this_page';          // Which trigger created this mention
        databaseId: string;                    // Target database ID
        propertyId: string;                    // Target property ID
        filter?: {                             // Optional filter chain
            propertyId: string;                // Property to filter by
            value?: string;                    // Static value (optional, resolved at render)
        };
        aggregator?: 'first' | 'last' | 'count' | 'sum' | 'avg' | 'list'; // Default: 'first'
    };
}

// A generic primitive type for property values
export type PropertyValue = string | number | boolean | string[] | any[] | null | VariantsConfig;

export interface Page {
    id: string;
    databaseId: string;
    coverImage?: string | null;
    icon?: string | null;
    properties: Record<string, PropertyValue>; // Keys are Property IDs
    order?: number; // Universal sorting index for drag-and-drop structural rows
    blocks: Block[]; // The rich text content inside the page
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastEditedBy: string;
    driveFolderId?: string; // Phase 7.1: Maps this row to a specific Google Drive folder
}

export type FilterOperator =
    | 'equals'
    | 'does_not_equal'
    | 'contains'
    | 'does_not_contain'
    | 'starts_with'
    | 'ends_with'
    | 'is_empty'
    | 'is_not_empty'
    | 'before'
    | 'after'
    | 'on_or_before'
    | 'on_or_after';

export interface FilterRule {
    id: string;
    propertyId: string;
    operator: FilterOperator;
    value?: string | number | boolean | null;
}

export interface FilterGroup {
    id: string;
    operator: 'and' | 'or';
    filters: (FilterRule | FilterGroup)[];
}

export type ViewType = 'table' | 'board' | 'calendar' | 'timeline';

export interface ViewPropertyState {
    propertyId: string;
    width?: number;
    hidden?: boolean;
    order?: number;
}

export interface DatabaseView {
    id: string;
    name: string;
    type: ViewType;
    config?: {
        // Board / Kanban
        groupByPropertyId?: string;        // Column grouping (select/status)
        kanbanCardCoverPropertyId?: string; // Image property for card cover
        kanbanWipLimits?: Record<string, number>; // Column ID → max cards
        kanbanCollapsedColumns?: string[];  // IDs of collapsed columns

        // Calendar
        datePropertyId?: string;           // Date column

        // Timeline
        startDatePropertyId?: string;      // Bar left edge
        endDatePropertyId?: string;        // Bar right edge
        timelineGroupByPropertyId?: string; // Row grouping (select/person)
        timelineScale?: 'day' | 'week' | 'month' | 'quarter';
    };
    filters?: FilterRule[]; // View-specific filters
    sorts?: SortRule[];     // View-specific sorts
    propertiesState?: ViewPropertyState[]; // Track column widths, visibility, order per view
}

export interface Database {
    id: string;
    name: string;
    description: string | null;
    icon?: string | null;
    coverImage?: string | null;
    properties: Property[];
    pages: Page[]; // In a real DB, pages would be a separate table queried by databaseId
    views: DatabaseView[]; // Saved views for this database
    activeFilters: FilterRule[]; // Deprecated: moving to view-specific filters, kept for compatibility
    activeSorts?: SortRule[]; // Deprecated: moving to view-specific sorts, kept for compatibility
    isTemplate?: boolean; // If true, it's a structural template rather than a live DB
    folderId?: string; // For organizational grouping
    createdAt: string;
    updatedAt: string;
    ownerId: string;
}

export type SortDirection = 'ascending' | 'descending';

export interface SortRule {
    id: string;
    propertyId: string;
    direction: SortDirection;
}
