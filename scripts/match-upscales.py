"""Match upscaled photo candidates to the client's numbered originals by content.

    python3 scripts/match-upscales.py

Reads   ~/Downloads/FRESCA PHOTOS/<n>.png         (originals, read-only)
        reference/upscaled-raw/*                  (copies of the upscale candidates)
Writes  reference/upscale-matches.json            (full results; read by
                                                  scripts/copy-upscales.mjs)

Scoring, per candidate x original pair: center-crop both to the narrower of the
two aspect ratios, resize to 64x64, then combine the normalized correlation of
the grayscale pixels (70%) with RGB histogram intersection (30%).

The upscaler often re-frames a photo (zooms out, extends the scene, changes the
aspect ratio), which a fixed center crop misses. So each pair is also searched:
one image is shrunk to 60-100% of the largest box it fits in the other, slid
across it, and the best zero-mean normalized correlation is kept (both
directions). The pair's correlation term is the better of the two methods.

Modification time is used only to break near-ties: the pick that keeps the
numbers in download order between confident neighbours wins.
"""

import json
import os
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ORIG_DIR = Path.home() / "Downloads" / "FRESCA PHOTOS"
RAW_DIR = ROOT / "reference" / "upscaled-raw"
OUT_JSON = ROOT / "reference" / "upscale-matches.json"

# Originals the site uses (content/site.ts IMAGE MAP), and the drawing/board
# images that are intentionally not upscaled.
SITE = {1, 2, 3, 4, 5, 6, 7, 9, 21, 23, 24, 25, 26, 29, 31, 32, 34, 37, 38, 39, 40, 41, 42, 43, 44}
BOARDS = {21, 23, 24, 25}
WATCH = 10  # suspected mismatch: always report its top 3 candidates

# Several originals show the same room from different angles (1/2, 12/15,
# 27/30 ...), so pixel scores can't always separate them. These verdicts come
# from looking at each low-confidence candidate next to its top originals
# (download order agrees with every one). They override the automatic pick and
# are labelled as such in the output.
VISUAL_CHECK = {
    "Gemini_Generated_Image_pnq6phpnq6phpnq6.jpeg": (1, "wider re-framing of the hero kitchen (1), not the island view (2)"),
    "Gemini_Generated_Image_phnhwuphnhwuphnh.jpeg": (13, "cooktop under the window with the red pergola outside"),
    "Gemini_Generated_Image_pj4s9spj4s9spj4s.jpeg": (15, "walnut island under the lantern, window view (15), not the fridge wall (12)"),
    "Gemini_Generated_Image_kxeabykxeabykxea.jpeg": (37, "blush bedroom, re-centered and widened"),
    "Gemini_Generated_Image_ve5y8mve5y8mve5y.jpeg": (38, "reclaimed-wood bedroom, widened"),
    "chatgpt12312415125.png": (9, "gloss kitchen; warmer color is why the score is low"),
    "Gemini_Generated_Image_bdu49fbdu49fbdu4.jpeg": (32, "hammered-sink bath"),
}

W_CORR, W_HIST = 0.7, 0.3
LOW_SCORE = 0.60  # below this a match is low confidence
SMALL_MARGIN = 0.05  # best minus runner-up below this is low confidence
TIE_MARGIN = 0.02  # below this, modification time may break the tie
AR_TOLERANCE = 0.03


def load_rgb(path: Path, trim_transparent: bool) -> Image.Image:
    im = Image.open(path)
    im.load()
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        if trim_transparent:
            box = im.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
            if box:
                im = im.crop(box)
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im.convert("RGB")


def working_copy(im: Image.Image, long_edge: int = 512) -> Image.Image:
    """Downscale once so per-pair crops stay fast."""
    im = im.copy()
    im.thumbnail((long_edge, long_edge), Image.LANCZOS)
    return im


def center_crop(im: Image.Image, ar: float) -> Image.Image:
    w, h = im.size
    if w / h > ar:  # too wide
        nw = round(h * ar)
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = round(w / ar)
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def features(im: Image.Image):
    small = im.resize((64, 64), Image.LANCZOS)
    arr = np.asarray(small, dtype=np.float64)
    gray = arr @ np.array([0.299, 0.587, 0.114])
    g = gray - gray.mean()
    g /= np.linalg.norm(g) + 1e-9
    q = (arr // 32).astype(int)  # 8 bins per channel
    hist = np.bincount((q[..., 0] * 64 + q[..., 1] * 8 + q[..., 2]).ravel(), minlength=512).astype(np.float64)
    hist /= hist.sum()
    return g, hist


SEARCH_H = 72  # height of the image being searched, in px
SCALES = (1.0, 0.9, 0.8, 0.7, 0.6)
MIN_COVER = 0.5  # a placed image must cover half the other, or thin strips match anything


def gray_arr(im: Image.Image, size) -> np.ndarray:
    return np.asarray(im.convert("L").resize(size, Image.LANCZOS), dtype=np.float64)


def search(template: Image.Image, field: Image.Image) -> float:
    """Best normalized correlation of `template` placed anywhere inside `field`."""
    fw = max(8, round(SEARCH_H * field.width / field.height))
    F = gray_arr(field, (fw, SEARCH_H))
    t_ar = template.width / template.height
    fit_w, fit_h = (fw, fw / t_ar) if fw / SEARCH_H < t_ar else (SEARCH_H * t_ar, SEARCH_H)
    best = -1.0
    for s in SCALES:
        tw, th = max(8, round(fit_w * s)), max(8, round(fit_h * s))
        if tw > fw or th > SEARCH_H or tw * th < MIN_COVER * fw * SEARCH_H:
            continue
        T = gray_arr(template, (tw, th))
        T = T - T.mean()
        T /= np.linalg.norm(T) + 1e-9
        win = np.lib.stride_tricks.sliding_window_view(F, (th, tw))
        mu = win.mean(axis=(2, 3), keepdims=True)
        num = np.einsum("ijkl,kl->ij", win, T)  # T is zero-mean, so the window mean drops out
        den = np.sqrt(((win - mu) ** 2).sum(axis=(2, 3))) + 1e-9
        best = max(best, float((num / den).max()))
    return best


def score(orig: Image.Image, cand: Image.Image) -> float:
    ar = min(orig.width / orig.height, cand.width / cand.height)
    go, ho = features(center_crop(orig, ar))
    gc, hc = features(center_crop(cand, ar))
    corr = max(float((go * gc).sum()), search(orig, cand), search(cand, orig))
    hist = float(np.minimum(ho, hc).sum())
    return W_CORR * corr + W_HIST * hist


def main():
    originals = {}
    for p in sorted(ORIG_DIR.glob("*.png"), key=lambda p: int(p.stem) if p.stem.isdigit() else 999):
        if not p.stem.isdigit():
            continue
        n = int(p.stem)
        full = load_rgb(p, trim_transparent=True)
        originals[n] = {"path": p, "size": full.size, "work": working_copy(full)}

    cands = []
    for p in sorted(RAW_DIR.iterdir()):
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        full = load_rgb(p, trim_transparent=False)
        cands.append({"name": p.name, "path": p, "size": full.size, "mtime": p.stat().st_mtime, "work": working_copy(full)})

    # Score every pair.
    for c in cands:
        c["scores"] = sorted(((score(o["work"], c["work"]), n) for n, o in originals.items()), reverse=True)

    # Tie-break near-ties using download order: prefer the option that sits
    # between the confident neighbours' numbers (or is closest to them).
    by_time = sorted(cands, key=lambda c: c["mtime"])
    for c in cands:
        (s1, n1), (s2, n2) = c["scores"][0], c["scores"][1]
        c["best"], c["runner"], c["margin"], c["tiebreak"], c["visual"] = n1, n2, s1 - s2, None, None
    confident = [c for c in by_time if c["margin"] >= SMALL_MARGIN and c["scores"][0][0] >= LOW_SCORE]
    for c in by_time:
        if c["margin"] >= TIE_MARGIN:
            continue
        before = [x["best"] for x in confident if x["mtime"] < c["mtime"]][-1:]
        after = [x["best"] for x in confident if x["mtime"] > c["mtime"]][:1]
        anchors = before + after
        if not anchors:
            continue
        lo = before[0] if before else -1
        hi = after[0] if after else 10**6
        in_order = [n for n in (c["best"], c["runner"]) if lo < n < hi]
        dist = lambda n: min(abs(n - a) for a in anchors)  # noqa: E731
        pick = in_order[0] if len(in_order) == 1 else min((c["best"], c["runner"]), key=dist)
        if pick != c["best"]:
            c["tiebreak"] = f"mtime: {c['best']} -> {pick} (neighbours {anchors})"
            c["runner"], c["best"] = c["best"], pick

    # Visual verdicts override the automatic pick.
    for c in cands:
        if c["name"] in VISUAL_CHECK:
            n, note = VISUAL_CHECK[c["name"]]
            auto = c["best"]
            c["best"] = n
            c["runner"] = auto if auto != n else c["runner"]
            c["visual"] = f"visual check: {note}" + (f" (script picked {auto})" if auto != n else "")

    # Flags per candidate.
    for c in cands:
        o = originals[c["best"]]
        ar_o = o["size"][0] / o["size"][1]
        ar_c = c["size"][0] / c["size"][1]
        c["ar_orig"], c["ar_cand"] = ar_o, ar_c
        c["ar_diff"] = abs(ar_c - ar_o) / ar_o
        c["best_score"] = dict((n, s) for s, n in c["scores"])[c["best"]]
        flags = []
        if c["best_score"] < LOW_SCORE:
            flags.append("low score")
        if c["margin"] < SMALL_MARGIN:
            flags.append("small margin")
        if c["ar_diff"] > AR_TOLERANCE:
            flags.append(f"aspect differs {c['ar_diff'] * 100:.1f}%: re-framed, scene extended beyond the original")
        if c["best"] in BOARDS:
            flags.append("matches a drawing/board (not to be upscaled)")
        if c["best"] not in SITE:
            flags.append("original not used on the site")
        if c["tiebreak"]:
            flags.append(c["tiebreak"])
        if c["visual"]:
            flags.append(c["visual"])
        c["flags"] = flags

    groups = {}
    for c in cands:
        groups.setdefault(c["best"], []).append(c)
    for g in groups.values():
        g.sort(key=lambda c: -c["best_score"])

    # ───── console report
    fmt_t = lambda t: datetime.fromtimestamp(t).strftime("%H:%M:%S")  # noqa: E731
    print(f"{'candidate':46} {'best':>4} {'score':>6} {'2nd':>4} {'margin':>6} {'AR orig':>7} {'AR cand':>7} {'time':>8}  flags")
    for c in by_time:
        print(
            f"{c['name'][:46]:46} {c['best']:>4} {c['best_score']:6.3f} {c['runner']:>4} {c['margin']:6.3f} "
            f"{c['ar_orig']:7.3f} {c['ar_cand']:7.3f} {fmt_t(c['mtime']):>8}  {'; '.join(c['flags'])}"
        )
    print("\nOriginals with several candidates:")
    for n, g in sorted(groups.items()):
        if len(g) > 1:
            print(f"  {n:>2}: " + ", ".join(f"{c['name']} ({c['best_score']:.3f})" for c in g))
    missing = [n for n in sorted(originals) if n not in groups]
    print("\nOriginals with no candidate (keep original):", missing)
    print("  of which used on the site:", [n for n in missing if n in SITE])
    print(f"\nOriginal {WATCH}: top 3 candidates by score")
    top = sorted(((dict((n, s) for s, n in c["scores"])[WATCH], c) for c in cands), key=lambda t: -t[0])[:3]
    for s, c in top:
        print(f"  {c['name']}  score {s:.3f}  (this candidate's best match: {c['best']} at {c['best_score']:.3f})")

    # ───── JSON
    OUT_JSON.write_text(
        json.dumps(
            {
                "candidates": [
                    {k: c[k] for k in ("name", "best", "best_score", "runner", "margin", "ar_orig", "ar_cand", "flags")}
                    | {"size": c["size"], "mtime": fmt_t(c["mtime"]), "top3": [[n, round(s, 4)] for s, n in c["scores"][:3]]}
                    for c in by_time
                ],
                "watch": {"original": WATCH, "top3": [[c["name"], round(s, 4)] for s, c in top]},
            },
            indent=2,
        )
    )

    print(f"\nwrote {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
