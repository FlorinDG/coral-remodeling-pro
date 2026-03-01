"use client";

import { useState } from 'react';
import Image from "next/image";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingModal from "@/components/BookingModal";
import ProjectGallery from "@/components/ProjectGallery";
import ServiceExpander from "@/components/ServiceExpander";
import { useTranslations } from 'next-intl';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = useTranslations();

  return (
    <main className="min-h-screen bg-white text-neutral-900 dark:bg-black dark:text-white pt-10">
      <Navbar onBookClick={() => setIsModalOpen(true)} />
      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <Hero />

      {/* Services Section */}
      <section id="services" className="py-24 bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white">
        <div className="container mx-auto px-8 md:px-16">
          <div className="mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4 text-neutral-900 dark:text-white">{t('Sections.expertise.title')}</h2>
            <div className="w-20 h-1 bg-neutral-900 dark:bg-white" />
          </div>

          <ServiceExpander />
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="py-24 px-8 md:px-16 bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white">
        <div className="container mx-auto">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-4xl font-bold tracking-tight mb-4 text-neutral-900 dark:text-white">{t('Sections.portfolio.title')}</h2>
              <p className="text-neutral-400 uppercase tracking-widest text-xs font-bold">{t('Sections.portfolio.tagline')}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <ProjectGallery
              title={t('Projects.kitchenLoft.title')}
              location={t('Projects.kitchenLoft.location')}
              images={[
                { src: "/images/project-loft-kitchen.png", caption: t('Projects.kitchenLoft.caption1') },
                { src: "/images/project-loft-kitchen-angle2.png", caption: t('Projects.kitchenLoft.caption2') },
                { src: "/images/project-loft-kitchen-before.png", caption: t('Projects.kitchenLoft.captionBefore') }
              ]}
            />
            <ProjectGallery
              title={t('Projects.masterBath.title')}
              location={t('Projects.masterBath.location')}
              images={[
                { src: "/images/project-serenity-bath.png", caption: t('Projects.masterBath.caption1') },
                { src: "/images/project-serenity-bath-angle2.png", caption: t('Projects.masterBath.caption2') },
                { src: "/images/project-serenity-bath-before.png", caption: t('Projects.masterBath.captionBefore') }
              ]}
            />
            <ProjectGallery
              title={t('Projects.contemporaryKitchen.title')}
              location={t('Projects.contemporaryKitchen.location')}
              images={[
                { src: "/images/project-chef-kitchen.png", caption: t('Projects.contemporaryKitchen.caption1') },
                { src: "/images/project-chef-kitchen-angle2.png", caption: t('Projects.contemporaryKitchen.caption2') },
                { src: "/images/project-chef-kitchen-before.png", caption: t('Projects.contemporaryKitchen.captionBefore') }
              ]}
            />
            <ProjectGallery
              title={t('Projects.masterSuite.title')}
              location={t('Projects.masterSuite.location')}
              images={[
                { src: "/images/project-oasis-suite.png", caption: t('Projects.masterSuite.caption1') },
                { src: "/images/project-oasis-suite-angle2.png", caption: t('Projects.masterSuite.caption2') },
                { src: "/images/project-oasis-suite-before.png", caption: t('Projects.masterSuite.captionBefore') }
              ]}
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
