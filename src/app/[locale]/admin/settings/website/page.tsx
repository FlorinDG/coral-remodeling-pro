"use server";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { settingsTabs } from "@/config/tabs";
import { Settings } from 'lucide-react';
import WebsiteSettingsConfig from "./WebsiteSettingsConfig";
import prisma from "@/lib/prisma";
import { SiteContentMap } from "@/lib/cms";

export default async function WebsiteSettingsPage() {
    // Fetch all global settings keys from the CMS
    const contents = await prisma.siteContent.findMany();

    // Map to a usable dictionary format to pass down into the client form
    const contentMap = contents.reduce((acc: SiteContentMap, curr) => {
        acc[curr.key] = { en: curr.valueEn, nl: curr.valueNl, fr: curr.valueFr, ro: curr.valueRo };
        return acc;
    }, {});

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={settingsTabs} groupId="settings" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Website Settings Configuration</h1>
                    <p className="text-neutral-500 font-medium text-sm mt-1">Configure global SEO routing, analytics, and primary domain configurations.</p>
                </div>
                <WebsiteSettingsConfig initialData={contentMap} />
            </div>
        </div>
    );
}
