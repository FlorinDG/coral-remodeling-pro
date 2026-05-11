# Article Variant Pricing Architecture

This document explains how **Article Variants** are implemented in the platform. The implementation acts as a multi-dimensional pricing matrix attached to articles (products), functioning across three main areas: the data structure, the visual configurator, and the financial engine.

## 1. Data Structure (`src/components/admin/database/types.ts`)
Variants are built as a dedicated database column type (`PropertyType = 'variants'`). The structure uses an "Axis and Option" model:

*   **`VariantAxis`**: A dimension of variation (e.g., "Color", "Length", "Material").
*   **`VariantOption`**: The specific choices within an axis (e.g., "Matte Black", "2 Meters").
*   **`priceDelta`**: Every option carries a numerical `priceDelta`. This represents a direct `+/-` adjustment to the base price of the article (e.g., Matte Black adds `+€20`).

When an article is used in a document row (like a Quotation or Invoice), the selection is saved in the `Block` interface as `selectedVariants: Record<string, string>`, which maps the `axisId` to the chosen `optionId`.

## 2. Configuration UI (`src/components/admin/database/components/VariantsPropertyEditor.tsx`)
In the database modal (when viewing a specific article), variants are managed via a dedicated `VariantsPropertyEditor` component.
*   It provides a modal interface where admins can dynamically add new configuration axes.
*   Under each axis, admins can define the options and set the exact `priceDelta` modifier.
*   The entire JSON configuration is saved to the row's properties array under that specific column ID.

## 3. Financial Calculation (`src/components/admin/invoices/FinancialRowRenderer.tsx` & `src/components/admin/quotations/FinancialRowRenderer.tsx`)
This is where the variants actually affect the math. Inside your Invoice and Quotation engines:
*   The `FinancialRowRenderer` detects if the current row (`Block`) has an `articleId` and `selectedVariants`.
*   It retrieves the full variant configuration from the main Database.
*   It loops through the selected options, sums up all the `priceDelta` values, and **adds that sum directly to the base `brutoPrice`** of the row.
*   All subsequent calculations (discounts, margins, VAT, totals) are performed on this newly adjusted base price.

## 4. Document Rendering (`src/components/admin/invoices/InvoicePDFTemplate.tsx` & `src/components/admin/quotations/QuotationPDFTemplate.tsx`)
Finally, when generating a PDF, the system reads the `selectedVariants` dictionary. It maps the IDs back to their human-readable names and prints them directly below the article description in the format:
`[Axis Name: Option Name]` (e.g., `[Color: Matte Black]`, `[Size: Large]`), ensuring the client knows exactly what configuration they are paying for.
