const fs = require('fs');

const file = 'src/components/time-tracker/components/ui/resizable.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace typing to any since we just verified the version
content = content.replace(
  /const ResizablePanelGroup = \({ className, \.\.\.props }: React\.ComponentProps<typeof ResizablePrimitive\.PanelGroup>\) => \(/g,
  'const ResizablePanelGroup = ({ className, ...props }: any) => ('
);

content = content.replace(
  /const ResizableHandle = \(\{\n  withHandle,\n  className,\n  \.\.\.props\n\}: React\.ComponentProps<typeof ResizablePrimitive\.PanelResizeHandle> & \{\n  withHandle\?: boolean;\n\}\) => \(/,
  'const ResizableHandle = ({\n  withHandle,\n  className,\n  ...props\n}: any) => ('
);

fs.writeFileSync(file, content);
