import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "../invoices/page";

export default function ExpensesCreditNotesPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Expense Credit Notes</h1>
                    <p className="text-sm text-neutral-500">Manage received credit notes to offset incoming invoices.</p>
                </div>

                <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                    <p>Supplier credit tracking will be implemented here.</p>
                </div>
            </div>
        </div>
    );
}
