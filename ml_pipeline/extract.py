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


def extract_pages(pdf_path: str) -> list[PageText]:
    """
    Extracts text per page using PyMuPDF's block-level mode rather than
    plain "text" mode. Plain-text extraction concatenates lines using
    whatever line breaks the PDF happens to encode internally, which does
    NOT reliably produce a blank line between paragraphs — some PDFs rely
    on font spacing rather than an actual blank-line character. chunk.py
    splits on blank lines to find paragraph/verse boundaries, so we
    reconstruct that boundary explicitly here from PyMuPDF's own layout
    analysis (each detected block becomes one blank-line-separated unit),
    rather than trusting the source PDF's line-break formatting.
    """
    doc = fitz.open(pdf_path)
    pages: list[PageText] = []
    try:
        for i, page in enumerate(doc):
            blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
            blocks = sorted(blocks, key=lambda b: (round(b[1], 1), round(b[0], 1)))
            block_texts = [b[4].strip() for b in blocks if b[4] and b[4].strip()]
            text = "\n\n".join(block_texts)
            if text:
                pages.append(PageText(page_number=i + 1, text=text))
    finally:
        doc.close()
    return pages
