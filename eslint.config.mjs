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
  // PRE-1 / R5-3: Cron jobs must not import prisma directly (ready ahead of R5)
  // To be switched on as 'error' when R5 scheduled work lands:
  // {
  //   files: ["src/app/api/cron/**"],
  //   rules: {
  //     "no-restricted-imports": [
  //       "error",
  //       {
  //         paths: [
  //           {
  //             name: "@/lib/prisma",
  //             message: "ARCHITECTURAL RULE (R5-3): Cron jobs must not import prisma directly. Use tenant-scoped runner.",
  //           },
  //           {
  //             name: "@prisma/client",
  //             message: "ARCHITECTURAL RULE (R5-3): Cron jobs must not import prisma directly.",
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // },
  // PRE-1 / R1-5: The Seraph gate (Nothing outside lib/data touches prisma.<tenantModel>)
  // To be switched on when TenantScopedClient lands in R1-4:
  // {
  //   files: ["src/**/*.{ts,tsx}"],
  //   ignores: ["src/lib/data/**", "src/lib/prisma.ts"],
  //   rules: {
  //     "no-restricted-imports": [
  //       "error",
  //       {
  //         paths: [
  //           {
  //             name: "@/lib/prisma",
  //             message: "ARCHITECTURAL RULE (R1-5): Direct prisma access is forbidden outside src/lib/data. Use scoped data accessor.",
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // },
]);

export default eslintConfig;
