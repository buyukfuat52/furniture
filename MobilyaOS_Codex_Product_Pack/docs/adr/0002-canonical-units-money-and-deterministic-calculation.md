# ADR-0002: Canonical Units, Money, and Deterministic Calculation Authority

Status: Accepted for P1 planning
Date: 2026-07-15

## Context

The product promise requires quote totals to be explainable down to product revision, part, operation, supplier price observation, formula version, quantity, and approval decision. LLMs are explicitly forbidden from calculating authoritative dimensions, BOM quantities, nesting, costs, taxes, margins, or totals.

## Decision

Use integer millimetres for geometry and integer minor units plus ISO currency for money in the initial implementation plan. Percentages use basis points unless a later ADR narrows a specific exact-decimal need.

All authoritative numbers must come from deterministic, versioned domain services. Snapshots store formula version, price observation IDs, quantities, unit conversions, rounding steps, actor/tenant/correlation provenance, and generated artifact hashes where applicable.

## Consequences

- Domain tests must be table-driven and golden-tested for BOM, edge banding, nesting, labor, money, pricing, VAT, revision immutability, and snapshot reproducibility.
- Browser and LLM layers may display, explain, or request calculations through tools, but never calculate authoritative values.
- Markup and gross margin are separate formulas and must be labeled separately in APIs, UI, documents, and tests.

## Risks

- Supplier price units and conversions need a precise schema in P2 to avoid hidden decimal drift.
- Rounding policy must be contractually explicit before UI and PDF consumers depend on totals.
