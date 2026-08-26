"""
Step 3: LLM structuring.

Two separate system prompts — never one prompt trying to do both jobs:

- VERSE_SYSTEM_PROMPT: literal translation only. No paraphrasing, no
  "catchy" titles, no summarizing away detail.
- CONCEPT_SYSTEM_PROMPT: the modern-takeaway style is fine here, but
  word-count bounds are a hard instruction, and validate.py enforces them
  after the fact regardless of what the model actually returns.

Default provider is Gemini Flash (free tier), per the zero-cost prototype
plan — swap the model name in config.yaml if you move to a paid model.
"""
from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from google import genai
from google.genai import errors, types

from chunk import Chunk
from config import PipelineConfig

BUDGET_STATE_PATH = Path(__file__).parent / ".llm_call_budget.json"
_BUDGET_LOCK = threading.Lock()  # protects the local budget file across worker threads

REQUIRED_LANGS = ("en", "hi", "gu")

# google-genai raises ClientError for ALL 4xx codes — 429 (rate limit,
# worth a retry) and 404 (model not found, will NEVER succeed on retry) are
# the SAME exception class. So we branch on the numeric .code, not on
# exception type. Verified against the installed SDK's raise_for_response:
# 400 <= code < 500 -> ClientError, 500 <= code < 600 -> ServerError.
NON_RETRYABLE_STATUS_CODES = {400, 401, 403, 404, 422}

VERSE_SYSTEM_PROMPT = """You are a literal translator of Jain scripture (Sanskrit/Prakrit).
You will be given one verse/sutra, exactly as extracted from the source text.

Rules — do not break these:
- Do NOT paraphrase, embellish, modernize, or write a "catchy" title.
- Do NOT summarize away any part of the meaning.
- Translate as literally and precisely as the target language allows.
- Preserve the original script text exactly as given — do not correct or
  "clean up" spelling, spacing, or punctuation.

Output STRICT JSON only, no markdown fences, matching exactly:
{
  "original_verse": {"script": "devanagari", "text": "<verse exactly as given>"},
  "content": {
    "en": {"title": "<short literal title>", "body": "<literal translation>", "takeaway": "<one literal-meaning sentence>"},
    "hi": {"title": "...", "body": "...", "takeaway": "..."},
    "gu": {"title": "...", "body": "...", "takeaway": "..."}
  }
}
All three of en, hi, gu are required. Do not omit gu."""

CONCEPT_SYSTEM_PROMPT_TEMPLATE = """You are structuring a chunk of philosophical/commentary prose (not a verse)
into a short reading card for a mobile app, in three languages: English,
Hindi, and Gujarati.

Rules:
- Each language's "body" must stay within its word-count range:
  English {en_min}-{en_max} words, Hindi {hi_min}-{hi_max} words,
  Gujarati {gu_min}-{gu_max} words. Stay inside the range.
- "takeaway" is one short, practical sentence connecting the idea to modern
  life — grounded in the source text, not invented.
- Do not fabricate claims the source text doesn't support.

Output STRICT JSON only, no markdown fences, matching exactly:
{{
  "original_verse": null,
  "content": {{
    "en": {{"title": "...", "body": "...", "takeaway": "..."}},
    "hi": {{"title": "...", "body": "...", "takeaway": "..."}},
    "gu": {{"title": "...", "body": "...", "takeaway": "..."}}
  }}
}}
All three of en, hi, gu are required. Do not omit gu."""

# Type 3 (verbatim): same "preserve, don't paraphrase" philosophy as
# VERSE_SYSTEM_PROMPT, applied to general prose instead of marked verse —
# the whole point is reproducing the original book, not compressing it.
VERBATIM_SYSTEM_PROMPT = """You are a faithful, literal translator preparing one paragraph of an
original book for a mobile reading app, in three languages: English,
Hindi, and Gujarati.

Rules — do not break these:
- Do NOT summarize, compress, or condense this paragraph. Every idea and
  detail in the source paragraph must appear in your translation.
- Do NOT paraphrase, embellish, modernize, or write a "catchy" title.
- Do NOT rewrite the author's structure or argument — translate it as
  written, preserving order, length, and level of detail.
- "takeaway" is one short, literal sentence stating what this paragraph
  says — not an invented lesson, not modern-life advice.

Output STRICT JSON only, no markdown fences, matching exactly:
{
  "original_verse": null,
  "content": {
    "en": {"title": "<short literal title>", "body": "<faithful, complete translation — same length/detail as the source>", "takeaway": "<one literal sentence>"},
    "hi": {"title": "...", "body": "...", "takeaway": "..."},
    "gu": {"title": "...", "body": "...", "takeaway": "..."}
  }
}
All three of en, hi, gu are required. Do not omit gu."""

# Types 1 & 5 (digest / narrative) share this response shape — a JSON
# ARRAY of cards from one LLM call over a whole book/chapter/story, not
# one call per chunk. structure_multi_card() picks between these two by
# `style`.
DIGEST_SYSTEM_PROMPT = """You are compressing a book or chapter of philosophical/religious prose into
a SMALL set of reading cards for a mobile app, in three languages: English,
Hindi, and Gujarati.

You will be given the full text of a book or chapter. Distill it into
however many cards it takes to cover its essential ideas — normally
around 3 to 5, but use your judgment: a genuinely dense or multi-part
text can need slightly more, a short or single-idea one can need fewer.
Do not pad the count to hit a number.

Rules for each card:
- Capture one essential idea per card — the core arguments, claims, or
  teachings of the source, not incidental detail.
- "takeaway" is one short, practical sentence connecting the idea to
  modern life — grounded in the source text, not invented.
- Do not fabricate claims the source text doesn't support.
- The cards should read as a coherent sequence covering the material,
  without needless overlap between cards.

Output STRICT JSON array only, no markdown fences, matching exactly:
[
  {
    "original_verse": null,
    "content": {
      "en": {"title": "...", "body": "...", "takeaway": "..."},
      "hi": {"title": "...", "body": "...", "takeaway": "..."},
      "gu": {"title": "...", "body": "...", "takeaway": "..."}
    }
  }
]
All three of en, hi, gu are required on every card. Do not omit gu."""

NARRATIVE_SYSTEM_PROMPT = """You are breaking a story (a narrative chapter, parable, or life account) into
a sequence of reading cards for a mobile app, in three languages: English,
Hindi, and Gujarati.

You will be given the full text of a story. Break it into however many
cards it naturally needs to tell the story well — a short story might
need only 2-3 cards, a long one may need many more. Do not force it into
a fixed count.

Rules:
- Cards are read in order, one swipe at a time — preserve narrative
  continuity across cards. Do NOT re-introduce characters, places, or
  context a prior card already established; write each card as the next
  beat of one continuous story, not a self-contained summary.
- Keep tone, names, and terminology (character names, place names,
  epithets) consistent across every card in this array.
- "takeaway" is one short, practical sentence connecting that beat of the
  story to modern life — grounded in the source text, not invented.
- Do not fabricate events or dialogue the source text doesn't support.

Output STRICT JSON array only, no markdown fences, matching exactly:
[
  {
    "original_verse": null,
    "content": {
      "en": {"title": "...", "body": "...", "takeaway": "..."},
      "hi": {"title": "...", "body": "...", "takeaway": "..."},
      "gu": {"title": "...", "body": "...", "takeaway": "..."}
    }
  }
]
All three of en, hi, gu are required on every card. Do not omit gu."""


@dataclass
class StructuredCard:
    original_verse: dict | None
    content: dict


class BudgetExceeded(Exception):
    pass


def _load_budget_state() -> dict:
    if BUDGET_STATE_PATH.exists():
        return json.loads(BUDGET_STATE_PATH.read_text())
    return {"date": str(date.today()), "count": 0}


def _save_budget_state(state: dict) -> None:
    BUDGET_STATE_PATH.write_text(json.dumps(state))


def _check_and_increment_budget(daily_limit: int) -> int:
    # Locked because this file is read-modify-written; without the lock,
    # concurrent worker threads race on it and the daily cap silently stops
    # being enforced correctly — exactly what happened running this with a
    # ThreadPoolExecutor.
    with _BUDGET_LOCK:
        state = _load_budget_state()
        today = str(date.today())
        if state["date"] != today:
            state = {"date": today, "count": 0}
        if state["count"] >= daily_limit:
            raise BudgetExceeded(
                f"Daily LLM call budget of {daily_limit} reached. "
                f"Wait for reset or raise daily_call_budget in config.yaml."
            )
        state["count"] += 1
        _save_budget_state(state)
        return state["count"]


def _build_concept_prompt(cfg: PipelineConfig) -> str:
    return CONCEPT_SYSTEM_PROMPT_TEMPLATE.format(
        en_min=cfg.word_bounds["en"].min_words, en_max=cfg.word_bounds["en"].max_words,
        hi_min=cfg.word_bounds["hi"].min_words, hi_max=cfg.word_bounds["hi"].max_words,
        gu_min=cfg.word_bounds["gu"].min_words, gu_max=cfg.word_bounds["gu"].max_words,
    )


def _validate_llm_shape(data: dict) -> None:
    """Fail fast if the model didn't return the required shape — don't let a
    malformed response silently become a malformed card downstream."""
    if "content" not in data:
        raise ValueError("LLM response missing 'content' key")
    for lang in REQUIRED_LANGS:
        if lang not in data["content"]:
            raise ValueError(f"LLM response missing required language: {lang}")
        for field_name in ("title", "body", "takeaway"):
            if not data["content"][lang].get(field_name):
                raise ValueError(f"LLM response missing {lang}.{field_name}")


def _validate_multi_llm_shape(data: object) -> None:
    """Same idea as _validate_llm_shape, for the digest/narrative array
    response: must be a non-empty JSON array, and every element must pass
    the same single-card shape check."""
    if not isinstance(data, list) or not data:
        raise ValueError("LLM response for multi-card structuring must be a non-empty JSON array")
    for i, card in enumerate(data):
        try:
            _validate_llm_shape(card)
        except ValueError as e:
            raise ValueError(f"array element {i}: {e}") from e


def _generate_structured_json(
    model_name: str,
    system_prompt: str,
    temperature: float,
    contents: str,
    cfg: PipelineConfig,
    max_retries: int,
    validate_shape,
) -> object:
    """Shared Gemini call + budget/retry/backoff logic for both single-card
    (structure_chunk) and multi-card (structure_multi_card) structuring —
    the only difference between the two call sites is the prompt/contents
    going in and the shape-validator checking what comes back (a dict vs a
    list of dicts), so that's the one thing this takes as a parameter.
    Shape-validation failures are retried just like API failures were
    before this was split out — a malformed response is still worth one
    more attempt before giving up.
    """
    client = genai.Client(api_key=cfg.gemini_api_key)

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            _check_and_increment_budget(cfg.daily_call_budget)
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    response_mime_type="application/json",
                ),
            )
            if not response.text:
                # Call succeeded HTTP-wise but returned no content — usually
                # a safety filter block or truncation, not something a
                # bare json.loads() should choke on with an opaque error.
                finish_reason = None
                if response.candidates:
                    finish_reason = response.candidates[0].finish_reason
                raise RuntimeError(
                    f"Empty response from model (finish_reason={finish_reason}). "
                    f"Likely a safety filter block — check input content."
                )
            data = json.loads(response.text)
            validate_shape(data)
            return data
        except BudgetExceeded:
            raise
        except errors.ClientError as e:
            if e.code in NON_RETRYABLE_STATUS_CODES:
                # e.g. 404 model-not-found — will never succeed on retry.
                # Fail immediately instead of burning 3 attempts (and, under
                # concurrency, 3 attempts PER WORKER) against a thin daily quota.
                raise RuntimeError(f"Non-retryable API error ({e.code} {e.status}): {e.message}") from e
            # e.g. 429 rate-limited — worth a backoff, same as before.
            last_error = e
            wait = 2 ** attempt
            print(f"  ⚠️  Rate limited (attempt {attempt}/{max_retries}): {e.status}. Retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:  # noqa: BLE001 — network errors, json errors, shape errors, etc.
            last_error = e
            wait = 2 ** attempt
            print(f"  ⚠️  LLM call failed (attempt {attempt}/{max_retries}): {e}. Retrying in {wait}s...")
            time.sleep(wait)

    raise RuntimeError(f"LLM structuring failed after {max_retries} attempts: {last_error}")


def structure_chunk(chunk: Chunk, cfg: PipelineConfig, max_retries: int = 3) -> StructuredCard:
    if not cfg.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set — check your .env file.")

    if chunk.mode == "verse":
        system_prompt = VERSE_SYSTEM_PROMPT
        temperature = cfg.temperature_verse
    elif chunk.mode == "verbatim":
        system_prompt = VERBATIM_SYSTEM_PROMPT
        # Same "preserve, don't paraphrase" fidelity requirement as verse —
        # zero creativity, literal translation only.
        temperature = cfg.temperature_verse
    else:
        system_prompt = _build_concept_prompt(cfg)
        temperature = cfg.temperature_concept

    # model name in config.yaml uses the "models/..." form some older docs
    # use — the current SDK wants just the bare model id, so strip the prefix
    # if present rather than making every config.yaml author remember this.
    model_name = cfg.llm_model.removeprefix("models/")

    data = _generate_structured_json(
        model_name, system_prompt, temperature, chunk.text, cfg, max_retries,
        validate_shape=_validate_llm_shape,
    )
    return StructuredCard(
        original_verse=data.get("original_verse"),
        content=data["content"],
    )


def structure_multi_card(full_text: str, style: str, cfg: PipelineConfig, max_retries: int = 3) -> list[StructuredCard]:
    """Types 1 & 5 (digest / narrative): ONE LLM call over the full text of
    a book/chapter/story, returning a JSON array of cards rather than one
    card per chunk. Reuses _generate_structured_json for the exact same
    budget/retry/thread-safety behavior as structure_chunk — see that
    function's docstring.
    """
    if style not in ("digest", "narrative"):
        raise ValueError(f"Unknown multi-card style: {style!r} — expected 'digest' or 'narrative'")
    if not cfg.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set — check your .env file.")

    system_prompt = DIGEST_SYSTEM_PROMPT if style == "digest" else NARRATIVE_SYSTEM_PROMPT
    # Both styles involve real compression/structuring judgment (how many
    # cards, where to split), same as concept mode — not literal
    # preservation like verse/verbatim, so they get the same latitude.
    temperature = cfg.temperature_concept
    model_name = cfg.llm_model.removeprefix("models/")

    data = _generate_structured_json(
        model_name, system_prompt, temperature, full_text, cfg, max_retries,
        validate_shape=_validate_multi_llm_shape,
    )
    return [StructuredCard(original_verse=c.get("original_verse"), content=c["content"]) for c in data]