"""
Step 4: Validation — runs AFTER the LLM call, BEFORE any Supabase write.

Nothing reaches the database without passing through here. Cards that fail
are written to flagged/ instead of being silently accepted — the earlier
prototype had no validation step at all.
"""
from __future__ import annotations

import difflib
from dataclasses import dataclass, field

from chunk import Chunk
from config import PipelineConfig
from structure import StructuredCard

LANGS = ("en", "hi", "gu")


@dataclass
class ValidationResult:
    passed: bool
    reasons: list[str] = field(default_factory=list)


def _word_count(text: str) -> int:
    # Whitespace-based count. Devanagari/Gujarati don't segment into words
    # via spaces the exact way English does, so this is a rough proxy — not
    # a linguistically precise measure — but enough to catch gross drift
    # (an empty body, a one-line body, a 400-word body) at prototype scale.
    return len(text.split())


def validate_card(chunk: Chunk, card: StructuredCard, cfg: PipelineConfig) -> ValidationResult:
    reasons: list[str] = []

    for lang in LANGS:
        lang_content = card.content.get(lang)
        if not lang_content:
            reasons.append(f"missing content for language '{lang}'")
            continue
        body = lang_content.get("body", "")
        wc = _word_count(body)
        bounds = cfg.word_bounds[lang]
        if not (bounds.min_words <= wc <= bounds.max_words):
            reasons.append(
                f"{lang}.body word count {wc} outside range "
                f"[{bounds.min_words}, {bounds.max_words}]"
            )
        if not lang_content.get("title"):
            reasons.append(f"{lang}.title is empty")
        if not lang_content.get("takeaway"):
            reasons.append(f"{lang}.takeaway is empty")

    if chunk.mode == "verse":
        if not card.original_verse or not card.original_verse.get("text"):
            reasons.append("verse chunk but original_verse.text missing from LLM response")
        else:
            similarity = difflib.SequenceMatcher(
                None, chunk.text, card.original_verse["text"]
            ).ratio()
            if similarity < cfg.verse_similarity_threshold:
                reasons.append(
                    f"original_verse.text diverges from source chunk "
                    f"(similarity {similarity:.2f} < {cfg.verse_similarity_threshold}) "
                    f"— model may have rewritten scripture instead of preserving it"
                )

    return ValidationResult(passed=(len(reasons) == 0), reasons=reasons)
