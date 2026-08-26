"""
Step 1: Extraction.

Pulls raw text from a PDF page-by-page using PyMuPDF, preserving page
numbers so downstream chunks carry an accurate source_page_number.

The earlier prototype scripts `pip install`ed PyMuPDF but never called it —
both operated on a hardcoded sample string. This module is what makes the
pipeline actually a pipeline rather than a manual paste tool.
"""
from __future__ import annotations

from dataclasses import dataclass

import fitz  # PyMuPDF


@dataclass
class PageText:
    page_number: int  # 1-indexed, matches how a human would cite the page
    text: str


def _page_block_text(page: fitz.Page) -> str:
    """Text of one page, reconstructed from PyMuPDF's block-level layout
    analysis rather than plain "text" mode. Plain-text extraction
    concatenates lines using whatever line breaks the PDF happens to
    encode internally, which does NOT reliably produce a blank line
    between paragraphs — some PDFs rely on font spacing rather than an
    actual blank-line character. chunk.py splits on blank lines to find
    paragraph/verse boundaries, so we reconstruct that boundary explicitly
    here (each detected block becomes one blank-line-separated unit),
    rather than trusting the source PDF's line-break formatting.
    """
    blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
    blocks = sorted(blocks, key=lambda b: (round(b[1], 1), round(b[0], 1)))
    block_texts = [b[4].strip() for b in blocks if b[4] and b[4].strip()]
    return "\n\n".join(block_texts)


def extract_pages(pdf_path: str) -> list[PageText]:
    """Extracts text per page — see _page_block_text for why block-level
    mode is used instead of plain "text" mode."""
    doc = fitz.open(pdf_path)
    pages: list[PageText] = []
    try:
        for i, page in enumerate(doc):
            text = _page_block_text(page)
            if text:
                pages.append(PageText(page_number=i + 1, text=text))
    finally:
        doc.close()
    return pages


def extract_page_range(pdf_path: str, start: int, end: int) -> str:
    """
    Extracts a contiguous page range as ONE joined string — for the digest/
    narrative modes, which structure a whole book/chapter/story in a
    single LLM call rather than per-chunk, so there's no need to keep
    page boundaries as separate PageText records the way extract_pages
    does for the chunked modes.

    start/end are 1-indexed and inclusive (matching PageText.page_number
    and how a human would cite a page range, e.g. --pages 12-30).
    """
    if start < 1 or end < start:
        raise ValueError(f"Invalid page range: start={start}, end={end}")
    doc = fitz.open(pdf_path)
    try:
        page_texts = [
            _page_block_text(doc[i])
            for i in range(start - 1, min(end, doc.page_count))
        ]
    finally:
        doc.close()
    return "\n\n".join(t for t in page_texts if t)
