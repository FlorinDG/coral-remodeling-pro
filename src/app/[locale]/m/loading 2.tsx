export default function MobileLoading() {
    return (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6 animate-pulse">
            {/* Shimmering Identity */}
            <div className="space-y-2">
                <div className="h-7 w-48 bg-neutral-200 dark:bg-neutral-850 rounded-lg" />
                <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-850 rounded-lg" />
            </div>

            {/* Shimmering Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
                <div className="h-16 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />
                <div className="h-16 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />
                <div className="h-16 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />
            </div>

            {/* Shimmering Cash flow strip */}
            <div className="h-11 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />

            {/* Shimmering Primary Actions Grid */}
            <div className="grid grid-cols-3 gap-3">
                <div className="h-28 bg-neutral-200 dark:bg-neutral-850 rounded-2xl" />
                <div className="h-28 bg-neutral-200 dark:bg-neutral-850 rounded-2xl" />
                <div className="h-28 bg-neutral-200 dark:bg-neutral-850 rounded-2xl" />
            </div>

            {/* Shimmering secondary tiles */}
            <div className="grid grid-cols-2 gap-2">
                <div className="h-12 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />
                <div className="h-12 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />
            </div>

            {/* Shimmering footer indicator */}
            <div className="h-12 bg-neutral-200 dark:bg-neutral-850 rounded-xl" />
        </div>
    );
}
