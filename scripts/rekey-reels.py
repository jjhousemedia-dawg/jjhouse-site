#!/usr/bin/env python3
"""
Re-key src/data/reels.json from role-first buckets to project-first entries.

The old shape grouped work by the hat JJ wore, so a project he both produced and
cut existed as two unrelated rows in two buckets. The new shape is one entry per
project with a roles array, which is what the works credit ticker reads.

Purely mechanical. Roles come only from which buckets a video already appeared in.
Nothing is inferred or added.
"""
import json, re, unicodedata, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "data" / "reels.json"
OUT = ROOT / "src" / "data" / "projects.json"

# bucket key -> (role token for the ticker, category)
BUCKETS = {
    "director": ("Direct", "work"),
    "producer": ("Produce", "work"),
    "vfx-edit": ("VFX + Edit", "work"),
    "for-fun": (None, "personal"),
}

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^\w\s-]", "", s).strip().lower()
    return re.sub(r"[\s_-]+", "-", s)[:60].strip("-")

def split_title(t):
    """'Artist — Song' -> ('Artist', 'Song'). Em dash only; leave anything else whole."""
    if " — " in t:
        a, b = t.split(" — ", 1)
        return a.strip(), b.strip()
    return None, t.strip()

def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))

    projects = collections.OrderedDict()  # video id -> entry
    order_source = ["director", "producer", "vfx-edit", "for-fun"]
    dupes = collections.defaultdict(list)

    for bucket in order_source:
        section = data.get(bucket)
        if not section:
            continue
        role, category = BUCKETS[bucket]
        for r in section.get("reels", []):
            vid = r.get("id")
            title = r.get("title", "").strip()
            if not vid:
                continue
            if vid in projects:
                entry = projects[vid]
                dupes[vid].append(bucket)
                if role and role not in entry["roles"]:
                    entry["roles"].append(role)
                # a project appearing anywhere other than for-fun is work
                if category == "work":
                    entry["category"] = "work"
                continue
            artist, work = split_title(title)
            projects[vid] = {
                "slug": slugify(title),
                "title": title,
                "artist": artist,
                "work": work,
                "video": {"type": r.get("type"), "id": vid},
                "roles": [role] if role else [],
                "category": category,
                "featured": False,
                "anecdote": None,
            }
            dupes[vid].append(bucket)

    out = {
        "_note": (
            "Project-first. One entry per project; roles is what the works ticker cycles. "
            "Generated from the old role-keyed reels.json by scripts/rekey-reels.py. "
            "roles are only what the old data supported - 'VFX + Edit' is one token because "
            "the old file did not distinguish them. Split into 'Edit' and 'VFX' per project "
            "where JJ confirms. anecdote is the 40-60 word making-of, still to write."
        ),
        "sections": {
            k: {"title": v.get("title"), "lede": v.get("lede")}
            for k, v in data.items()
        },
        "projects": list(projects.values()),
    }

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    total_rows = sum(len(data[b].get("reels", [])) for b in order_source if b in data)
    multi = {v: b for v, b in dupes.items() if len(b) > 1}
    print(f"rows in  : {total_rows}")
    print(f"projects : {len(projects)}")
    print(f"collapsed: {total_rows - len(projects)}")
    print()
    print("multi-credit projects (what the ticker exists for):")
    for vid, buckets in multi.items():
        p = projects[vid]
        print(f"  {p['title']}")
        print(f"      buckets {buckets} -> roles {p['roles']}")
    print()
    counts = collections.Counter()
    for p in projects.values():
        counts[len(p["roles"])] += 1
    print("role counts:", dict(sorted(counts.items())))
    print("personal   :", sum(1 for p in projects.values() if p["category"] == "personal"))
    print(f"\nwrote {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
