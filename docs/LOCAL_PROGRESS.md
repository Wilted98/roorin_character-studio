# roorin — local progress

Updated 2026-11-09. Work is local only. No upload or deployment was performed for this revision.

## Open

Project: `C:\Users\MyPc\Documents\ChatGPT\BlenderAion\roorin`

Run `Start Studio.cmd` and open http://127.0.0.1:5173/. The project folder, application branding, metadata, package name and new browser storage keys use roorin. Original export directories, historical logs and Git history retain their original provenance. Original exports and the user's open Blender scene were not changed.

## Implemented

- Removed faction buttons and unused faction state.
- Full native presets apply head, hair, face/body controls, colors and native appearance fields together. There are 90 main presets using original thumbnails. Face Shape selects the original head and clears previous face deformation offsets.
- Expanded Face, Hair, Style and Body menus from the supplied reference. Includes paired controls, eye asymmetry, native makeup choices, tattoos, scars, stubble and 24 converted beard meshes.
- Skin palette opens/closes and contains 100 source colors. Separate face/body gloss is available.
- Hair two-tone color, area, contrast and gloss; native body vein/muscle textures; localized makeup gloss and reflection.
- Full/Upper/Face views fit posed mesh bounds and viewport aspect ratio. Explicit camera switches apply immediately.
- Indoor, natural and colored lighting with a two-axis position control. Background selection is separate from lighting.
- Native creator/normal idle clips, pause and browser hair spring simulation remain available.
- Undo/redo, saved looks, local drafts and JSON import/export remain available. New branding uses new storage keys; older browser data has not been deleted.

## Validation

TypeScript, editor schema/import validation, native preset assets, customization, deformation and motion checks pass. Deformation checks confirm that 95 skeletal controls per gender affect weighted mesh vertices. Camera tests cover four aspect ratios and all three framing modes. All 90 native presets retain their exported material fields; 115 unique preset model files validate. Appearance extraction reports no missing layer textures.

## Remaining accuracy work

- Hair files are present. No additional hair export is currently required. Card transparency and atlas mapping are connected, but strand shading/scattering still differs from the source renderer and can look noisy.
- Native preset values and meshes are applied, but this does not imply identical rendering. Skin, eye and makeup shading, layer placement, body constraints and spring behavior are browser approximations.
- Body tattoo placement and material detail blending need further visual calibration. Some source control ranges do not reproduce the original engine response exactly.
- Backward lip-corner depth uses an explicit inverse-forward pose approximation because the corresponding backward pose is absent from the exports.
- Hair springs are implemented; cloth simulation and the full wardrobe are not.
- Six alternate preset records are preserved separately, outside the 90 main selectable presets.

## Export guidance

Do not re-export all hair textures or models. The current source atlas, opacity/strand channels and hairstyle meshes are available. Future exports should be requested only for a specific missing animation, outfit, pose or dependency identified by filename. Additional textures alone will not reproduce the original engine's hair shader.

## Checks to rerun after renderer changes

`npx tsc --noEmit`

`node tools/test_editor.mjs`

`node tools/test_customization.mjs`

`node tools/test_deformation.mjs`

`node tools/test_native_presets.mjs`

`node tools/test_motion.mjs`

`npm run build`
