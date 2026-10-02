# Performance

Rule evaluation is synchronous and local. Changing a slider does not call the network. Claude runs only from **Propose rule**. Saving runs only from **Save** or **Share**.

## Budget

The interaction budget is 100 ms for evaluation and the UI update that follows it. The engine's own cost is far below that. A local run of `benchmarkRules()` on the default configuration, 1000 iterations, 9 built-in rules, and 13 parameters measured:

- average: about 0.003 ms
- max: under 1 ms

Those figures move with the machine. `src/tests/engine/project.test.ts` fails if the average or the max over 200 iterations reaches 100 ms.

In development, open the Rules tab and use **Run evaluation benchmark**. It times the rules currently loaded, including approved custom rules, over 400 iterations.

## What the benchmark includes

`benchmarkRules` calls `evaluate`, so the measurement covers derived values, range checks, every rule, and the price. It does not include React renders or WebGL. Those are a separate cost and are kept small by:

- not rebuilding a CAD model
- sharing one animated material per part family instead of allocating a material per mesh per frame
- writing material colour from `useFrame` instead of re-rendering React to fade a colour
- recording a slider gesture as one history snapshot

## Geometry guard

`buildLayout` caps the meshes it will create at 16 bays and 24 shelf levels. That cap is not a product rule. The evaluation still reports the typed value. The cap exists so a number such as 100000 cannot freeze the page.

## Loading

The first paint is the default shelving run. A loading line is shown only while a shared configuration is being fetched, and while a rule proposal, save, or PDF is in flight.
