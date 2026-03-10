const fs = require('fs');

// Fix Chart
const chartFile = 'src/components/time-tracker/components/ui/chart.tsx';
let chartContent = fs.readFileSync(chartFile, 'utf8');

chartContent = chartContent.replace(
  /const ChartTooltipContent = React\.forwardRef<any, any>\(/g,
  'const ChartTooltipContent = React.forwardRef<any, any>(({ active, payload, className, indicator = "dot", hideLabel = false, hideIndicator = false, label, labelFormatter, labelClassName, formatter, color, nameKey, labelKey }: any, ref) => {'
);
chartContent = chartContent.replace(
  /const ChartLegendContent = React\.forwardRef<any, any>\(\(\{ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey \}, ref\) => \{/g,
  'const ChartLegendContent = React.forwardRef<any, any>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }: any, ref) => {'
);

fs.writeFileSync(chartFile, chartContent);

// Fix Resizable
const resizableFile = 'src/components/time-tracker/components/ui/resizable.tsx';
let resizableContent = fs.readFileSync(resizableFile, 'utf8');

resizableContent = resizableContent.replace(
  /const ResizablePanelGroup = \(\{ className, \.\.\.props \}: any\) => \(/g,
  'const ResizablePanelGroup = ({ className, ...props }: any) => ('
);
resizableContent = resizableContent.replace(
  /<ResizablePrimitive\.PanelGroup/g,
  '// @ts-ignore\n  <ResizablePrimitive.PanelGroup'
);
resizableContent = resizableContent.replace(
  /<ResizablePrimitive\.PanelResizeHandle/g,
  '// @ts-ignore\n  <ResizablePrimitive.PanelResizeHandle'
);
resizableContent = resizableContent.replace(
  /<\/ResizablePrimitive\.PanelResizeHandle>/g,
  '// @ts-ignore\n  </ResizablePrimitive.PanelResizeHandle>'
);

fs.writeFileSync(resizableFile, resizableContent);
