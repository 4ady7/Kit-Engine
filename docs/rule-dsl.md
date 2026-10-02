# Rule DSL

The DSL expresses constraints. It is not a programming language. There is no arithmetic, no `OR`, no functions, and no way to call JavaScript.

## Grammar

A document is a sequence of rules. Blank lines and lines starting with `#` are ignored.

```
rule      = "RULE" id severity newline body
severity  = "ERROR" | "WARNING"
body      = when? then message explain suggest fix*
when      = "WHEN" predicate ("AND" predicate)* newline
then      = "THEN" predicate newline
message   = "MESSAGE" string newline
explain   = "EXPLAIN" string newline
suggest   = "SUGGEST" string newline
fix       = "FIX" parameter "=" value newline
predicate = parameter operator value
operator  = "==" | "!=" | "<=" | ">=" | "<" | ">"
value     = number | quoted-string | "true" | "false"
id        = lowercase letter, then lowercase letters, digits, or hyphens (3–49 characters)
string    = double quotes, with no escaped quotes and no line breaks
```

`WHEN` is optional. Without it, the rule always applies. `WHEN` accepts at most four predicates, combined with `AND`. There is exactly one `THEN`.

`ERROR` blocks READY TO QUOTE. `WARNING` is reported and the configuration stays valid.

## Parameters

Rules may name any key in the parameter catalogue, including the derived value `shelfPitchMm`. See [configuration-model.md](configuration-model.md).

Numbers accept every operator. Enums (`frameMaterial`, `shelfMaterial`, `bracing`) and booleans (`endGuard`, `labelRail`, `safetyBack`) accept only `==` and `!=`. Enum values must be one of the catalogue options. A fix (`FIX`) may only assign a settable parameter, so a rule cannot "set" shelf pitch directly.

## How a rule is judged

The rule is engaged when every `WHEN` predicate is true. The rule fails when it is engaged and the `THEN` predicate is false. Both sides read the same evaluation context.

## Explanations

`MESSAGE` is the sentence in the checks panel. `EXPLAIN` is the reason. `SUGGEST` is the recommended change. Each `FIX` becomes a button. The engine also records a trace: the rule id, the input values, the constraint, and `FAIL`. The Why? control prints that trace. The UI does not invent it.

## Examples

```
RULE steel-width-limit ERROR
WHEN frameMaterial == "steel"
THEN bayWidth <= 1800
MESSAGE "Steel frames support a maximum bay width of 1800 mm."
EXPLAIN "Standard steel uprights and beams are rated for spans up to 1800 mm. Beyond that, beam deflection exceeds the design limit."
SUGGEST "Reduce bay width to 1800 mm or switch to reinforced framing."
FIX bayWidth = 1800
FIX frameMaterial = "reinforced-steel"
```

```
RULE wide-run-safety-back WARNING
WHEN bayCount >= 6
THEN safetyBack == true
MESSAGE "Runs of 6 or more bays should include a safety back."
EXPLAIN "Longer runs are more likely to be loaded from aisles on both sides. A safety back stops goods passing through the frame."
SUGGEST "Enable the safety back accessory."
FIX safetyBack = true
```

```
RULE shelf-pitch ERROR
THEN shelfPitchMm >= 250
MESSAGE "Shelves are spaced closer than the 250 mm minimum pitch."
EXPLAIN "Pitch is the distance between shelf surfaces. It is calculated from overall height and shelf count, after top and bottom clearances."
SUGGEST "Reduce the shelf count or increase the overall height until the pitch is at least 250 mm."
```

## Compilation

`parseRules` checks syntax only. `compileRuleSource` then checks that every parameter, operator, and fix is legal. Built-in rules and approved custom rules both go through that function. A document that contains a broken clause drops the whole rule.

AI proposals take one extra step, in `compileProposedRule`: the JSON must match a strict schema, it is printed with `formatRule`, and the printed DSL is parsed again. The object that enters the store is the parser's output, not the model's object.

## Limitations

- No `OR`, parentheses, or arithmetic. "Steel or a short bay" has to be two rules.
- Strings cannot contain a double quote.
- A fix is a constant. The shelf-pitch rule cannot compute the right shelf count for the current height, so it explains the change instead of offering a wrong button.
- The engine does not search for a nearby valid configuration. Fixes are the ones the rule author wrote.
- Duplicate ids in one document are rejected. A custom rule cannot reuse a built-in id.
