from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_env: str
    model_provider: str
    core_base_url: str


def load_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        model_provider=os.getenv("MODEL_PROVIDER", "disabled"),
        core_base_url=os.getenv("CORE_BASE_URL", "http://localhost:8080"),
    )
