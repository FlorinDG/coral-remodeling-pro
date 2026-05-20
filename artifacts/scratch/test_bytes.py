import os
import lzma
import bz2
import zipfile

conv_dir = "/Users/florin/.gemini/antigravity-ide/conversations"
for f in sorted(os.listdir(conv_dir)):
    if f.endswith(".pb"):
        path = os.path.join(conv_dir, f)
        with open(path, "rb") as fh:
            data = fh.read()
        
        # Test bz2
        try:
            decomp = bz2.decompress(data)
            print(f"File {f}: BZ2 works! Size={len(decomp)}")
            continue
        except Exception:
            pass

        # Test lzma (xz)
        try:
            decomp = lzma.decompress(data)
            print(f"File {f}: LZMA works! Size={len(decomp)}")
            continue
        except Exception:
            pass

        # Test zip
        try:
            with zipfile.ZipFile(path) as z:
                print(f"File {f}: ZIP works! Members={z.namelist()}")
                continue
        except Exception:
            pass

        print(f"File {f}: No standard compression worked.")
