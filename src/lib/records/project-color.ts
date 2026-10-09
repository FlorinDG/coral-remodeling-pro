/**
 * A project's colour — the ONE palette and the ONE resolver (GRID-SURFACE-1 / REVIEW-FIX-1 C2). Pure data: the
 * scheduler matrix, its table, the late-entry screens and the hooks all read it here. A project stores a colour NAME
 * ('teal') or a custom '#hex'; anything unknown is teal.
 */
export interface NotionColorEntry {
  name: string;
  value: string;
  bg: string;
}

export const NOTION_COLORS: readonly NotionColorEntry[] = [
  { name: 'blue',    value: '#3b82f6', bg: '#dbeafe' },
  { name: 'red',     value: '#ef4444', bg: '#fee2e2' },
  { name: 'amber',   value: '#f59e0b', bg: '#fef3c7' },
  { name: 'green',   value: '#339989', bg: '#33998920' },
  { name: 'violet',  value: '#8b5cf6', bg: '#ede9fe' },
  { name: 'pink',    value: '#ec4899', bg: '#fce7f3' },
  { name: 'teal',    value: '#14b8a6', bg: '#ccfbf1' },
  { name: 'orange',  value: '#f97316', bg: '#ffedd5' },
  { name: 'indigo',  value: '#6366f1', bg: '#e0e7ff' },
  { name: 'cyan',    value: '#06b6d4', bg: '#cffafe' },
  { name: 'lime',    value: '#84cc16', bg: '#ecfccb' },
  { name: 'rose',    value: '#e11d48', bg: '#ffe4e6' },
];


export function projectColorOf(nameOrHex?: string | null): NotionColorEntry {
  if (!nameOrHex) return NOTION_COLORS[6];
  if (nameOrHex.startsWith('#')) {
    return { name: 'custom', value: nameOrHex, bg: `${nameOrHex}20` };
  }
  const found = NOTION_COLORS.find(c => c.name === nameOrHex);
  return found || NOTION_COLORS[6];
}
