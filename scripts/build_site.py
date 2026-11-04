#!/usr/bin/env python3
"""Builds the deployable site into ./dist (used by Cloudflare Pages).

Only the files the app serves are copied, so source extras (package files,
workflows, large.jsx ...) never reach the public site. data/manifest.json lists
the colour files, because a static host can't list a folder the way the app's
loader used to rely on.
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist")
FILES = ["index.html", "App.jsx", "styles.css", "sw.js"]
DIRS = ["data", "textures"]

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
for f in FILES:
    shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
for d in DIRS:
    if os.path.isdir(os.path.join(ROOT, d)):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))

csv = sorted(f for f in os.listdir(os.path.join(OUT, "data")) if f.lower().endswith(".csv"))
if not csv:
    sys.exit("No CSV files in data/ - refusing to publish an empty site.")
with open(os.path.join(OUT, "data", "manifest.json"), "w") as fh:
    json.dump({"csv": csv}, fh, indent=1)

with open(os.path.join(OUT, "_headers"), "w") as fh:
    fh.write("""/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/App.jsx
  Content-Type: text/javascript; charset=utf-8
  Cache-Control: no-cache
/sw.js
  Content-Type: text/javascript; charset=utf-8
  Cache-Control: no-cache
/data/*
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
""")
print(f"dist ready: {len(csv)} data files, {sum(len(f) for _, _, f in os.walk(OUT))} files in all")
