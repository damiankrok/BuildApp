#!/usr/bin/env python3
"""pack.py <zip path> <delivery out dir> <part name> <relative path> [<relative path> ...] [--extra <abs file>=<rel name> ...]
Every ZIP is an ordinary, independent archive with one top folder `BuildPlan-V35418/`; unpack all parts into the same
place and the folders merge (the gallery's relative links then work). Each part carries its own README and manifest."""
import hashlib, os, sys, zipfile
zp, out, part = sys.argv[1:4]
rest = sys.argv[4:]
extra = []
if '--extra' in rest:
    i = rest.index('--extra'); extra = [e.split('=', 1) for e in rest[i + 1:]]; rest = rest[:i]
TOP = 'BuildPlan-V35418'
README = f"""BuildPlan v3.54.18 — prywatna dostawa, część: {part}

JAK ROZPAKOWAĆ I POŁĄCZYĆ
1. Rozpakuj WSZYSTKIE części (pliki BuildPlan-V35418-0*.zip) do TEGO SAMEGO katalogu.
   Każda część ma jeden folder główny „{TOP}/"; foldery o tej samej nazwie łączą się (scal, nie zastępuj).
2. Otwórz {TOP}/gallery.html w przeglądarce (działa offline; odsyłacze są względne).
3. Każda część jest zwykłym, niezależnym archiwum ZIP — można ją otworzyć osobno; bez pozostałych części
   część odsyłaczy galerii nie znajdzie plików.
4. Sumy kontrolne plików tej części: {TOP}/MANIFEST-{part}.sha256 (format: sha256  ścieżka).

ZAWARTOŚĆ PRYWATNA: rysunki wydawców (oryginały elewacji, rzutów, przekrojów) — nie publikować.
Klucza API nie ma w żadnym pliku (skan przed spakowaniem).
"""
files = []
for rel in rest:
    p = os.path.join(out, rel)
    if os.path.isdir(p):
        for d, _, fs in os.walk(p):
            for f in sorted(fs):
                a = os.path.join(d, f); files.append((a, os.path.relpath(a, out)))
    elif os.path.exists(p): files.append((p, rel))
    else: raise SystemExit(f'missing {p}')
for a, r in extra: files.append((a, r))
man = []
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for a, r in sorted(files, key=lambda x: x[1]):
        b = open(a, 'rb').read(); man.append(f"{hashlib.sha256(b).hexdigest()}  {r}")
        z.writestr(zipfile.ZipInfo.from_file(a, f'{TOP}/{r}'), b, zipfile.ZIP_DEFLATED if not r.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.apk', '.zip')) else zipfile.ZIP_STORED)
    z.writestr(f'{TOP}/README-{part}.txt', README)
    z.writestr(f'{TOP}/MANIFEST-{part}.sha256', '\n'.join(man) + '\n')
print(os.path.basename(zp), os.path.getsize(zp), 'B', len(files), 'files', hashlib.sha256(open(zp, 'rb').read()).hexdigest())
