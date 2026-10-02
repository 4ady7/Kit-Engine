# Configuration model

A configuration is the set of choices the user can make. Derived numbers and the price are not stored. They are recomputed.

```ts
interface Configuration {
  bayCount: number
  bayWidth: number
  shelfDepth: number
  overallHeight: number
  shelfCount: number
  frameMaterial: "steel" | "reinforced-steel"
  shelfMaterial: "steel" | "timber"
  loadRating: number
  bracing: "standard" | "heavy-duty"
  accessories: {
    endGuard: boolean
    labelRail: boolean
    safetyBack: boolean
  }
}
```

Accessories are grouped because they are optional add-ons. Rules still see `endGuard`, `labelRail`, and `safetyBack` as flat names. `readParameter` and `applyValue` are the only functions that know about that nesting.

## Catalogue

| Key | Kind | Range | Unit | Group |
| --- | --- | --- | --- | --- |
| bayCount | integer | 1–8 | | Structure |
| bayWidth | integer | 600–2400 | mm | Structure |
| shelfDepth | integer | 300–1200 | mm | Structure |
| overallHeight | integer | 1000–4000 | mm | Structure |
| shelfCount | integer | 2–12 | | Structure |
| frameMaterial | enum | steel, reinforced-steel | | Materials |
| shelfMaterial | enum | steel, timber | | Materials |
| loadRating | integer | 100–1000 | kg | Duty |
| bracing | enum | standard, heavy-duty | | Duty |
| endGuard | boolean | | | Accessories |
| labelRail | boolean | | | Accessories |
| safetyBack | boolean | | | Accessories |
| shelfPitchMm | number, derived | | mm | Derived |

`shelfPitchMm` is not a control. It is `(overallHeight - 180 - 40) / (shelfCount - 1)`, with the span returned as-is when there is only one shelf. The 180 mm bottom clearance and 40 mm top clearance are shared with the layout so the rule and the drawing cannot disagree.

Range failures are separate from DSL rules. A bay of 2500 mm is outside the product family. A bay of 2200 mm on a steel frame is inside the family and fails `steel-width-limit`.

## Default

The opening configuration is a four-bay run: 1200 mm bays, 600 mm deep, 2400 mm tall, five steel shelves, 400 kg, standard bracing, end guards on. It is valid. Total width is 4800 mm.

## Presets

| Preset | Intent |
| --- | --- |
| Standard warehouse | Valid default |
| Heavy duty | Reinforced frames, 1000 mm depth, 800 kg, heavy-duty bracing, safety back |
| Compact storage | Three shorter, shallower bays and label rails |
| High bay | 3800 mm, heavy-duty bracing required and present |
| Retail shelving | Timber shelves at 1600 mm, which passes the steel span rule and warns about sag |
| Steel overspan | Steel, 2200 mm bay |
| High load, standard brace | 800 kg, standard bracing |
| Tall frame, standard brace | 3800 mm, standard bracing |
| Deep shelf, standard brace | 1100 mm depth, standard bracing |
| Multiple issues | Steel 2200 mm bay, deep shelves, tall frame, 800 kg, standard bracing, six bays, no safety back |

## Documents

A shareable document is versioned and contains parameters only:

```json
{ "version": 1, "title": "Standard warehouse", "parameters": {} }
```

`parseConfigurationDocument` rejects a different version and a body that does not match the catalogue types. It does not clamp numbers. Out-of-range values load and then fail evaluation, so the explanation is still visible.

## Price

Whole pounds, from `priceConfiguration`:

- Base system: £480
- Frames: upright count × height in metres × £46 (steel) or £68 (reinforced)
- Beams: shelf count × bay width in metres × £16
- Shelves: total deck area × £92/m² (steel) or £70/m² (timber)
- Load: each 100 kg above 300 kg costs £28 per bay
- Bracing: £32 (standard) or £74 (heavy duty) per bay, × 1.15 above 2500 mm
- End guards: £90
- Label rails: £8 per shelf
- Safety back: £36 per bay per metre of height

The standard warehouse preset totals £3,071. That figure is asserted in `src/tests/engine/pricing.test.ts`.
