#!/usr/bin/env python3
"""
Local, offline PDF text extraction for AI Classroom chapter preparation.

Replaces the Gemini-vision OCR pipeline (lib/chapter-extraction.ts, now
gated off by default via lib/gemini-gate.ts) with fully local, free tools:

  - PyMuPDF (fitz) reads pages that already contain selectable/embedded text
    directly and exactly - the fast path most digital textbook PDFs take.
  - Tesseract OCR (via pytesseract), rendering the page to an image first,
    picks up pages with little or no embedded text - scanned pages, photos
    of a printed page, or a page that is mostly a diagram.

No network calls, no API key, no cost. Confidence is reported per page the
same way the Gemini path did (0..1), so downstream review works unchanged:
  - 1.0 for a PDF_TEXT page (exact, not OCR'd)
  - Tesseract's own mean word confidence for an OCR'd page

Typical use - extract to a JSON/text file for review, then hand-author the
lesson (the same way every chapter in lib/curated-ready-lessons.ts was
built this session):

    python tools/local_ocr.py --pdf chapter.pdf --out chapter.json

Multi-language OCR (Tesseract ships eng/hin/ben already installed):

    python tools/local_ocr.py --pdf chapter.pdf --out chapter.json --lang eng+hin

Optional - push straight into this app's database for a document already
uploaded via the admin curriculum UI (mirrors ChapterExtractor.storePages):

    python tools/local_ocr.py --pdf chapter.pdf --document-id <uuid> --upload

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment for
--upload. Everything else needs no credentials at all.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("Missing dependency: pip install pymupdf")

try:
    import pytesseract
    from PIL import Image
except ImportError:
    sys.exit("Missing dependency: pip install pytesseract pillow")


# Common install locations checked in order before falling back to PATH, so
# this works out of the box on a fresh Windows machine that installed
# Tesseract via winget/the UB-Mannheim installer without editing PATH.
DEFAULT_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
]

# Below this many characters of embedded text, a page is treated as
# scanned/image-only rather than trusting a near-empty native extraction.
# Deliberately well above a running header/footer stamp's length (e.g. a
# "Biology - Chapter 1 - 4" page stamp is ~23 chars) - real body-text
# paragraphs run into the hundreds of characters, so this only trusts native
# text once there is clearly a paragraph's worth of it.
MIN_NATIVE_TEXT_CHARS = 120


def configure_tesseract(explicit_path: str | None) -> None:
    if explicit_path:
        pytesseract.pytesseract.tesseract_cmd = explicit_path
        return
    for candidate in DEFAULT_TESSERACT_PATHS:
        if Path(candidate).exists():
            pytesseract.pytesseract.tesseract_cmd = candidate
            return
    # Otherwise trust PATH - pytesseract will raise a clear error if it is
    # not actually on it.


def extract_page(doc: "fitz.Document", page_index: int, lang: str, dpi: int) -> dict:
    page = doc[page_index]
    native_text = page.get_text("text").strip()

    if len(native_text) >= MIN_NATIVE_TEXT_CHARS:
        return {
            "page_number": page_index + 1,
            "text": native_text,
            "confidence": 1.0,
            "method": "PDF_TEXT",
        }

    # Scanned/image page: render at the requested DPI and OCR it. 300 DPI is
    # Tesseract's own recommended sweet spot for printed textbook text.
    zoom = dpi / 72
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    text = pytesseract.image_to_string(image, lang=lang).strip()

    # image_to_data gives per-word confidences; image_to_string (used above
    # for readable line structure) does not, so a second lightweight pass
    # computes the mean confidence to report alongside the text.
    ocr_data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
    confidences = [
        int(c)
        for c, w in zip(ocr_data["conf"], ocr_data["text"])
        if w.strip() and str(c).lstrip("-").isdigit() and int(c) >= 0
    ]
    mean_conf = (sum(confidences) / len(confidences) / 100) if confidences else 0.0

    return {
        "page_number": page_index + 1,
        "text": text,
        "confidence": round(mean_conf, 3),
        "method": "OCR",
    }


def extract_pdf(pdf_path: Path, lang: str, dpi: int) -> list[dict]:
    doc = fitz.open(pdf_path)
    pages = []
    try:
        for i in range(len(doc)):
            result = extract_page(doc, i, lang, dpi)
            pages.append(result)
            print(
                f"  page {result['page_number']:>3}: {result['method']:<9} "
                f"confidence={result['confidence']:.2f}  {len(result['text'])} chars",
                file=sys.stderr,
            )
    finally:
        doc.close()
    return pages


def write_output(pages: list[dict], out_path: Path, fmt: str) -> None:
    if fmt == "json":
        out_path.write_text(
            json.dumps({"pages": pages}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    else:
        chunks = [
            f"=== Page {p['page_number']} ({p['method']}, confidence {p['confidence']:.2f}) ===\n{p['text']}"
            for p in pages
        ]
        out_path.write_text("\n\n".join(chunks), encoding="utf-8")


def _supabase_request(method: str, url: str, service_key: str, payload: dict | list, extra_headers: dict | None = None):
    headers = {
        "content-type": "application/json",
        "apikey": service_key,
        "authorization": f"Bearer {service_key}",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def upload_to_supabase(document_id: str, pages: list[dict]) -> None:
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment to use --upload.")

    rows = [
        {
            "source_document_id": document_id,
            "page_number": p["page_number"],
            "source_text": p["text"],
            "ocr_confidence": p["confidence"],
            "extraction_method": p["method"],
            "review_status": "REVIEW_REQUIRED",
        }
        for p in pages
    ]

    status, body = _supabase_request(
        "POST",
        f"{supabase_url}/rest/v1/curriculum_source_pages",
        service_key,
        rows,
        extra_headers={"prefer": "resolution=merge-duplicates"},
    )
    if status not in (200, 201):
        sys.exit(f"Supabase page upsert failed: HTTP {status} - {body.decode('utf-8', 'replace')}")

    status, body = _supabase_request(
        "PATCH",
        f"{supabase_url}/rest/v1/curriculum_source_documents?id=eq.{document_id}",
        service_key,
        {"processing_status": "EXTRACTED", "page_count": len(pages), "processing_error": None},
    )
    if status not in (200, 204):
        sys.exit(f"Supabase document update failed: HTTP {status} - {body.decode('utf-8', 'replace')}")

    print(f"Uploaded {len(pages)} pages to Supabase for document {document_id}.", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Local, offline PDF OCR for AI Classroom chapter prep.")
    parser.add_argument("--pdf", required=True, type=Path, help="Path to the source PDF")
    parser.add_argument("--out", type=Path, help="Output file (json or text)")
    parser.add_argument("--format", choices=["json", "text"], default="json")
    parser.add_argument("--lang", default="eng", help="Tesseract language code(s), e.g. eng, eng+hin, eng+ben")
    parser.add_argument("--dpi", type=int, default=300, help="Rendering DPI for OCR-fallback pages")
    parser.add_argument("--tesseract-path", help="Explicit path to tesseract.exe if not auto-detected")
    parser.add_argument("--document-id", help="Existing curriculum_source_documents id to push results into")
    parser.add_argument("--upload", action="store_true", help="Upload results to Supabase (requires --document-id)")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.exit(f"PDF not found: {args.pdf}")
    if args.upload and not args.document_id:
        sys.exit("--upload requires --document-id")

    configure_tesseract(args.tesseract_path)

    print(f"Extracting {args.pdf} ...", file=sys.stderr)
    pages = extract_pdf(args.pdf, args.lang, args.dpi)

    low_confidence = [p["page_number"] for p in pages if p["confidence"] < 0.7]
    total_chars = sum(len(p["text"]) for p in pages)
    print(f"\nDone: {len(pages)} pages, {total_chars} characters extracted.", file=sys.stderr)
    if low_confidence:
        print(f"Low-confidence pages (check these against the original scan): {low_confidence}", file=sys.stderr)

    if args.out:
        write_output(pages, args.out, args.format)
        print(f"Written to {args.out}", file=sys.stderr)

    if args.upload:
        upload_to_supabase(args.document_id, pages)


if __name__ == "__main__":
    main()
