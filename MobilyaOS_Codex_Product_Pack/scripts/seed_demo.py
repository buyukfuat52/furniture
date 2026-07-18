from __future__ import annotations

import json


def main() -> None:
    seed = {
        "company": {
            "id": "11111111-1111-4111-8111-111111111111",
            "name": "Demo Mobilya A.S.",
            "currency": "TRY",
        },
        "users": [
            {"email": "admin@demo.local", "role": "admin"},
            {"email": "satis@demo.local", "role": "sales"},
            {"email": "viewer@demo.local", "role": "viewer"},
        ],
        "password": "Demo1234!ChangeMe",
        "note": "P2 seed stub only; persistence seeding is implemented in a later phase.",
    }
    print(json.dumps(seed, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
