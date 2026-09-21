import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next.nosync/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // NOTE: src/components/time-tracker/** removed for visibility (PRE-1b)
  ]),
  // Downgrade non-boundary rules to warnings so they do not block CI (visibility today, cleanup in LOC-2/3)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "react/display-name": "warn",
      "react/jsx-no-comment-textnodes": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // PRE-1 / BLOB-3: Only src/lib/storage/** may import @vercel/blob
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    ignores: ["src/lib/storage/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@vercel/blob",
              message: "ARCHITECTURAL RULE (BLOB-3): Only src/lib/storage/** is permitted to import @vercel/blob.",
            },
          ],
        },
      ],
    },
  },
  // PRE-1: L0 modules (storage, format, database-identity, kernel) must not import from UI or app layers
  {
    files: [
      "src/lib/kernel/**",
      "src/lib/storage/**",
      "src/lib/format/**",
      "src/lib/database-identity.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/**", "@/app/**", "**/components/**", "**/app/**", "@/lib/records/**", "@/lib/services/**"],
              message: "ARCHITECTURAL RULE (PRE-1): L0 modules may not import from components, app, or high-level services/records.",
            },
          ],
        },
      ],
    },
  },
  // PRE-1d.1 / R5-3: Cron jobs must not import prisma directly
  {
    files: ["src/app/api/cron/**/*.{ts,tsx,js,jsx}"],
    ignores: [
      // GRANDFATHERED — these cron routes predate R5 tenant-scoped scheduling.
      // R5 removes direct prisma access from cron routes. Do not add to this list.
      "src/app/api/cron/invoice-overdue/route.ts",
      "src/app/api/cron/reminders/route.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message: "ARCHITECTURAL RULE (R5-3): Cron jobs must not import prisma directly. Use tenant-scoped runner.",
            },
            {
              name: "@prisma/client",
              message: "ARCHITECTURAL RULE (R5-3): Cron jobs must not import prisma directly. Use tenant-scoped runner.",
            },
          ],
        },
      ],
    },
  },
  // PRE-1d.2 / R1-5: The Seraph gate (Nothing outside lib/data touches prisma directly)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    ignores: [
      "src/lib/data/**",
      "src/lib/prisma.ts",
  // GRANDFATHERED — these files import prisma directly and predate the seraph.
  // R1-7 removes them one module at a time. Do not add to this list.
  // The length of this array is the DI progress metric (coral-decision-dependency-injection.md).
      "src/app/*locale*/admin/content/page.tsx",
      "src/app/*locale*/admin/dashboard/page.tsx",
      "src/app/*locale*/admin/hr/leave/page.tsx",
      "src/app/*locale*/admin/hr/page.tsx",
      "src/app/*locale*/admin/layout.tsx",
      "src/app/*locale*/admin/portals/*id*/page.tsx",
      "src/app/*locale*/admin/projects/*id*/page.tsx",
      "src/app/*locale*/admin/projects/page.tsx",
      "src/app/*locale*/admin/services/*id*/page.tsx",
      "src/app/*locale*/admin/services/page.tsx",
      "src/app/*locale*/admin/settings/billing/page.tsx",
      "src/app/*locale*/admin/settings/billing/portal/route.ts",
      "src/app/*locale*/admin/settings/website/page.tsx",
      "src/app/*locale*/invoice/*id*/page.tsx",
      "src/app/*locale*/m/invoices/page.tsx",
      "src/app/*locale*/m/layout.tsx",
      "src/app/*locale*/m/page.tsx",
      "src/app/*locale*/m/purchases/page.tsx",
      "src/app/*locale*/m/quotes/page.tsx",
      "src/app/*locale*/m/settings/page.tsx",
      "src/app/*locale*/quote/*id*/page.tsx",
      "src/app/*locale*/services/*slug*/page.tsx",
      "src/app/*locale*/superadmin/billing/page.tsx",
      "src/app/*locale*/superadmin/page.tsx",
      "src/app/*locale*/superadmin/tenants/page.tsx",
      "src/app/*locale*/workhub/layout.tsx",
      "src/app/actions/accept-invoice.ts",
      "src/app/actions/accept-quote.ts",
      "src/app/actions/cms.ts",
      "src/app/actions/create-invoice.ts",
      "src/app/actions/crm.ts",
      "src/app/actions/get-contacts.ts",
      "src/app/actions/get-invoice.ts",
      "src/app/actions/global-databases.ts",
      "src/app/actions/hr-admin.ts",
      "src/app/actions/hr-announcements.ts",
      "src/app/actions/hr-documents.ts",
      "src/app/actions/internal-projects.ts",
      "src/app/actions/next-document-number.ts",
      "src/app/actions/notifications.ts",
      "src/app/actions/pages.ts",
      "src/app/actions/reconstruct-document.ts",
      "src/app/actions/send-invoice.ts",
      "src/app/actions/stripe-payments.ts",
      "src/app/actions/superadmin.ts",
      "src/app/actions/tasks.ts",
      "src/app/actions/timesheets.ts",
      "src/app/actions/update-invoice.ts",
      "src/app/api/admin/backfill-peppol/route.ts",
      "src/app/api/admin/backfill-worker-ids/route.ts",
      "src/app/api/admin/schema-cleanup/route.ts",
      "src/app/api/auth/accept-invite/route.ts",
      "src/app/api/auth/admin-reset-password/route.ts",
      "src/app/api/auth/forgot-password/route.ts",
      "src/app/api/auth/resend-verification/route.ts",
      "src/app/api/auth/reset-password/route.ts",
      "src/app/api/auth/signup/route.ts",
      "src/app/api/auth/verify/route.ts",
      "src/app/api/bookings/route.ts",
      "src/app/api/calendar/accounts/route.ts",
      "src/app/api/calendar/events/route.ts",
      "src/app/api/calendar/portals/route.ts",
      "src/app/api/calendar/sync/route.ts",
      "src/app/api/cron/invoice-overdue/route.ts",
      "src/app/api/cron/reminders/route.ts",
      "src/app/api/debug/layout/route.ts",
      "src/app/api/email/accounts/route.ts",
      "src/app/api/email/connect/google/callback/route.ts",
      "src/app/api/emergency-access/route.ts",
      "src/app/api/financials/export/route.ts",
      "src/app/api/hr/*entity*/route.ts",
      "src/app/api/hr/audit-logs/route.ts",
      "src/app/api/hr/lib/team-scoping.ts",
      "src/app/api/hr/link-employees/route.ts",
      "src/app/api/hr/timesheet-export/route.tsx",
      "src/app/api/hr/timesheet-rates/route.ts",
      "src/app/api/hr/timesheet-rates/undo/route.ts",
      "src/app/api/hr/timesheet-reports/route.ts",
      "src/app/api/integrations/parse-pdf/route.ts",
      "src/app/api/leads/route.ts",
      "src/app/api/notifications/mark-read/route.ts",
      "src/app/api/notifications/route.ts",
      "src/app/api/peppol/inbox/*id*/route.ts",
      "src/app/api/peppol/inbox/route.ts",
      "src/app/api/peppol/onboard/route.ts",
      "src/app/api/peppol/register/route.ts",
      "src/app/api/peppol/send/route.ts",
      "src/app/api/peppol/validate/route.ts",
      "src/app/api/portals/documents/route.ts",
      "src/app/api/portals/media/route.ts",
      "src/app/api/portals/messages/route.ts",
      "src/app/api/portals/route.ts",
      "src/app/api/portals/slug/*slug*/route.ts",
      "src/app/api/portals/tasks/route.ts",
      "src/app/api/portals/updates/route.ts",
      "src/app/api/portals/verify-password/route.ts",
      "src/app/api/scan/route.ts",
      "src/app/api/storefront-cms/route.ts",
      "src/app/api/stripe/cancel/route.ts",
      "src/app/api/stripe/checkout/route.ts",
      "src/app/api/stripe/portal/route.ts",
      "src/app/api/tenant/accountant/route.ts",
      "src/app/api/tenant/cancel/route.ts",
      "src/app/api/tenant/employees/*employeeId*/route.ts",
      "src/app/api/tenant/employees/route.ts",
      "src/app/api/tenant/expenses/approve/route.ts",
      "src/app/api/tenant/profile/route.ts",
      "src/app/api/tenant/project-access/route.ts",
      "src/app/api/tenant/projects-list/route.ts",
      "src/app/api/tenant/users/*userId*/route.ts",
      "src/app/api/tenant/users/route.ts",
      "src/app/sitemap.ts",
      "src/auth.ts",
      "src/components/PromotionalBanner.tsx",
      "src/lib/cms.ts",
      "src/lib/dunning.ts",
      "src/lib/googleToken.ts",
      "src/lib/moduleGuard.ts",
      "src/lib/resolveWorkerIdentity.ts",
      "src/lib/services/payment-plan-service.ts",
      "src/lib/services/quote-service.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message: "ARCHITECTURAL RULE (R1-5): Direct prisma access is forbidden outside src/lib/data. Use scoped data accessor.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
