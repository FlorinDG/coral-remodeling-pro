"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown, X, Phone, Mail, MapPin, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectImage {
    src: string;
    caption: string;
}

interface ProjectGalleryProps {
    title: string;
    location: string;
    images: ProjectImage[];
}

export default function ProjectGallery({ title, location, images }: ProjectGalleryProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <>
            {/* Card View */}
            <motion.div
                layoutId={`card-${title}`}
                onClick={() => setIsOpen(true)}
                className="group relative aspect-[4/3] rounded-[2rem] overflow-hidden border border-white/10 cursor-pointer"
                whileHover={{ scale: 0.98 }}
                transition={{ duration: 0.3 }}
            >
                <Image
                    src={images[0].src}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-x-0 bottom-0 p-8 z-20 bg-gradient-to-t from-black via-black/60 to-transparent">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <motion.h4 layoutId={`title-${title}`} className="text-xl font-bold text-white mb-1">{title}</motion.h4>
                        <motion.p layoutId={`loc-${title}`} className="text-sm text-neutral-400 mb-4">{location}</motion.p>

                        {/* Ghost Button */}
                        <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d35400] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            View Project <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Full Screen Modal */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center">
                        {/* Backdrop Blur */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            style={{ willChange: "opacity" }}
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal Content */}
                        <motion.div
                            layoutId={`card-${title}`}
                            className="relative w-full h-full md:w-[95vw] md:h-[90vh] bg-neutral-900/40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row z-10"
                            style={{ willChange: "transform" }}
                            transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.5 }}
                        >

                            {/* Close Button */}
                            <motion.button
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ delay: 0.2 }}
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-6 z-[60] p-2 bg-black/50 hover:bg-white hover:text-black rounded-full transition-colors backdrop-blur-md"
                            >
                                <X className="w-6 h-6" />
                            </motion.button>

                            {/* Floating Contact Buttons - Desktop (Centered on Divider) */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ delay: 0.3 }}
                                className="hidden md:flex absolute left-[33.33333%] top-1/2 -translate-y-1/2 -translate-x-1/2 z-[60] flex-col items-center justify-center gap-4 p-4 bg-[#d35400] rounded-full shadow-xl shadow-black/20 w-16"
                            >
                                <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="p-3 bg-white text-[#d35400] hover:bg-neutral-100 rounded-full transition-colors shadow-sm" title="WhatsApp">
                                    <Phone className="w-5 h-5 fill-current" />
                                </a>
                                <a href="mailto:contact@coral-enterprises.com" className="p-3 bg-white text-[#d35400] hover:bg-neutral-100 rounded-full transition-colors shadow-sm" title="Email">
                                    <Mail className="w-5 h-5" />
                                </a>
                                <a href="#map" className="p-3 bg-white text-[#d35400] hover:bg-neutral-100 rounded-full transition-colors shadow-sm" title="Location">
                                    <MapPin className="w-5 h-5 fill-current" />
                                </a>
                            </motion.div>

                            {/* Mobile Floating Contact Buttons (Right Edge of Screen) */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: 0.3 }}
                                className="flex md:hidden absolute right-4 bottom-8 z-[60] flex-row gap-2 p-2 bg-[#d35400] rounded-full shadow-xl shadow-black/20"
                            >
                                <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="p-2 bg-white text-[#d35400] hover:bg-neutral-100 rounded-full transition-colors shadow-sm" title="WhatsApp">
                                    <Phone className="w-4 h-4 fill-current" />
                                </a>
                                <a href="mailto:contact@coral-enterprises.com" className="p-2 bg-white text-[#d35400] hover:bg-neutral-100 rounded-full transition-colors shadow-sm" title="Email">
                                    <Mail className="w-4 h-4" />
                                </a>
                                <a href="#map" className="p-2 bg-white text-[#d35400] hover:bg-neutral-100 rounded-full transition-colors shadow-sm" title="Location">
                                    <MapPin className="w-4 h-4 fill-current" />
                                </a>
                            </motion.div>

                            {/* Left Column: Article Content */}
                            <div className="w-full md:w-1/3 p-8 md:p-12 flex flex-col justify-center bg-black/60 backdrop-blur-md relative border-r border-white/5">
                                {/* Text Fade Transition */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentIndex}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.7 }}
                                    >
                                        <span className="text-[#d35400] font-bold tracking-widest text-xs uppercase mb-4 block">
                                            Project Details
                                        </span>
                                        <motion.h2 layoutId={`title-${title}`} className="text-3xl md:text-5xl font-black mb-4 leading-tight">{title}</motion.h2>
                                        <motion.p layoutId={`loc-${title}`} className="text-lg text-white/80 font-medium mb-6">{location}</motion.p>
                                        <div className="w-12 h-1 bg-[#d35400] mb-8" />

                                        <p className="text-neutral-400 leading-relaxed text-sm md:text-base">
                                            {images[currentIndex].caption || "Experience luxury living with our bespoke design solutions. Every detail is curated to enhance your lifestyle, blending functionality with timeless aesthetics."}
                                            <br /><br />
                                            This perspective highlights the meticulous attention to material selection and lighting integration, creating an atmosphere of refined elegance.
                                        </p>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Mobile Navigation Controls (only visible on small screens) */}
                                <div className="flex md:hidden gap-4 mt-8">
                                    <button onClick={prevImage} className="p-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-colors">
                                        <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                                    </button>
                                    <button onClick={nextImage} className="p-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-colors">
                                        <ChevronDown className="w-5 h-5 rotate-[-90deg]" />
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Vertical Image Slider */}
                            <div className="w-full md:w-2/3 h-[50vh] md:h-full relative bg-neutral-900 group">
                                {/* Images Stack */}
                                <AnimatePresence initial={false} custom={currentIndex}>
                                    <motion.div
                                        key={currentIndex}
                                        custom={currentIndex}
                                        initial={{ y: "100%", opacity: 0 }}
                                        animate={{ y: "0%", opacity: 1 }}
                                        exit={{ y: "-100%", opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                        drag="y"
                                        dragConstraints={{ top: 0, bottom: 0 }}
                                        dragElastic={1}
                                        onDragEnd={(e, { offset, velocity }) => {
                                            const swipe = Math.abs(offset.y) * velocity.y;
                                            const swipeConfidenceThreshold = 10000;

                                            // Swipe Up (Negative Velocity) -> Next Image
                                            if (swipe < -swipeConfidenceThreshold) {
                                                nextImage();
                                            }
                                            // Swipe Down (Positive Velocity) -> Previous Image
                                            else if (swipe > swipeConfidenceThreshold) {
                                                prevImage();
                                            }
                                        }}
                                    >
                                        <Image
                                            src={images[currentIndex].src}
                                            alt={images[currentIndex].caption}
                                            fill
                                            className="object-cover"
                                            priority
                                        />
                                        {/* Vignette for text readability */}
                                        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/50 md:to-transparent" />
                                    </motion.div>
                                </AnimatePresence>

                                {/* Center Vertical Arrows - INCREASED SPACING */}
                                <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 invisible md:visible">
                                    <button
                                        onClick={prevImage}
                                        className="p-3 bg-black/20 hover:bg-white hover:text-black backdrop-blur-md border border-white/10 rounded-full text-white transition-all transform hover:scale-110"
                                    >
                                        <ChevronUp className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="p-3 bg-black/20 hover:bg-white hover:text-black backdrop-blur-md border border-white/10 rounded-full text-white transition-all transform hover:scale-110"
                                    >
                                        <ChevronDown className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Slide Counter */}
                                <div className="absolute bottom-8 right-8 z-30 font-mono text-xs tracking-widest bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10">
                                    {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
