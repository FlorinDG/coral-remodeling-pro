import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

export default function SuppliersPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Supplier Directory</h1>
                    <p className="text-sm text-neutral-500">Manage vendors, material suppliers, and active contracts.</p>
                </div>

                <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                    <p>Suppliers database will be implemented here.</p>
                </div>
            </div>
        </div>
    );
}
