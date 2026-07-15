#!/bin/bash
file="src/app/[locale]/admin/financials/expenses/invoices/page.tsx"
# Insert import if missing
if ! grep -q "useSearchParams" "$file"; then
    sed -i '' 's/import { useState/import { useSearchParams } from "next\/navigation";\nimport { useState/g' "$file"
fi
# Add useSearchParams hook and initial state if missing
if ! grep -q "searchParams\.get" "$file"; then
    sed -i '' 's/const \[selectedInvoiceId, setSelectedInvoiceId\] = useState<string | null>(null);/const searchParams = useSearchParams();\n    const openParam = searchParams.get("open");\n    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(openParam);/g' "$file"
fi
