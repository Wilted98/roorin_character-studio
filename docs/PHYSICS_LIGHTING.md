# Native hair physics and creator lighting

Run `python tools/extract_hair_physics.py` and `python tools/extract_lighting.py` from the project directory. Both scripts read original exports without modifying them.

## Hair physics

`public/assets/hair-physics.json` contains 178 exported hair variants (90 GF, 88 GM), 1,398 KawaiiPhysics nodes, 95 deduplicated collision-limit sets and 14 external curve references. It includes more variants than the current browser catalog so later mesh additions can reuse the extraction.

Use `genders[gender][hairId].nodes`. Each node retains its native root, parent-linked descendants, settings, exclusions, frame rate, gravity and limit-set ID. `bones` is a hierarchy, not necessarily one linear chain. The source skeleton confirms the roots; six nodes in GF/GM hair208 reference absent `Hair_Under_B_001`, `Hair_Under_BL_001`, or `Hair_Under_BR_001` roots and are explicitly marked `rootFound: false`. Skip them.

Settings preserve source units: radius, dummy length and collision offsets are centimetres, rotations are Unreal rotators. Do not use these as glTF bone-local values without the same coordinate conversion used for character import. Collision limit sets keep authored asset values and node-cached values separately. Cached world Location/Rotation values are discarded; use `DrivingBone` plus `OffsetLocation`/`OffsetRotation` at runtime. Some cached capsule values differ from authored limit assets. Resolving a policy is part of browser reconstruction, not an assertion of the native runtime's exact behavior.

For GF hair201, typical node values are damping0.1, stiffness0.05, world location/rotation damping0.8, radius3cm and gravity[0,0,0]. An inertial spring can still respond to head animation with zero gravity. Apply simulation after the animation/customization pose, pin each root to that pose, constrain segment lengths, and transform collider offsets through their current driving bones. Restore the unmodified pose before each new simulation step; do not accumulate quaternion edits into the next frame's rest pose. Missing external curves, dynamic Blueprint overrides and graph reachability prevent claiming a full KawaiiPhysics port.

The 14 unavailable curve exports are listed with `available: false` under `curves` and live beneath `Character/Player/BP` in the game. No guessed curve keys are injected.

## Lighting

`public/assets/lighting.json` provides studio, outdoor and social presets derived from the source environment settings with explicitly enabled PC_WITHOUT_LUMEN overrides. Original HDR files are copied to `public/assets/environment`; their Radiance headers confirm RGBE, 886x443, 2:1 equirectangular images. The filename `02_HDR_12288x6144` is the game asset name, not the resolution of this export.

Native studio values are key2975.3271, fill2624.3933, back500 and additional spot900, with key#F3F3F3, fill#AAAAAA and back#EDF9FF. Native skylight intensity is0.4 in the PC_WITHOUT_LUMEN profile (base profile0.5).

Browser `lights.*.intensity` explicitly divides source intensities by1500 for a directional approximation. It is not photometric equivalence. `offset` is in metres relative to the chosen character target. The transform infers spring-arm positions and aligns the source map camera, located at negative Unreal X, to web positive Z. This scene alignment is distinct from skeletal local-axis conversion. Source rotations, distances, area-light sizes and intensities are retained alongside these approximations.

The fixed browser exposure is a starting point for visual calibration. Native histogram exposure, Lumen, color grading, area-light falloff and volumetrics remain distinct rendering systems; native source values are retained in `sourcePostProcess`. LUT PNGs are included but are not automatically applied by loading the lighting JSON.
