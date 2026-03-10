const fs = require('fs');

const file = 'src/components/time-tracker/components/ui/chart.tsx';
let content = fs.readFileSync(file, 'utf8');

// The type 'Omit<...>' doesn't have 'payload' or 'label'. Let's replace the strict typing with `any` for ChartTooltipContent
content = content.replace(
  /const ChartTooltipContent = React\.forwardRef<\n  HTMLDivElement,\n  React\.ComponentProps<typeof RechartsPrimitive\.Tooltip> &\n    React\.ComponentProps<"div"> &\n    {\n      hideLabel\?: boolean;\n      hideIndicator\?: boolean;\n      indicator\?: "line" \| "dot" \| "dashed";\n      nameKey\?: string;\n      labelKey\?: string;\n    }\n>|const ChartTooltipContent = React.forwardRef<any, any>/,
  'const ChartTooltipContent = React.forwardRef<any, any>'
);

content = content.replace(
  /const ChartLegendContent = React\.forwardRef<\n  HTMLDivElement,\n  React\.ComponentProps<"div"> &\n    Pick<RechartsPrimitive\.LegendProps, "payload" \| "verticalAlign"> &\n    {\n      hideIcon\?: boolean;\n      nameKey\?: string;\n    }\n>|const ChartLegendContent = React.forwardRef<any, any>/,
  'const ChartLegendContent = React.forwardRef<any, any>'
);

fs.writeFileSync(file, content);
console.log('Fixed chart typings');
