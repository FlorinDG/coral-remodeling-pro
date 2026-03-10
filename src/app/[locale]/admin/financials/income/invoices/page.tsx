export default function IncomeInvoicesPage() {
    return (
        <div className="w-full h-full pb-10">
            <div className="mb-4">
                <h1 className="text-2xl font-bold">Income Invoices</h1>
                <p className="text-sm text-neutral-500">Track and manage outgoing invoices to clients.</p>
            </div>

            <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                <p>Invoice ledger structured to track status, due dates, and totals will be implemented here.</p>
            </div>
        </div>
    );
}
