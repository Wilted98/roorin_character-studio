# Appearance reconstruction

`tools/extract_appearance.py` resolves the material pointers in the exported `PcCustomizeFeatureTable_Material` and walks material-instance parents. It does not assume that UI selection number matches texture filename. For example, pupil selection 2 references `Cstm_Pupil_10`. Eyebrow entries without an individual texture parameter fall back to the actual `EyeBrow_NUMBER` texture-array layer.

The compact `public/assets/appearance.json` contains five iris patterns, twenty pupil patterns, eleven female / twelve male eyebrows, ten eyelash selections and one hundred skin colors per gender. Fifty-eight referenced packed texture PNGs and the newly exported original game selector/preset icons are copied to `public/assets/appearance`; source exports are unchanged.

`lib/appearance-materials.ts` exports the catalog/settings types, `getDefaultAppearance`, `applyAppearance`, and `disposeAppearance`. Apply after ordinary skin/hair tinting and when selections, colors or model roots change. The helper caches decoded images, restores the original head base map for every brow composite, guards stale asynchronous updates, and disposes superseded generated GPU textures. Preserve existing normals. Call `disposeAppearance` before releasing a model assembly. Do not also run the old iris tint shader over these complete eye maps.

## Packed images and UV reconstruction

- Hair v5 uses each material's `Card_Index_Texture`, the native precomposed five-section DOI atlas, and its separate `ROI_HairCap` texture. Green is coverage, blue is strand ID. Source UV1 uses U0..1 for cards and U1..2 for cap geometry; the combined atlas resolves this with U/2 baked into UV0. Original UV1 is retained. The earlier DIRO approach was wrong for modern UV layouts: GF114's DIRO04 has cards in the upper half and a cap in the lower half, while the mesh's card UVs span full height. Sampling that layout directly caused the visible scalp holes and rectangular card ends. DOI05 green matches DIRO04 upper-half alpha within mean absolute 3.7/255, confirming the layout mismatch. Some older single-UV meshes use their native UV0 as the input. The GM000 bald placeholder's native `M_Hide` material remains invisible.

`tools/repair_hair_atlas.py` repairs existing converted GLBs without reimporting geometry, rigs or morphs. `tools/convert_characters.py` now generates the same native card/cap mapping on fresh conversion. Strand color is a moderate neutral ID variation; web hair shading remains an approximation of Unreal's anisotropic lighting.

- Iris images contain packed channels rather than visible iris colors. The browser uses original R/G detail, chosen center and border colors, and the exported eye UV0 layout (center 0.5, base radius 0.17).
- Pupils use the original inverted red mask. Source pupil identifiers are preserved. Source scalar ranges are available in the catalog. The web conversion of size values to UV scale is approximate.
- Eyebrow NNPH images store normal information in R/G and hair coverage in B. The browser composites that coverage onto the existing head map using the shared UV0 layout. The two placements are mirrored, centered near image coordinates (0.377, 0.318) and (0.623, 0.318), with slightly adjusted male height. This placement is a reconstructed approximation, not a recovered native shader equation. Brow normal perturbation and pencil layering are not reproduced.
- EyelashAO green coverage is applied to existing lash cards, matching the existing Blender conversion. Lower-lash/AO blue/red behavior and native refraction/subsurface shading are not reproduced.

Native shader function exports contain identifiers but stripped expression graphs. Consequently, exact game material parity cannot be established from these exports. These are usable selections backed by actual texture data, with browser approximations for composition and scale.

## Presets and faction

The current extraction includes all 46 normal Female and 44 normal Male game presets, including neutral records. `customization.json` retains supported face and body values. `appearance.json` resolves `HeadType` and `HairType` through the native feature table's `ResourceName`, rather than assuming a selection number equals a mesh suffix. Presets contain `head`, `hair`, `skin`, `hairColor`, `pointedEars`, original PNG `thumbnail`, and `thumbnailOrigin: "game"`. Full original face, body, hair, beard and material records remain available for follow-up rendering work. Six alternate `*_CLB01` records are retained in `unsupportedPresets`, explicitly excluded from the normal rig catalog.

`tools/convert_native_presets.py` converts the referenced head/hair models in isolated background Blender, preserving original geometry, morphs, source files and the user's interactive scene. `tools/shared_glb_images.py` losslessly externalizes embedded image bytes into shared `assets/material-textures/` files; GLB image URIs resolve relative to `assets/models/`. This avoids embedding identical skin/normal PNGs in every head. Original game thumbnails are also used for the iris, pupil, brow and lash selectors where exported. Legacy preview scripts skip entries marked as game thumbnails.

Native preset selection is not a claim of exact Unreal material parity. Symmetric eye rendering uses the source left eye; original asymmetric values remain in `sourceMaterialValues`. Full makeup layering, beard geometry and other unsupported material controls still require implementation.

No faction field exists in the inspected source preset rows, and no Elyos/Asmodian mapping was found in the exported UnrealData. Every preset therefore has `faction: null`; do not infer race from numeric preset IDs or Male/Female keys.

The seven two-axis control pads preserve actual UI pairings (face width/height, jaw width/height, chin width/length, eye spacing/height, mouth width/thickness, ear projection/height, mouth corner width/height). They address the existing recovered bone controls directly.

Validation: extractor rejects unresolved source texture selections, standalone TypeScript compilation passes, and catalog references/ranges are checked against copied files. Browser visual checks remain necessary for reconstructed UV placement across every head.
