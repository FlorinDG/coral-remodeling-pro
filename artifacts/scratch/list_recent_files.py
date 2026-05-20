import os
import time

repo_dir = "/Users/florin/Documents/GitHub/coral-remodeling-pro"
images = []
for root, dirs, files in os.walk(repo_dir):
    if any(ex in root for ex in [".git", "node_modules", ".next"]):
        continue
    for f in files:
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            path = os.path.join(root, f)
            mtime = os.path.getmtime(path)
            images.append((path, mtime))

images.sort(key=lambda x: x[1], reverse=True)
print(f"Found {len(images)} images in the workspace:")
for path, mtime in images[:20]:
    print(f"  {os.path.relpath(path, repo_dir)} - {time.ctime(mtime)}")
