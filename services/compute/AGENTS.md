# Compute and Agent Service Instructions
- Python code is fully typed and tested.
- Deterministic solver code must accept an explicit seed/version and return validated schemas.
- Runtime prompts are loaded by ID/version from `prompts/registry.yaml`.
- Do not embed secrets or user data into logs.
- Models never replace deterministic domain calculations.
- Tool calls go through the authorized Go core gateway, not direct database access.
- Provide deterministic fake adapters for tests and local demo.
