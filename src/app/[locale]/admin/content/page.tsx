import prisma from "@/lib/prisma";
import ContentForm from "./ContentForm";
import { SiteContentMap } from "@/lib/cms";
import PromotionalBannerEditor from "@/components/admin/PromotionalBannerEditor";
import ModuleTabs from "@/components/admin/ModuleTabs";

import { frontendTabs } from "@/config/tabs";
import PageTitle from "@/components/admin/PageTitle";

// Import translation defaults to pre-populate empty CMS fields
import en from "@/messages/en.json";
import nl from "@/messages/nl.json";
import fr from "@/messages/fr.json";
import ro from "@/messages/ro.json";

function getNestedValue(obj: any, path: string): string | null {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || null;
}

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

    // Pre-populate with JSON defaults if DB keys are missing
    const allKeys = Object.values(groups).flat();
    for (const key of allKeys) {
        if (!contentMap[key]) {
            contentMap[key] = {
                en: getNestedValue(en, key) || '',
                nl: getNestedValue(nl, key),
                fr: getNestedValue(fr, key),
                ro: getNestedValue(ro, key),
            };
        }
    }

    return (
        <div className="flex flex-col w-full h-full">
            <PageTitle title="Site Content" />
            <ModuleTabs tabs={frontendTabs} groupId="frontend" />
            <div className="p-8 space-y-12 max-w-5xl">

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
