import prisma from "@/lib/prisma";
import ContentForm from "./ContentForm";
import { SiteContentMap } from "@/lib/cms";

export default async function ContentEditor() {
    const contents = await prisma.siteContent.findMany();

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
        Hero: ["Hero.title", "Hero.description"],
        Stats: ["Hero.stats.projects", "Hero.stats.experience"],
    };

    return (
        <div className="space-y-8 max-w-5xl">
            <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">Editor</h2>
                <h1 className="text-4xl font-bold tracking-tight">Site Content</h1>
                <p className="text-neutral-500 mt-2">Manage all the static text content across the website from one place.</p>
            </div>

            <ContentForm initialData={contentMap} groups={groups} />
        </div>
    );
}
