"""Copy product pictures that live on other websites into data/images/.

For every CSV in data/, an Image value that is an http(s) address is
downloaded, shrunk to at most 1200 px (JPEG, or PNG when it has transparency)
and saved as data/images/<file>/<name>-<hash>.<ext>; the Image value then
points at that path. data/images/index.json maps each outside address to its
repo path, so the app can also update copies it keeps on a device (pins).
Addresses that can't be fetched are left as they are and listed in the job
summary. Run again any time: pictures already copied are not fetched twice.
"""
import csv, glob, hashlib, io, json, os, re, sys, unicodedata, urllib.request

from PIL import Image

DATA = "data"
OUT = os.path.join(DATA, "images")
MAX = 1200
INDEX = os.path.join(OUT, "index.json")
UA = "Mozilla/5.0 (compatible; ColorSAMificator image mirror; +https://hc-sami.github.io/colorsamificator/)"


def slug(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60] or "colour"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=40) as r:
        ctype = r.headers.get("Content-Type", "")
        data = r.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise ValueError("larger than 20 MB")
    return ctype, data


def shrink(data):
    im = Image.open(io.BytesIO(data))
    im.load()
    alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    if max(im.size) > MAX:
        im.thumbnail((MAX, MAX), Image.LANCZOS)
    buf = io.BytesIO()
    if alpha:
        im.convert("RGBA").save(buf, "PNG", optimize=True)
        return buf.getvalue(), "png"
    im.convert("RGB").save(buf, "JPEG", quality=85, optimize=True, progressive=True)
    return buf.getvalue(), "jpg"


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    if os.path.exists(INDEX):
        with open(INDEX, encoding="utf-8") as f:
            index = json.load(f)
    copied, failed, files_changed = 0, [], 0
    for path in sorted(glob.glob(os.path.join(DATA, "*.csv"))):
        with open(path, newline="", encoding="utf-8") as f:
            text = f.read()
        rows = list(csv.DictReader(io.StringIO(text)))
        if not rows or "Image" not in rows[0]:
            continue
        fields = list(csv.DictReader(io.StringIO(text)).fieldnames)
        stem = os.path.splitext(os.path.basename(path))[0]
        changed = False
        for row in rows:
            url = (row.get("Image") or "").strip()
            if not re.match(r"^https?://", url, re.I):
                continue
            if url in index and os.path.exists(index[url]):
                row["Image"] = index[url]
                changed = True
                continue
            name = row.get("Noun") or row.get("Name") or row.get("ERP_Code") or "colour"
            try:
                ctype, data = fetch(url)
                if ctype and not ctype.lower().startswith("image/"):
                    raise ValueError(f"not a picture ({ctype.split(';')[0]})")
                out, ext = shrink(data)
            except Exception as e:  # keep the outside address; report it
                failed.append((path, name, url, str(e)[:120]))
                continue
            rel = f"{OUT}/{slug(stem)}/{slug(name)}-{hashlib.sha1(url.encode()).hexdigest()[:6]}.{ext}"
            os.makedirs(os.path.dirname(rel), exist_ok=True)
            with open(rel, "wb") as f:
                f.write(out)
            index[url] = rel
            row["Image"] = rel
            copied += 1
            changed = True
        if changed:
            buf = io.StringIO()
            w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\r\n", extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)
            new = buf.getvalue()
            if new.rstrip("\r\n") != text.rstrip("\r\n"):
                with open(path, "w", newline="", encoding="utf-8") as f:
                    f.write(new)
                files_changed += 1
    with open(INDEX, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1, sort_keys=True)
    lines = [f"Copied {copied} picture(s) into {OUT}; {files_changed} CSV file(s) updated; {len(failed)} couldn't be fetched."]
    if failed:
        lines += ["", "| File | Colour | Address | Why |", "|---|---|---|---|"]
        lines += [f"| {p} | {n} | {u} | {w} |" for p, n, u, w in failed]
    report = "\n".join(lines)
    print(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(report + "\n")


if __name__ == "__main__":
    sys.exit(main())
