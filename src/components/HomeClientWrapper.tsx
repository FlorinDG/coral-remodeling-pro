"use client";

import { useState } from 'react';
import Navbar from "@/components/Navbar";
import BookingModal from "@/components/BookingModal";
import Footer from "@/components/Footer";

interface HomeClientWrapperProps {
    children: React.ReactNode;
}

export default function HomeClientWrapper({ children }: HomeClientWrapperProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <main className="min-h-screen bg-white text-neutral-900 dark:bg-black dark:text-white pt-10">
            <Navbar onBookClick={() => setIsModalOpen(true)} />
            <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

            {children}

            <Footer />
        </main>
    );
}
