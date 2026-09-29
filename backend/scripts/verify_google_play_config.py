"""Static Google Play staging checks. Does not call Google APIs or print secrets."""

from __future__ import annotations

import sys

from app.config import Settings
from app.core.google_play_config import (
    GOOGLE_PLAY_PRODUCT_IDS,
    resolve_google_play_credentials,
    validate_google_play_staging_config,
)


def main() -> int:
    settings = Settings()
    _, creds = resolve_google_play_credentials(settings)
    errors = validate_google_play_staging_config(settings)
    print(f"package_name: {settings.google_play_package_name or 'missing'}")
    print(f"verify_mode: {settings.subscription_verify_mode}")
    print(f"credentials: {'present' if creds.present else 'missing'} ({creds.source})")
    print(f"pubsub_project: {'set' if settings.google_pubsub_project.strip() else 'missing'}")
    print(f"pubsub_topic: {'set' if settings.google_pubsub_topic.strip() else 'missing'}")
    print(
        "pubsub_subscription: "
        f"{'set' if settings.google_pubsub_subscription.strip() else 'missing'}"
    )
    print(f"webhook_secret: {'set' if settings.google_play_webhook_secret.strip() else 'missing'}")
    print("catalog_product_ids:")
    for product_id in GOOGLE_PLAY_PRODUCT_IDS:
        print(f"  - {product_id}")
    if errors:
        print("status: FAIL")
        for item in errors:
            print(f"  - {item}")
        return 1
    print("status: READY (static checks only; live Play E2E is not claimed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
