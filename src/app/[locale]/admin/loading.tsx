// Minimal top progress bar for navigation feedback.
// Keeps the sidebar and layout visible without intrusive overlays.
export default function AdminLoading() {
    return (
        <div className="fixed top-0 left-0 right-0 z-[100000] h-1 pointer-events-none overflow-hidden">
            <div 
                className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 animate-loading-slide"
                style={{ width: "30%" }}
            />

            <style>{`
                @keyframes loading-slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                }
                .animate-loading-slide {
                    animation: loading-slide 1s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
