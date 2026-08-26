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


def _validate_content_langs(content: dict, cfg: PipelineConfig, enforce_word_bounds: bool = True) -> list[str]:
    """Per-language shape/word-count checks — shared by validate_card
    (one chunk -> one card) and validate_multi_card (one digest/narrative
    array element -> one card). Everything except the verse-similarity
    check, which only makes sense for a chunk-based verse translation
    that has a source chunk.text to compare against.
    """
    reasons: list[str] = []
    for lang in LANGS:
        lang_content = content.get(lang)
        if not lang_content:
            reasons.append(f"missing content for language '{lang}'")
            continue
        if enforce_word_bounds:
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
    return reasons


def validate_card(chunk: Chunk, card: StructuredCard, cfg: PipelineConfig) -> ValidationResult:
    # word_bounds exists to keep *compressed* concept cards within a
    # target reading length. Verbatim mode's entire point is preserving
    # the source paragraph's own length — enforcing the same 60-140-word
    # (etc.) window here would force a short paragraph to be padded and a
    # long one to be cut, which is exactly the compression this mode
    # exists to avoid. So word bounds are skipped for verbatim; every
    # other per-language check (non-empty title/body/takeaway, all 3
    # languages present) still applies.
    reasons = _validate_content_langs(card.content, cfg, enforce_word_bounds=(chunk.mode != "verbatim"))

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


def validate_multi_card(cards: list[StructuredCard], cfg: PipelineConfig) -> list[ValidationResult]:
    """Validates a digest/narrative array — one ValidationResult per input
    card, same order. Reuses validate_card's per-language checks (word
    bounds included — unlike verbatim, digest/narrative cards are still
    meant to be card-sized, not full-length reproductions) minus the
    verse-similarity branch, which has no equivalent here: there's no
    single source chunk per output card to compare against, since all the
    cards in the array came from one LLM call over the whole page range.
    """
    results: list[ValidationResult] = []
    for card in cards:
        reasons = _validate_content_langs(card.content, cfg)
        results.append(ValidationResult(passed=(len(reasons) == 0), reasons=reasons))
    return results
