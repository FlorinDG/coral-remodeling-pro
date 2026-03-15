import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "@/config/tabs";
import PageTitle from "@/components/admin/PageTitle";

export default function ExpensesCreditNotesPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <PageTitle title="Expense Credit Notes" />
            <ModuleTabs tabs={financialTabs} groupId="financials" />
            <div className="w-full h-full p-6 pb-10">

                <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                    <p>Supplier credit tracking will be implemented here.</p>
                </div>
            </div>
        </div>
    );
}
