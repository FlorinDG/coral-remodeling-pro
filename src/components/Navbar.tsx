import Link from 'next/link';
import Image from 'next/image';

interface NavbarProps {
    onBookClick: () => void;
}

export default function Navbar({ onBookClick }: NavbarProps) {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass-morphism backdrop-blur-md h-20 flex items-center justify-between px-8 md:px-16">
            <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                    <Image
                        src="/images/logo.svg"
                        alt="Coral Enterprises Logo"
                        fill
                        className="object-contain"
                    />
                </div>
            </div>
            <div className="hidden md:flex gap-8 text-sm font-medium">
                <Link href="#services" className="hover:text-[#d35400] transition-colors">Services</Link>
                <Link href="#projects" className="hover:text-[#d35400] transition-colors">Projects</Link>
                <Link href="#contact" className="hover:text-[#d35400] transition-colors">Contact</Link>
            </div>
            <button
                onClick={onBookClick}
                className="bg-[#d35400] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[#a04000] transition-colors shadow-lg shadow-[#d35400]/20"
            >
                BOOK NOW
            </button>
        </nav>
    );
}
