#!/usr/bin/env python3
"""Check the German UI strings against the keys used in the source.

  scripts/i18n-check.py          fail on missing / unused / placeholder-mismatched keys
  scripts/i18n-check.py --keys   print every key the source uses

Keys are the English text passed to `tr("…")` and `plural(n, "…", "…")`
(client/i18n.ts). Translations live in client/locales/de.ts.
"""
import glob, re, sys

SOURCES = sorted(glob.glob("client/*.ts") + glob.glob("shared/**/*.ts", recursive=True))
DE_FILE = "client/locales/de.ts"
LIT = r'"((?:[^"\\]|\\.)*)"'

def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")

used = {}
for path in SOURCES:
    src = open(path).read()
    for m in re.finditer(r"\btr\(\s*" + LIT, src):
        used.setdefault(unescape(m.group(1)), path)
    for m in re.finditer(r"\bplural\([^,()]*(?:\([^()]*\)[^,()]*)*,\s*" + LIT + r",\s*" + LIT, src):
        used.setdefault(unescape(m.group(1)), path)
        used.setdefault(unescape(m.group(2)), path)

if "--keys" in sys.argv:
    for k in sorted(used):
        print(k)
    sys.exit(0)

de = {}
for m in re.finditer(r"^\s*" + LIT + r":\s*" + LIT + r",?\s*$", open(DE_FILE).read(), re.M):
    key, val = unescape(m.group(1)), unescape(m.group(2))
    if key in de:
        print(f"duplicate key: {key!r}")
    de[key] = val

ph = lambda s: sorted(set(re.findall(r"\{(\w+)\}", s)))
missing = sorted(k for k in used if k not in de or not de[k])
unused = sorted(k for k in de if k not in used)
bad = sorted(k for k in used if k in de and de[k] and ph(k) != ph(de[k]))

for k in missing:
    print(f"missing:  {k!r}  ({used[k]})")
for k in unused:
    print(f"unused:   {k!r}")
for k in bad:
    print(f"placeholders differ: {k!r} -> {de[k]!r}")
print(f"{len(used)} keys, {len(de)} German strings")
sys.exit(1 if missing or unused or bad else 0)
