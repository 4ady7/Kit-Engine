/**
 * Built-in structural rules, authored in the rule DSL.
 * The engine never special-cases these strings; they are parsed at startup.
 */
export const BUILTIN_DSL = `
# Span limits follow the frame stock, not a single global maximum.
RULE steel-width-limit ERROR
WHEN frameMaterial == "steel"
THEN bayWidth <= 1800
MESSAGE "Steel frames support a maximum bay width of 1800 mm."
EXPLAIN "Standard steel uprights and beams are rated for spans up to 1800 mm. Beyond that, beam deflection exceeds the design limit."
SUGGEST "Reduce bay width to 1800 mm or switch to reinforced framing."
FIX bayWidth = 1800
FIX frameMaterial = "reinforced-steel"

RULE reinforced-width-limit ERROR
WHEN frameMaterial == "reinforced-steel"
THEN bayWidth <= 2400
MESSAGE "Reinforced steel frames support a maximum bay width of 2400 mm."
EXPLAIN "Reinforced frames extend the allowable span to 2400 mm, which is also the widest bay this system can build."
SUGGEST "Reduce bay width to 2400 mm."
FIX bayWidth = 2400

# Deeper shelves move the load away from the uprights.
RULE deep-shelf-bracing ERROR
WHEN shelfDepth >= 900
THEN bracing == "heavy-duty"
MESSAGE "Shelf depths of 900 mm or more require heavy-duty bracing."
EXPLAIN "A deeper shelf increases the moment the frame must resist. Standard bracing is not rated for that geometry."
SUGGEST "Select heavy-duty bracing, or reduce shelf depth below 900 mm."
FIX bracing = "heavy-duty"
FIX shelfDepth = 800

RULE load-bracing ERROR
WHEN loadRating > 600
THEN bracing == "heavy-duty"
MESSAGE "Load ratings above 600 kg require heavy-duty bracing."
EXPLAIN "Standard bracing is rated to 600 kg per shelf level. Higher loads need the heavy-duty brace."
SUGGEST "Select heavy-duty bracing, or reduce the load rating to 600 kg."
FIX bracing = "heavy-duty"
FIX loadRating = 600

RULE height-bracing ERROR
WHEN overallHeight > 3000
THEN bracing == "heavy-duty"
MESSAGE "Frames taller than 3000 mm require heavy-duty bracing."
EXPLAIN "Above 3 m the frame is more sensitive to racking, so heavy-duty bracing is mandatory."
SUGGEST "Select heavy-duty bracing, or reduce overall height to 3000 mm."
FIX bracing = "heavy-duty"
FIX overallHeight = 3000

# A recommendation, not a structural failure. The configuration can still be quoted.
RULE wide-run-safety-back WARNING
WHEN bayCount >= 6
THEN safetyBack == true
MESSAGE "Runs of 6 or more bays should include a safety back."
EXPLAIN "Longer runs are more likely to be loaded from aisles on both sides. A safety back stops goods passing through the frame."
SUGGEST "Enable the safety back accessory."
FIX safetyBack = true

# shelfPitchMm is derived. The rule always applies; there is no WHEN clause.
RULE shelf-pitch ERROR
THEN shelfPitchMm >= 250
MESSAGE "Shelves are spaced closer than the 250 mm minimum pitch."
EXPLAIN "Pitch is the distance between shelf surfaces. It is calculated from overall height and shelf count, after top and bottom clearances."
SUGGEST "Reduce the shelf count or increase the overall height until the pitch is at least 250 mm."

RULE timber-span WARNING
WHEN shelfMaterial == "timber"
THEN bayWidth <= 1500
MESSAGE "Timber shelves wider than 1500 mm should be reviewed for sag."
EXPLAIN "Timber decking is not as stiff as steel. Spans above 1500 mm can sag under a distributed load."
SUGGEST "Reduce bay width to 1500 mm or switch the shelves to steel."
FIX bayWidth = 1500
FIX shelfMaterial = "steel"

RULE timber-load WARNING
WHEN shelfMaterial == "timber"
THEN loadRating <= 500
MESSAGE "Timber shelves above 500 kg should be reviewed."
EXPLAIN "The timber deck used by this system is specified up to 500 kg per level. Heavier duties need a steel shelf."
SUGGEST "Reduce the load rating to 500 kg or switch the shelves to steel."
FIX loadRating = 500
FIX shelfMaterial = "steel"
`;
