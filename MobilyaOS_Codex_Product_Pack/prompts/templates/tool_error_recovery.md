<tool_error>
{{tool_error_json}}
</tool_error>

Return a schema-valid response that:
1. Does not claim the action succeeded.
2. Explains the failure in user-safe Turkish.
3. States whether retry is safe and what idempotency key applies.
4. Requests only the minimum missing input or approval.
