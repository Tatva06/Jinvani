"""
Tests for the digest/narrative/verbatim ingestion modes added in this
session. Uses stdlib unittest + unittest.mock (pytest isn't in
requirements.txt and these don't need anything it offers) — no real
Gemini or Supabase calls are made; both clients are mocked.

Run with:
    source venv/bin/activate && python -m unittest test_pipeline -v
"""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import structure
from chunk import Chunk, chunk_verbatim
from config import PipelineConfig, WordBounds
from extract import PageText
from ingest import ingest_card
from structure import StructuredCard, structure_chunk, structure_multi_card
from validate import validate_multi_card


def make_cfg() -> PipelineConfig:
    return PipelineConfig(
        llm_provider="gemini",
        llm_model="models/gemini-3.6-flash",
        temperature_concept=0.4,
        temperature_verse=0.0,
        daily_call_budget=1000,
        word_bounds={
            "en": WordBounds(min_words=5, max_words=200),
            "hi": WordBounds(min_words=5, max_words=200),
            "gu": WordBounds(min_words=5, max_words=200),
        },
        verse_regex=r"Sutra\s+\d+\.\d+",
        verse_similarity_threshold=0.85,
        min_chunk_chars=10,
        gemini_api_key="fake-test-key",
        supabase_url="https://fake.supabase.co",
        supabase_key="fake-key",
    )


def fake_lang_content(word_count: int = 10) -> dict:
    return {"title": "A Title", "body": " ".join(["word"] * word_count), "takeaway": "A takeaway."}


def make_fake_response(payload) -> MagicMock:
    response = MagicMock()
    response.text = json.dumps(payload)
    response.candidates = []
    return response


class MultiCardModesTest(unittest.TestCase):
    def setUp(self) -> None:
        # Isolate the daily-budget tracker from the real one used by real
        # pipeline runs — these tests make several "calls" against a mock
        # client and shouldn't move the real .llm_call_budget.json. Point
        # at a path inside a fresh temp dir that does NOT exist yet:
        # _load_budget_state() only json.loads()s it if .exists() is True,
        # so a nonexistent path correctly falls through to its default
        # {"date": today, "count": 0} rather than failing to parse an
        # empty file.
        self._tmp_dir = tempfile.mkdtemp()
        self._budget_patch = patch.object(structure, "BUDGET_STATE_PATH", Path(self._tmp_dir) / "budget.json")
        self._budget_patch.start()
        self.cfg = make_cfg()

    def tearDown(self) -> None:
        self._budget_patch.stop()

    # ── digest: correct array ────────────────────────────────────────────
    def test_digest_returns_correct_array(self):
        payload = [
            {"original_verse": None, "content": {lang: fake_lang_content() for lang in ("en", "hi", "gu")}}
            for _ in range(4)
        ]
        with patch("structure.genai.Client") as MockClient:
            MockClient.return_value.models.generate_content.return_value = make_fake_response(payload)
            cards = structure_multi_card("full book text here...", "digest", self.cfg)

        self.assertEqual(len(cards), 4)
        self.assertTrue(all(isinstance(c, StructuredCard) for c in cards))
        results = validate_multi_card(cards, self.cfg)
        self.assertTrue(all(r.passed for r in results), [r.reasons for r in results])

    # ── narrative: correct array ─────────────────────────────────────────
    def test_narrative_returns_correct_array(self):
        payload = [
            {"original_verse": None, "content": {lang: fake_lang_content() for lang in ("en", "hi", "gu")}}
            for _ in range(6)
        ]
        with patch("structure.genai.Client") as MockClient:
            MockClient.return_value.models.generate_content.return_value = make_fake_response(payload)
            cards = structure_multi_card("full story text here...", "narrative", self.cfg)

        self.assertEqual(len(cards), 6)
        results = validate_multi_card(cards, self.cfg)
        self.assertTrue(all(r.passed for r in results), [r.reasons for r in results])

    # ── malformed array element caught by validate_multi_card, not ingested ──
    def test_malformed_element_flagged_not_ingested(self):
        good = StructuredCard(
            original_verse=None,
            content={lang: fake_lang_content() for lang in ("en", "hi", "gu")},
        )
        # Missing 'gu' entirely, and an empty 'en' title — should fail.
        malformed = StructuredCard(
            original_verse=None,
            content={
                "en": {"title": "", "body": "word " * 10, "takeaway": "ok"},
                "hi": fake_lang_content(),
            },
        )
        cards = [good, malformed, good]
        results = validate_multi_card(cards, self.cfg)

        self.assertTrue(results[0].passed)
        self.assertFalse(results[1].passed)
        self.assertTrue(any("gu" in r for r in results[1].reasons))
        self.assertTrue(any("title is empty" in r for r in results[1].reasons))
        self.assertTrue(results[2].passed)

        # The policy this feeds (digest: ingest passing, flag failing;
        # narrative: any failure rejects the whole batch) lives in
        # run.py's _run_multi_card, not in validate_multi_card itself —
        # confirm the filtering it does produces the expected subset.
        passing_only = [c for c, r in zip(cards, results) if r.passed]
        self.assertEqual(len(passing_only), 2)


class VerbatimModeTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp_dir = tempfile.mkdtemp()
        self._budget_patch = patch.object(structure, "BUDGET_STATE_PATH", Path(self._tmp_dir) / "budget.json")
        self._budget_patch.start()
        self.cfg = make_cfg()

    def tearDown(self) -> None:
        self._budget_patch.stop()

    def test_chunk_verbatim_reuses_concept_paragraph_splitting(self):
        pages = [
            PageText(page_number=1, text="First paragraph, long enough to pass the min-char floor easily."
                                          "\n\n"
                                          "Second paragraph, also long enough to pass the min-char floor."),
        ]
        chunks = chunk_verbatim(pages, min_chunk_chars=10)
        self.assertEqual(len(chunks), 2)
        self.assertTrue(all(c.mode == "verbatim" for c in chunks))

    def test_verbatim_card_ingested_with_correct_card_type(self):
        chunk = Chunk(text="A full original paragraph from the book.", page_number=5, mode="verbatim", citation_label="p. 5")
        payload = {
            "original_verse": None,
            "content": {lang: fake_lang_content(word_count=30) for lang in ("en", "hi", "gu")},
        }
        with patch("structure.genai.Client") as MockClient:
            MockClient.return_value.models.generate_content.return_value = make_fake_response(payload)
            card = structure_chunk(chunk, self.cfg)

        self.assertIsInstance(card, StructuredCard)

        # validate_card should NOT enforce word bounds for verbatim, even
        # though word_bounds here (5-200) would happily pass a 30-word
        # body anyway — exercise the actual skip path with an
        # out-of-bounds body to prove it's really skipped, not just
        # coincidentally passing.
        from validate import validate_card
        long_body_card = StructuredCard(
            original_verse=None,
            content={lang: fake_lang_content(word_count=500) for lang in ("en", "hi", "gu")},  # way over max_words=200
        )
        result = validate_card(chunk, long_body_card, self.cfg)
        self.assertTrue(result.passed, result.reasons)

        # Now confirm ingest_card resolves card_type='verbatim' for a
        # verbatim-mode chunk, via a fake Supabase client — no network.
        fake_client = _FakeSupabaseClient()
        outcome = ingest_card(fake_client, chunk, card, deck_id="deck-123", book_title="Test Book")

        self.assertEqual(outcome.status, "inserted")
        self.assertEqual(fake_client.inserted_rows[0]["card_type"], "verbatim")
        self.assertEqual(fake_client.inserted_rows[0]["citation_reference"], "Test Book, p. 5")


class _FakeQuery:
    """Minimal stand-in for supabase-py's fluent table().select()/insert()
    query builder — just enough surface for ingest.py's calls, no network."""

    def __init__(self, client: "_FakeSupabaseClient", table: str):
        self._client = client
        self._table = table
        self._insert_row: dict | None = None

    def select(self, *_a, **_kw):
        return self

    def eq(self, *_a, **_kw):
        return self

    def order(self, *_a, **_kw):
        return self

    def limit(self, *_a, **_kw):
        return self

    def insert(self, row: dict):
        self._insert_row = row
        return self

    def execute(self):
        result = MagicMock()
        if self._insert_row is not None:
            self._client.inserted_rows.append(self._insert_row)
            result.data = [{"id": f"fake-card-{len(self._client.inserted_rows)}"}]
        else:
            result.data = []  # no existing rows: _already_exists() -> False, _get_next_sequence_order() -> 1
        return result


class _FakeSupabaseClient:
    def __init__(self):
        self.inserted_rows: list[dict] = []

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)


if __name__ == "__main__":
    unittest.main()
