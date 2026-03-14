import prisma from "@/lib/prisma";
import ContentForm from "./ContentForm";
import { SiteContentMap } from "@/lib/cms";
import PromotionalBannerEditor from "@/components/admin/PromotionalBannerEditor";
import ModuleTabs from "@/components/admin/ModuleTabs";

export const frontendTabs = [
    { label: 'PAGES / CONTENT', href: '/admin/content', id: 'content' },
    { label: 'SERVICES', href: '/admin/services', id: 'services' },
    { label: 'PORTFOLIO', href: '/admin/projects', id: 'portfolio' },
];

export default async function ContentEditor() {
    const contents = await prisma.siteContent.findMany();
    const banner = await prisma.promotionalBanner.findFirst();

    // Map to a more usable object structure
    const contentMap = contents.reduce((acc: SiteContentMap, curr) => {
        acc[curr.key] = {
            en: curr.valueEn,
            nl: curr.valueNl,
            fr: curr.valueFr,
            ro: curr.valueRo
        };
        return acc;
    }, {});

    const groups = {
        "Main Hero": ["Hero.title", "Hero.subtitle", "Hero.tagline", "Hero.description", "Hero.image"],
        "Navigation": ["Navbar.home", "Navbar.services", "Navbar.projects", "Navbar.book", "Navbar.fastInterventions.label", "Navbar.fastInterventions.number"],
        "Common Sections": ["Sections.expertise.title", "Sections.portfolio.title", "Sections.portfolio.tagline"],
        "Website Footer": ["Footer.description", "Footer.address", "Footer.vat", "Footer.quickLinks", "Footer.contact", "Footer.office", "Footer.legal", "Footer.fastInterventions"],
        "SEO Metadata": ["Metadata.title", "Metadata.description"]
    };

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={frontendTabs} groupId="frontend" />
            <div className="p-8 space-y-12 max-w-5xl">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Editor</h2>
                        <h1 className="text-4xl font-bold tracking-tight">Site Content</h1>
                        <p className="text-neutral-500 mt-2">Manage all the static text content across the website from one place.</p>
                    </div>
                </div>

                <section className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Marketing & Alerts</h3>
                    <PromotionalBannerEditor initialData={banner || undefined} />
                </section>

                <section className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Core Page Content</h3>
                    <ContentForm initialData={contentMap} groups={groups} />
                </section>
            </div>
        </div>
    );
}
