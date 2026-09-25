#!/usr/bin/env python3
"""
Batch-transcribes the scanned board papers that carry no usable text layer.

Wraps tools/local_ocr.py (vendored from the AI Class Room project): PyMuPDF for
pages with embedded text, Tesseract for scanned pages. Fully local and free.

Results are cached per paper, so a re-run resumes rather than redoing work.
Tesseract mangles mathematical and chemical notation, so every page produced
here is marked extraction_method=OCR and must pass human review before any of
it reaches a student. Nothing in this file answers or completes a question.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SURVEY = ROOT / "research/boards/batches/pyq-survey.json"
OUT_DIR = ROOT / "research/boards/ocr"
LOCAL_OCR = ROOT / "tools/local_ocr.py"


def cache_name(row: dict) -> str:
    stem = re.sub(r"\.pdf$", "", row["file"], flags=re.I)
    return f'{row["dir"].replace("/", "__").replace(chr(92), "__")}__{stem}.json'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="stop after N papers (0 = all)")
    ap.add_argument("--filter", default="", help="case-insensitive regex over board/class/year/subject/file")
    ap.add_argument("--lang", default="eng")
    args = ap.parse_args()

    rows = json.loads(SURVEY.read_text(encoding="utf-8"))
    targets = [r for r in rows if not r["text_ok"]]
    if args.filter:
        pat = re.compile(args.filter, re.I)
        targets = [r for r in targets
                   if pat.search(f'{r["board"]} {r["class"]} {r["year"]} {r["subject"]} {r["file"]}')]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    done = skipped = failed = 0

    for row in targets:
        if args.limit and done >= args.limit:
            break
        out_path = OUT_DIR / cache_name(row)
        if out_path.exists():
            skipped += 1
            continue

        pdf_path = ROOT / row["dir"] / row["file"]
        tmp_path = out_path.with_suffix(".partial.json")
        try:
            subprocess.run(
                [sys.executable, str(LOCAL_OCR), "--pdf", str(pdf_path),
                 "--out", str(tmp_path), "--lang", args.lang],
                check=True, capture_output=True, timeout=900,
            )
            pages = json.loads(tmp_path.read_text(encoding="utf-8"))["pages"]
            confs = [p["confidence"] for p in pages if p.get("confidence") is not None]
            payload = {
                "board": row["board"], "class": row["class"], "year": row["year"],
                "subject": row["subject"],
                "source_pdf": f'{row["dir"]}/{row["file"]}'.replace("\\", "/"),
                "extraction_method": "OCR",
                "extraction_engine": "pymupdf+tesseract",
                "mean_confidence": round(sum(confs) / len(confs), 4) if confs else None,
                "low_confidence_pages": [p["page_number"] for p in pages
                                         if p.get("confidence") is not None and p["confidence"] < 0.7],
                "needs_human_review": True,
                "pages": pages,
            }
            out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp_path.unlink(missing_ok=True)
            done += 1
            chars = sum(len(p["text"]) for p in pages)
            print(f'OK   {chars:7d}c  conf={payload["mean_confidence"]}  {row["board"]} {row["year"]} {row["file"]}', flush=True)
        except subprocess.TimeoutExpired:
            failed += 1
            print(f'FAIL timeout  {row["file"]}', flush=True)
        except Exception as exc:  # noqa: BLE001 - a bad paper must not stop the batch
            failed += 1
            print(f'FAIL {row["file"]} -- {exc}', flush=True)
        finally:
            tmp_path.unlink(missing_ok=True)

    print(f"\ntranscribed {done}, cached-skip {skipped}, failed {failed}, total targets {len(targets)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
