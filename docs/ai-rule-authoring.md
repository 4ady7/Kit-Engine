# AI rule authoring

The AI Rule Author turns a sentence into a proposed rule. It cannot change the running configuration by itself.

## Flow

1. The engineer types a constraint, for example "Panel width must stay under 2.4 m if using a steel frame."
2. The browser `POST`s `{ instruction }` to `/api/rules/compile`.
3. The server calls the Claude Messages API with a system prompt that lists the parameters, operators, and the JSON shape. The model has no tools.
4. The server extracts JSON, then `compileProposedRule` checks it.
5. The panel shows the DSL as a diff, plus the explanation, the affected parameter, and the severity.
6. **Reject** discards it. **Approve rule** parses the DSL again in the browser and, only if that parse succeeds, adds the rule to the store.
7. The browser `POST`s the DSL to `/api/rules`. The server parses it once more before writing.

Steps 6 and 7 both refuse the rule if the grammar check fails. The message is: "Unable to compile this rule using the current rule grammar."

## What the compiler rejects

- Extra JSON keys, unknown operators, unknown parameters
- Enum values that are not in the catalogue
- Comparisons such as `frameMaterial <= "steel"`
- Fixes aimed at `shelfPitchMm` or any other derived value
- An id that already belongs to a built-in or stored rule
- A message that cannot round-trip through the DSL, such as one containing a double quote
- A response that is not JSON

JavaScript in the model's reply never runs. The only path into the engine is `parseRules`.

## What the compiler does not do

It does not check that the rule is a good engineering judgement. A warning that should have been an error can still parse. That is why approval is a human step. The built-in catalogue in `builtin.dsl.ts` is not writable from this panel.

## When Claude is unavailable

If `ANTHROPIC_API_KEY` is unset, the endpoint returns 503 and the panel shows that the API is not configured. The client does not invent a rule locally. A timeout or a failed HTTP call returns 502 and asks the engineer to try again.

## Storage

Approved rules are DSL text. On load, each string is compiled and dropped if it no longer parses. The file store and the `custom_rules` table keep `id`, `dsl`, and `created_at`. Removing a rule deletes that row. Built-in ids return 403 on delete and 409 on insert.

The in-browser list is also written to `localStorage`. If the server cannot be reached, the last local list is kept and a banner says so. When the server responds, its rules are merged with any local rules the server does not have, so a rule approved while the server was down is not discarded by an empty response.
