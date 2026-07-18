---
name: prompt-evaluation
description: Use when adding or changing application system prompts, agent tools, structured outputs, authorization gates, or prompt-injection defenses.
---

# Prompt Evaluation Workflow

1. Identify prompt ID and version in `prompts/registry.yaml`.
2. Keep fixed instructions and variable inputs separate.
3. Validate all tool names and schemas against `tools/tool_catalog.json`.
4. Require output to match `agent_response.schema.json`.
5. Add positive, ambiguous, unauthorized, injection and tool-error cases.
6. Run prompt registry/schema/eval validation with a deterministic fake model first.
7. Confirm the model never produces authoritative manufacturing or financial calculations.
8. Record prompt version and evaluation result.
