import os
import re

files = [
    'src/app/actions/accept-invoice.ts',
    'src/app/actions/accept-quote.ts',
    'src/app/actions/pages.ts',
    'src/app/actions/tasks.ts',
    'src/app/api/admin/backfill-peppol/route.ts',
    'src/app/api/cron/vat-backfill/route.ts',
    'src/app/api/peppol/inbox/route.ts',
    'src/app/api/portals/route.ts',
    'src/app/api/portals/tasks/route.ts',
    'src/app/api/scan/route.ts',
    'src/app/api/stripe/webhook/route.ts',
    'src/app/api/test-payment-plan/route.ts',
    'src/lib/services/payment-plan-service.ts',
    'src/lib/services/quote-service.ts'
]

def find_closing_bracket(text, start_idx):
    depth = 1
    for i in range(start_idx, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return i
    return -1

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        content = f.read()
    
    # We will search for 'prisma.globalPage.'
    # Then find 'data: {'
    new_content = ""
    last_idx = 0
    
    for match in re.finditer(r'prisma\.globalPage\.(?:update|create|upsert)\s*\(\s*\{', content):
        start = match.start()
        # Find 'data: {'
        data_match = re.search(r'data\s*:\s*\{', content[start:])
        if data_match:
            data_start = start + data_match.end()
            data_end = find_closing_bracket(content, data_start)
            if data_end != -1:
                inner_data = content[data_start:data_end]
                if 'lastEditedBy' not in inner_data:
                    # Insert lastEditedBy: 'SYSTEM',
                    new_content += content[last_idx:data_start] + "\n                lastEditedBy: 'SYSTEM',"
                    last_idx = data_start
    new_content += content[last_idx:]
    
    with open(file_path, 'w') as f:
        f.write(new_content)
    print(f"Updated {file_path}")
