import os
import zlib
import gzip
import bz2
import lzma
import re

conv_dir = "/Users/florin/.gemini/antigravity-ide/conversations"
files = [f for f in os.listdir(conv_dir) if f.endswith(".pb")]

print(f"Inspecting {len(files)} files for compression formats:")
for f in sorted(files):
    path = os.path.join(conv_dir, f)
    with open(path, "rb") as fh:
        data = fh.read()
        
    print(f"\nFile: {f} (size: {len(data)/1024/1024:.2f} MB)")
    
    # Try zlib
    try:
        decomp = zlib.decompress(data)
        print("  -> Successfully decompressed with zlib!")
        strings = re.findall(b"[\\x20-\\x7E]{30,}", decomp)
        print(f"  -> Found {len(strings)} printable strings")
        continue
    except Exception:
        pass
        
    # Try gzip
    try:
        decomp = gzip.decompress(data)
        print("  -> Successfully decompressed with gzip!")
        strings = re.findall(b"[\\x20-\\x7E]{30,}", decomp)
        print(f"  -> Found {len(strings)} printable strings")
        continue
    except Exception:
        pass

    # Try zlib with wbits (raw deflate or gzip)
    try:
        decomp = zlib.decompress(data, wbits=zlib.MAX_WBITS | 16)
        print("  -> Successfully decompressed with zlib (wbits=31)!")
        strings = re.findall(b"[\\x20-\\x7E]{30,}", decomp)
        print(f"  -> Found {len(strings)} printable strings")
        continue
    except Exception:
        pass

    try:
        decomp = zlib.decompress(data, wbits=-zlib.MAX_WBITS)
        print("  -> Successfully decompressed with zlib (wbits=-15)!")
        strings = re.findall(b"[\\x20-\\x7E]{30,}", decomp)
        print(f"  -> Found {len(strings)} printable strings")
        continue
    except Exception:
        pass

    print("  -> Could not decompress with standard zlib/gzip.")
