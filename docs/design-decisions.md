# Design decisions

## Why a custom rule engine?

The constraints are a short list of conditional comparisons: if the frame is steel, the bay cannot exceed 1800 mm. A general solver would hide that list behind a library and make the failure messages someone else's format. The evaluator is a loop. Each rule is engaged or not, and the constraint holds or it does not. That is the version that can be walked through in an interview.

## Why evaluate on the client?

Dragging bay width has to update the model, the checks, and the price together, without a network round trip. The rules are data. Shipping them to the browser and running `evaluate` keeps that loop under a millisecond. The server is used when the user shares a configuration or asks Claude to draft a rule.

## Why a small DSL?

The built-in rules and the AI proposals have to be the same kind of object. A DSL with `WHEN`, `THEN`, a severity, and a written explanation is enough for this product. It is also the safety boundary: if a proposal cannot be parsed, it cannot enter the engine. A larger language would need a sandbox. This one does not execute anything.

## Why not a general constraint solver?

A solver is a good fit when the system must search a large space for any feasible assignment. Kit Engine does not search. The user chooses the values, and the engine says which rules those values break, with the numbers that caused it. Search would also make the explanation harder: the user wants "bay width is 2200 mm and the steel limit is 1800 mm", not "the solver returned unsat".

## Why primitives instead of CAD imports?

An imported mesh can be scaled, but bay count would still be a texture on one object. Building uprights, beams, and shelves from the layout function means four bays are eight more posts than two bays. Reinforced steel is a larger section, not a different file. The geometry tests count those meshes without starting WebGL.

## Why does AI produce a diff?

A sentence like "panel width must stay under 2.4 m" can map to the wrong parameter, the wrong operator, or a warning that should have been an error. The compiler rejects anything outside the grammar. What survives is shown as DSL, with the explanation, the affected parameter, and the severity. Approve writes it into the rule list. Reject throws it away. The model has no tool that edits source files, the database schema, or the built-in catalogue.

## Why is the engine independent of React?

`npm test` imports `evaluate` from Node. There is no canvas and no store. That keeps the structural behaviour pinned by tests: steel at 1800 is valid, steel at 1801 is not, and a configuration can fail several rules at once. UI changes cannot quietly fork a second copy of the rules.

## Why is pricing on the same evaluation?

The price is a function of the configuration and the derived values, called at the end of `evaluate`. The PDF and the summary read `result.price`. If the price lived in a component, a new accessory would be easy to add to the model and forget in the quote. Invalid configurations still receive a price, labelled as an estimate, because the numbers are useful while the engineer is fixing the run.
