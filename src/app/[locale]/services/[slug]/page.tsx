"use client";

import { notFound, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import BookingModal from '@/components/BookingModal';
import { useState } from 'react';

const SERVICES = [
    {
        id: 'kitchen-design',
        title: "Kitchen Design",
        subtitle: "Culinary Excellence",
        image: "/images/kitchen-hero.png",
        description: `
      Our Kitchen Design service is dedicated to creating bespoke culinary spaces that are not only visually stunning but also highly functional. 
      We believe the kitchen is the heart of the home, a place where memories are made and culinary masterpieces are born.
      
      Our process begins with understanding your unique lifestyle and cooking habits. Whether you're a professional chef needing industrial-grade appliances and workflow, 
      or a family needing a durable, welcoming space for breakfast and homework, we tailor every detail to you.
      
      We specialize in:
      • Custom Cabinetry & Joinery
      • High-End Appliance Integration
      • Ergonomic Layout Optimization
      • Premium Stone Countertops (Marble, Quartz, Granite)
      • Specialized Lighting Schemes
    `
    },
    {
        id: 'bath-restoration',
        title: "Bath Restoration",
        subtitle: "Personal Sanctuaries",
        image: "/images/bathroom-hero.png",
        description: `
      Transform your daily routine into a luxurious spa experience with our Bath Restoration service. 
      We turn ordinary bathrooms into private sanctuaries of relaxation and rejuvenation.
      
      From master en-suites to guest powder rooms, we bring an element of refined elegance to every wet area. 
      Our designs focus on tranquility, using calming palettes, natural materials, and advanced fixtures.
      
      Key features often include:
      • Freestanding Soaking Tubs
      • Rainfall Showers with Steam Capabilities
      • Heated Floors & Towel Warmers
      • Custom Vanities with Integrated Storage
      • Mood Lighting & Ambience Control
    `
    },
    {
        id: 'custom-additions',
        title: "Custom Additions",
        subtitle: "Expand Your Horizons",
        image: "/images/kitchen-portfolio-2.png",
        description: `
      Our Custom Additions service allows you to expand your living space without compromising the architectural integrity of your home. 
      We specialize in seamless extensions that look and feel like they were always part of the original structure.
      
      Whether you need a new master suite, a sunroom, a home office, or an expanded entertainment area, we manage the entire process 
      from architectural planning to the final coat of paint.
      
      We handle:
      • Second-Story Additions
      • Garage Conversions
      • Sunrooms & Conservatories
      • In-Law Suites (ADUs)
      • Expanded Living Rooms & Dining Areas
    `
    },
    {
        id: 'whole-home',
        title: "Whole Home",
        subtitle: "Complete Transformation",
        image: "/images/bathroom-portfolio-2.png",
        description: `
      For those seeking a complete reinvention of their living environment, our Whole Home Renovation service offers a comprehensive solution. 
      This is for the homeowner who loves their location but needs a home that better reflects their current taste and lifestyle.
      
      We strip back the layers and reimagine the flow, function, and aesthetic of your entire property. 
      This is a holistic approach ensuring consistent design language throughout every room.
      
      Scope includes:
      • Structural Alterations & Open Floor Plans
      • Complete Electrical & Plumbing Overhauls
      • Flooring, Wall Treatments & Millwork
      • Smart Home Integration
      • Exterior Facelifts & Curb Appeal
    `
    }
];

export default function ServiceDetail() {
    const { slug } = useParams();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const service = SERVICES.find(s => s.id === slug);

    if (!service) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Service not found</div>;
    }

    return (
        <main className="min-h-screen bg-black text-white">
            <Navbar
                onBookClick={() => setIsModalOpen(true)}
                backLink={{ href: "/#services", label: "BACK TO SERVICES" }}
            />

            <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

            <div className="relative h-[60vh] w-full">
                <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover opacity-60"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />



                <div className="absolute bottom-0 left-0 p-8 md:p-16 w-full max-w-4xl">
                    <p className="text-orange-500 font-bold tracking-widest uppercase mb-4">{service.subtitle}</p>
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">{service.title}</h1>
                </div>
            </div>

            <div className="container mx-auto px-8 md:px-16 py-16 grid md:grid-cols-[2fr_1fr] gap-16">
                <div className="prose prose-invert prose-lg">
                    <p className="text-xl leading-relaxed text-neutral-300 whitespace-pre-line">
                        {service.description}
                    </p>
                </div>

                <div className="space-y-8">
                    <div className="glass-morphism p-8 rounded-3xl border border-white/10 sticky top-8">
                        <h3 className="text-2xl font-bold mb-4">Ready to Start?</h3>
                        <p className="text-neutral-400 mb-8">Schedule a consultation with our design team to discuss your {service.title.toLowerCase()} project.</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="w-full bg-[#d35400] text-white font-bold py-4 rounded-xl hover:bg-[#a04000] transition-colors shadow-lg shadow-[#d35400]/20"
                        >
                            BOOK CONSULTATION
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
