"""
Step 2: Chunking.

Two distinct, non-interchangeable modes:

- "concept" chunks are meant to be freely summarized by the LLM (Mode A) —
  chapter prose, background, commentary.
- "verse" chunks contain sacred/scriptural text and must be preserved
  UNTOUCHED through to the LLM prompt (Mode B) — only literal translation is
  allowed, never paraphrase or "punchy" rewriting.

Conflating these two was the core problem with the earlier prototype
scripts: a single LLM call was told to both "translate the core meaning"
and write a "catchy title" for text that included verse content.

A verse block is trimmed to its immediate paragraph (up to the next blank
line), not extended all the way to the next verse marker — otherwise any
commentary sitting between two verses gets glued onto the first verse chunk
and handed to the literal-translation prompt, which is exactly the
conflation this module exists to prevent. An earlier version of this file
routed a whole page to one mode or the other and had precisely that bug;
--mode auto now interleaves verse and concept chunks within a page.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from extract import PageText

ChunkMode = str  # "concept" | "verse"

PARAGRAPH_BREAK = re.compile(r"\n\s*\n")


@dataclass
class Chunk:
    text: str
    page_number: int
    mode: ChunkMode
    citation_label: str  # e.g. "Sutra 1.2" or "p. 14"


def _verse_block_end(text: str, start: int) -> int:
    """End index of the verse block starting at `start`: up to the next
    blank-line paragraph break, or end of string. Keeps trailing commentary
    out of the verse chunk."""
    remainder = text[start:]
    para_break = PARAGRAPH_BREAK.search(remainder)
    return start + (para_break.start() if para_break else len(remainder))


def _paragraphs_to_concept_chunks(text: str, page_number: int, min_chunk_chars: int) -> list[Chunk]:
    chunks: list[Chunk] = []
    for para in PARAGRAPH_BREAK.split(text):
        para = para.strip()
        if len(para) >= min_chunk_chars:
            chunks.append(
                Chunk(text=para, page_number=page_number, mode="concept", citation_label=f"p. {page_number}")
            )
    return chunks


def chunk_concept(pages: list[PageText], min_chunk_chars: int) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page in pages:
        chunks += _paragraphs_to_concept_chunks(page.text, page.page_number, min_chunk_chars)
    return chunks


def chunk_verbatim(pages: list[PageText], min_chunk_chars: int) -> list[Chunk]:
    """
    Type 3 (verbatim): reuses chunk_concept's exact paragraph-splitting —
    same paragraph boundaries, same min_chunk_chars floor for discarding
    scraps — but tags each chunk mode="verbatim" instead of "concept" so
    downstream (structure.py, validate.py) routes it through the literal-
    preservation prompt/rules instead of the compress-and-modernize ones.
    Deliberately not a separate chunker — the boundary logic is identical,
    only what happens to the text afterward differs.
    """
    chunks = chunk_concept(pages, min_chunk_chars)
    for c in chunks:
        c.mode = "verbatim"
    return chunks


def chunk_verse(pages: list[PageText], verse_regex: str) -> list[Chunk]:
    """
    Extracts ONLY the verse/sutra lines matched by verse_regex — from each
    marker up to the end of its immediate paragraph. Surrounding commentary
    is deliberately excluded here; use --mode auto to also capture it as
    separate concept chunks.

    Known limitation at this prototype scale: a verse block that runs past
    a page boundary gets cut at the boundary, since extraction is per-page.
    Fine for 15 books; revisit if a specific book's verses commonly straddle
    pages.
    """
    pattern = re.compile(verse_regex)
    chunks: list[Chunk] = []
    for page in pages:
        for match in pattern.finditer(page.text):
            end = _verse_block_end(page.text, match.start())
            verse_text = page.text[match.start():end].strip()
            if verse_text:
                chunks.append(
                    Chunk(text=verse_text, page_number=page.page_number, mode="verse", citation_label=match.group(0))
                )
    _warn_if_no_verse_matches(chunks, verse_regex, context="--mode verse")
    return chunks


def _warn_if_no_verse_matches(chunks: list[Chunk], verse_regex: str, context: str) -> None:
    """
    A book that produces zero verse chunks silently means the literal-
    translation-only safety path (temperature=0, no paraphrase, verse-
    fidelity similarity check in validate.py) never engages for ANY content
    in that book — everything routes through the concept/summarization
    prompt instead. That's the correct outcome for a book with no
    scripture in it, but it's indistinguishable from a misconfigured
    --verse-regex for THIS book unless something says so out loud. This was
    found happening silently in production: a book with no "Sutra X.Y"
    markers ran entirely through concept mode with no warning anywhere.
    """
    if not any(c.mode == "verse" for c in chunks):
        print(
            f"\n⚠️  WARNING: verse_regex {verse_regex!r} matched ZERO times ({context}). "
            f"Every chunk in this book will be treated as concept/prose — the literal-"
            f"translation-only verse safety path will NOT engage anywhere in this run. "
            f"If this book contains scripture or verses that must be preserved verbatim, "
            f"set --verse-regex to match this book's actual markers before continuing. "
            f"If this book genuinely has no verse content, this warning is expected "
            f"and safe to ignore.\n"
        )


def chunk_auto(pages: list[PageText], verse_regex: str, min_chunk_chars: int) -> list[Chunk]:
    """
    Per page: extracts verse blocks wherever the marker appears (trimmed to
    their immediate paragraph), and treats everything else on that page —
    including commentary sitting right next to a verse — as concept prose.
    A page with no verse marker at all is chunked entirely as concept.
    """
    pattern = re.compile(verse_regex)
    chunks: list[Chunk] = []
    for page in pages:
        matches = list(pattern.finditer(page.text))
        if not matches:
            chunks += _paragraphs_to_concept_chunks(page.text, page.page_number, min_chunk_chars)
            continue

        cursor = 0
        for match in matches:
            preceding = page.text[cursor:match.start()]
            chunks += _paragraphs_to_concept_chunks(preceding, page.page_number, min_chunk_chars)

            end = _verse_block_end(page.text, match.start())
            verse_text = page.text[match.start():end].strip()
            if verse_text:
                chunks.append(
                    Chunk(text=verse_text, page_number=page.page_number, mode="verse", citation_label=match.group(0))
                )
            cursor = end

        trailing = page.text[cursor:]
        chunks += _paragraphs_to_concept_chunks(trailing, page.page_number, min_chunk_chars)

    _warn_if_no_verse_matches(chunks, verse_regex, context="--mode auto")
    return chunks


def chunk_pages(
    pages: list[PageText], mode: str, verse_regex: str, min_chunk_chars: int
) -> list[Chunk]:
    if mode == "concept":
        return chunk_concept(pages, min_chunk_chars)
    if mode == "verse":
        return chunk_verse(pages, verse_regex)
    if mode == "auto":
        return chunk_auto(pages, verse_regex, min_chunk_chars)
    if mode == "verbatim":
        return chunk_verbatim(pages, min_chunk_chars)
    raise ValueError(f"Unknown chunk mode: {mode}")