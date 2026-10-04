/**
 * Save a server file WITHOUT navigating the app (client only).
 *
 * The WorkHub runs as an installed, standalone app: there is no browser bar. A plain link to a
 * PDF/Excel/download URL navigates the app ITSELF to the file — iOS shows the document and there is
 * no way back (Florin, 2026-10-01: "app goes to the pdf or excel screen, and dies there").
 *
 * So we never navigate: fetch the file, then
 *   1. the phone's share sheet (Save to Files, Mail, AirDrop…) when the Web Share API takes files;
 *   2. otherwise a blob download with an object URL (desktop browsers, Android).
 * A failed fetch throws a named error the caller shows (ERROR-SURFACING).
 */
export async function saveFile(url: string, fallbackName: string): Promise<void> {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`download failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    const blob = await res.blob();
    const name = filenameFrom(res.headers.get('Content-Disposition')) || fallbackName;
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });

    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean }) : null;
    if (nav?.share && nav.canShare?.({ files: [file] })) {
        try {
            await nav.share({ files: [file], title: name });
            return;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return; // the user closed the sheet
            // fall through to a plain download
        }
    }

    const objectUrl = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

function filenameFrom(disposition: string | null): string | null {
    if (!disposition) return null;
    const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (star) { try { return decodeURIComponent(star[1]); } catch { /* fall through */ } }
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    return plain ? plain[1] : null;
}
