import Image from 'next/image';
import Link from 'next/link';

export default function AdminHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 glass-morphism border-b border-white/5">
            <div className="container mx-auto px-8 h-20 flex items-center justify-between">
                <Link href="/admin" className="flex items-center gap-4 group">
                    <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
                        <Image
                            src="/images/logo.svg"
                            alt="Coral Enterprises Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">CORAL ADMIN</h1>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Operations Dashboard</p>
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <Link href="/" target="_blank" className="text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors">
                        View Live Site
                    </Link>
                    <div className="w-8 h-8 rounded-full bg-[#d35400] flex items-center justify-center text-xs font-bold">
                        A
                    </div>
                </div>
            </div>
        </header>
    );
}
