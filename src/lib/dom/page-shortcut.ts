/**
 * GRID-REPLACE-5 review · a PAGE shortcut never acts on a key typed inside a modal dialog.
 *
 * The overlay shield (deleted with the old grid) stopped every key inside a modal from reaching the page — it also
 * kept, e.g., the quote editor's Cmd+Z (block undo) from firing while one typed in the send dialog. Without it, the
 * rule lives where it belongs: modals declare themselves (`role="dialog" aria-modal="true"`, also what assistive
 * technology needs) and every page-level shortcut asks this before acting.
 */
export function isFromModal(target: EventTarget | null): boolean {
    const el = target as { closest?: (sel: string) => unknown } | null;
    return !!el && typeof el.closest === 'function' && !!el.closest('[aria-modal="true"]');
}
