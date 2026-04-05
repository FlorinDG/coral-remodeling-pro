'use client';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
            <div className="text-center font-sans space-y-4">
                <h1 className="text-4xl font-black text-neutral-900 dark:text-white">404</h1>
                <p className="text-lg text-neutral-500 font-medium">Page Not Found</p>
                <p className="text-sm text-neutral-400">The page you're trying to reach doesn't exist or was moved.</p>
                <div className="pt-2">
                    <a href="/" className="inline-flex items-center justify-center px-4 py-2 bg-[#d75d00] text-white rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-[#b04500] transition-colors">
                        Return Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}
