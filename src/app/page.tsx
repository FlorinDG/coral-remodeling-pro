"use client";

import { useState } from 'react';
import Image from "next/image";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import BookingModal from "@/components/BookingModal";
import ProjectGallery from "@/components/ProjectGallery";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar onBookClick={() => setIsModalOpen(true)} />
      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <Hero />

      {/* Services Section */}
      <section id="services" className="py-24 px-8 md:px-16 container mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Our Expertise</h2>
          <div className="w-20 h-1 bg-white" />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: "Kitchen Design", desc: "Bespoke culinary spaces tailored to your lifestyle.", icon: "🍳" },
            { title: "Bath Restoration", desc: "Transform your daily routine into a spa experience.", icon: "🛁" },
            { title: "Custom Additions", desc: "Expanding your horizons with seamless home extensions.", icon: "🏠" },
          ].map((service, i) => (
            <div key={i} className="glass-morphism p-8 rounded-3xl border border-white/5 hover:border-white/20 transition-all">
              <div className="text-4xl mb-6">{service.icon}</div>
              <h3 className="text-xl font-bold mb-4">{service.title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="py-24 px-8 md:px-16 bg-neutral-900/20">
        <div className="container mx-auto">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-4xl font-bold tracking-tight mb-4">Recent Portfolio</h2>
              <p className="text-neutral-500 uppercase tracking-widest text-xs font-bold">A glimpse into luxury</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <ProjectGallery
              title="Minimalist Loft Kitchen"
              location="Manhattan, NY"
              images={[
                { src: "/images/kitchen-hero.png", caption: "Wide angle view showing the open concept layout." },
                { src: "/images/kitchen-hero.png", caption: "Detail of the honed marble island and matte cabinetry." },
                { src: "/images/kitchen-hero.png", caption: "Custom lighting fixtures highlighting the texture." }
              ]}
            />
            <ProjectGallery
              title="Serenity Master Bath"
              location="Greenwich, CT"
              images={[
                { src: "/images/bathroom-hero.png", caption: "Freestanding soaking tub with panoramic views." },
                { src: "/images/bathroom-hero.png", caption: "Dual vanity with custom stone integration." },
                { src: "/images/bathroom-hero.png", caption: "Rainfall shower enclosure with frameless glass." }
              ]}
            />
            <ProjectGallery
              title="Chef's Contemporary Space"
              location="Scarsdale, NY"
              images={[
                { src: "/images/kitchen-portfolio-2.png", caption: "Professional grade appliances in a home setting." },
                { src: "/images/kitchen-portfolio-2.png", caption: "Integrated wine storage and coffee station." },
                { src: "/images/kitchen-portfolio-2.png", caption: "Ergonomic layout designed for serious cooking." }
              ]}
            />
            <ProjectGallery
              title="Oasis Master Suite"
              location="Westport, CT"
              images={[
                { src: "/images/bathroom-portfolio-2.png", caption: "Spa-inspired wet room design." },
                { src: "/images/bathroom-portfolio-2.png", caption: "Heated floors and towel warmers for comfort." },
                { src: "/images/bathroom-portfolio-2.png", caption: "Ambient lighting integration for relaxation." }
              ]}
            />
          </div>
        </div>
      </section>


      <footer id="contact" className="py-12 border-t border-white/5 text-center">
        <p className="text-xs text-neutral-600 uppercase tracking-[0.3em]">
          &copy; 2026 CORAL ENTERPRISES. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </main>
  );
}
