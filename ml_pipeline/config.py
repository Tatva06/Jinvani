"""
Config loader for the ML ingestion pipeline.
Reads config.yaml for tunable pipeline settings and .env for secrets.
Never hardcode API keys, deck IDs, or URLs in code — see run.py for CLI args.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()

DEFAULT_CONFIG_PATH = Path(__file__).parent / "config.yaml"


@dataclass
class WordBounds:
    min_words: int
    max_words: int


@dataclass
class PipelineConfig:
    llm_provider: str
    llm_model: str
    temperature_concept: float
    temperature_verse: float
    daily_call_budget: int
    word_bounds: dict[str, WordBounds]
    verse_regex: str
    verse_similarity_threshold: float
    min_chunk_chars: int

    # Secrets, pulled from env only — never from yaml, never hardcoded.
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    supabase_url: str = field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    supabase_key: str = field(default_factory=lambda: os.getenv("SUPABASE_KEY", ""))


def load_config(path: str | Path = DEFAULT_CONFIG_PATH) -> PipelineConfig:
    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    word_bounds = {
        lang: WordBounds(min_words=bounds[0], max_words=bounds[1])
        for lang, bounds in raw["word_bounds"].items()
    }

    return PipelineConfig(
        llm_provider=raw["llm"]["provider"],
        llm_model=raw["llm"]["model"],
        temperature_concept=raw["llm"]["temperature_concept"],
        temperature_verse=raw["llm"]["temperature_verse"],
        daily_call_budget=raw["llm"]["daily_call_budget"],
        word_bounds=word_bounds,
        verse_regex=raw["verse_regex"],
        verse_similarity_threshold=raw["validation"]["verse_similarity_threshold"],
        min_chunk_chars=raw["validation"]["min_chunk_chars"],
    )
