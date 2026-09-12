import { useState } from "react";
import { Maximize2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

export function DocumentViewerCard({ url, isReconstructed }: { url: string; isReconstructed?: boolean }) {
    const [zoom, setZoom] = useState(1);
    const [isFullScreen, setIsFullScreen] = useState(false);

    if (!url) return null;
    
    // Ensure the URL is served via the authenticated route if it's not an external URL
    const finalUrl = url.startsWith('http') ? url : (url.startsWith('/api/') ? url : `/api/files/${encodeURIComponent(url)}`);

    return (
        <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm ${isFullScreen ? 'fixed inset-4 z-50 shadow-2xl' : 'h-[600px] xl:col-span-2 relative mb-4'}`}>
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                        Document Preview
                    </div>
                    {isReconstructed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 uppercase tracking-wider">
                            Gereconstrueerd document
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setZoom(z => Math.min(z + 0.15, 3))} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button onClick={() => setZoom(1)} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 text-[10px] font-bold text-neutral-600 uppercase">
                        Reset
                    </button>
                    <div className="w-px h-4 bg-neutral-300 dark:bg-white/20 mx-1" />
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="flex-1 w-full h-full relative overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <iframe
                    src={finalUrl}
                    className="w-full h-full border-none bg-white transition-transform duration-200 origin-center"
                    style={{ transform: `scale(${zoom})` }}
                    title="Document Preview"
                />
            </div>
        </div>
    );
}
