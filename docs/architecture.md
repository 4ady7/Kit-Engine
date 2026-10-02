# Architecture

Kit Engine is a single Vite application plus a small API mounted on the dev and preview servers. The dependency direction is one way:

```
UI  →  store  →  domain engine  →  rules / pricing / derived values
```

Three.js, the PDF, and the validation panel all consume an `EvaluationResult`. None of them reimplement a structural rule.

## Evaluation

`evaluate(config, rules)` in `src/engine/ruleEngine.ts` does five things, in order:

1. `derive` computes run width, frame count, shelf pitch, and shelf area. Pitch uses the same top and bottom clearances as the 3D layout.
2. The configuration and those derived numbers are flattened into one context. Rules can read `safetyBack` and `shelfPitchMm` without knowing which object they live on.
3. Numeric parameters outside their catalogue range become errors. These are product limits, not structural rules.
4. Every rule is tested. A rule is engaged when all `WHEN` predicates match. An empty `WHEN` means the rule always applies. If the `THEN` predicate fails, the engine adds an error or a warning. Evaluation does not stop at the first failure.
5. `priceConfiguration` prices the configuration even when it is invalid, so the panel can show an estimate.

`valid` means there are no errors. Warnings leave the configuration quoteable, with status VALID WITH WARNINGS. No errors and no warnings is READY TO QUOTE.

## What the UI is allowed to do

The store holds the configuration, the undo stack, and approved custom rules. `useEvaluation` calls `evaluate`. Components display `result.errors`, `result.price`, and `result.derived`. A fix button calls `applyValue` and then the next render re-evaluates. The button does not know whether the fix is sufficient.

Slider drags call `beginGesture` / `setParameter(..., "live")` / `endGesture`. Live updates change the configuration without a history entry. Releasing the pointer stores one snapshot. Undo and redo walk those snapshots. Command/Ctrl+Z and Shift+Command/Ctrl+Z are wired in the shell and ignored while a field is focused, so text editing keeps the browser's own undo.

## Geometry

`buildLayout` is a pure function from a configuration to uprights, beams, shelves, braces, and accessories in metres. The React Three Fiber components map those lists to meshes. A rendering cap (16 bays, 24 shelves) stops a typed outlier from allocating unbounded geometry. The validation result still reports the real number.

Highlighting comes from `highlightedParts`. An issue's parameter maps to uprights, beams, shelves, or braces, which pick up a red emissive tint. The scene does not inspect rules itself.

## Persistence

`POST /api/configurations` stores `{ version, title, parameters }` plus an author string and timestamps. It does not store `valid`, price, or errors. `GET /api/configurations/:id` returns that record. The client parses it and calls `evaluate` again.

`POST /api/rules/compile` calls Claude. `POST /api/rules` stores DSL only after `compileRuleSource` accepts it. Built-in rule ids cannot be overwritten.

`Repository` has three implementations: memory (tests), `data/store.json` (default), and PostgreSQL when `DATABASE_URL` is set (`server/schema.sql`). If Postgres cannot connect, the server logs the error and uses the file store.

## Files worth reading first

- `src/engine/ruleEngine.ts` — evaluation
- `src/engine/grammar.ts` — parser
- `src/engine/builtin.dsl.ts` — the product rules
- `src/engine/pricing.ts` — the price model
- `src/engine/layout.ts` — parameter to geometry
- `server/handlers.ts` — HTTP boundary
