# Appearance reconstruction

`tools/extract_appearance.py` resolves the material pointers in the exported `PcCustomizeFeatureTable_Material` and walks material-instance parents. It does not assume that UI selection number matches texture filename. For example, pupil selection 2 references `Cstm_Pupil_10`. Eyebrow entries without an individual texture parameter fall back to the actual `EyeBrow_NUMBER` texture-array layer.

The compact `public/assets/appearance.json` contains five iris patterns, twenty pupil patterns, eleven female / twelve male eyebrows, ten eyelash selections and one hundred skin colors per gender. Fifty-eight referenced original PNGs are copied to `public/assets/appearance` (3.6 MB combined); source exports are unchanged.

`lib/appearance-materials.ts` exports the catalog/settings types, `getDefaultAppearance`, `applyAppearance`, and `disposeAppearance`. Apply after ordinary skin/hair tinting and when selections, colors or model roots change. The helper caches decoded images, restores the original head base map for every brow composite, guards stale asynchronous updates, and disposes superseded generated GPU textures. Preserve existing normals. Call `disposeAppearance` before releasing a model assembly. Do not also run the old iris tint shader over these complete eye maps.

## Packed images and UV reconstruction

- Iris images contain packed channels rather than visible iris colors. The browser uses original R/G detail, chosen center and border colors, and the exported eye UV0 layout (center 0.5, base radius 0.17).
- Pupils use the original inverted red mask. Source pupil identifiers are preserved. Source scalar ranges are available in the catalog. The web conversion of size values to UV scale is approximate.
- Eyebrow NNPH images store normal information in R/G and hair coverage in B. The browser composites that coverage onto the existing head map using the shared UV0 layout. The two placements are mirrored, centered near image coordinates (0.377, 0.318) and (0.623, 0.318), with slightly adjusted male height. This placement is a reconstructed approximation, not a recovered native shader equation. Brow normal perturbation and pencil layering are not reproduced.
- EyelashAO green coverage is applied to existing lash cards, matching the existing Blender conversion. Lower-lash/AO blue/red behavior and native refraction/subsurface shading are not reproduced.

Native shader function exports contain identifiers but stripped expression graphs. Consequently, exact game material parity cannot be established from these exports. These are usable selections backed by actual texture data, with browser approximations for composition and scale.

## Presets and faction

Each gender includes metadata for the same twelve face presets in `customization.json`. Catalog presets retain full original material values, original head/hair selections, source icon paths and the subset of appearance values supported by the browser. Current face presets can be applied to the selected head; a source preset can reference a head outside the included mesh set. Its full native appearance is not implied. Symmetric eye settings use the source left eye; original asymmetric values remain in `sourceMaterialValues`.

No faction field exists in the inspected source preset rows, and no Elyos/Asmodian mapping was found in the exported UnrealData. Every preset therefore has `faction: null`; do not infer race from numeric preset IDs or Male/Female keys. Original icon textures were not included in the available UI texture export. `thumbnail` is null until a true posed preview is generated.

The seven two-axis control pads preserve actual UI pairings (face width/height, jaw width/height, chin width/length, eye spacing/height, mouth width/thickness, ear projection/height, mouth corner width/height). They address the existing recovered bone controls directly.

Validation: extractor rejects unresolved source texture selections, standalone TypeScript compilation passes, and catalog references/ranges are checked against copied files. Browser visual checks remain necessary for reconstructed UV placement across every head.
