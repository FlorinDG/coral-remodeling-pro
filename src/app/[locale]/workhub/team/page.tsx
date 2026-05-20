"use client";

import dynamic from "next/dynamic";

const EmployeesPage = dynamic(
    () => import("@/app/[locale]/admin/hr/employees/page"),
    { ssr: false }
);

/**
 * WorkHub Team Directory — re-uses the Employee Directory from admin HR.
 * Shows the full card-grid employee directory with profile detail views.
 */
export default function WorkHubTeamPage() {
    return (
        <div className="max-w-6xl mx-auto">
            <EmployeesPage />
        </div>
    );
}
