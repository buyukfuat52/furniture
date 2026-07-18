# Agent Result

Return a handoff conforming to `.codex/orchestration/handoff.schema.json`.

Include:

- concise outcome;
- files read and changed;
- contract changes, or explicitly none;
- decisions and assumptions;
- commands actually executed and their results;
- blockers and residual risks;
- exact next action requested from the parent.

Do not report a recommendation as executed evidence.
