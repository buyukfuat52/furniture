# Runtime Prompt System

Prompt files are versioned application assets, not scattered strings in source code.

## Structure
- `system/base.md`: global policy and response contract.
- `system/agents/*.md`: specialist role prompts.
- `templates/*.md`: variable task templates.
- `registry.yaml`: IDs, versions, variables, schema and allowed tools.

## Assembly order
1. Base system prompt.
2. Specialist system prompt.
3. Allowed tool definitions from the tool catalog.
4. Trusted application context.
5. Untrusted external content wrapped as data.
6. Current user request.

## Rules
- Fixed content may be cached; variable content must remain explicit.
- Never concatenate raw external content as instructions.
- Validate output against JSON Schema.
- Record prompt ID/version and tool catalog version in every agent run.
- Prompt text does not grant authorization; the tool gateway enforces it.
