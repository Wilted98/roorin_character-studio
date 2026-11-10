# roorin

Local browser character studio using the supplied character exports. React, TypeScript and Three.js. Original exports and the open Blender scene are untouched.

## Open locally

Double-click **Start Studio.cmd**, then open **http://127.0.0.1:5173/**. Alternatively run `npm run dev -- --hostname 127.0.0.1` here. Nothing is uploaded or deployed by this workflow.

## Current editor

- Original face, style and body preset thumbnails; 90 full character presets.
- 55 heads, 79 hairstyles, 24 beard meshes and two complete outfit choices per gender.
- Face, ears, eyes, eyebrows, lashes, iris/pupil/sclera, nose and mouth controls.
- Collapsible 100-color skin palette and separate face/body gloss.
- Layered contour, highlight, blush, eye makeup, lips, freckles, moles, tattoos, scars and stubble, using exported masks.
- Body/head, arms, torso and lower-body sections; native body presets, vein and muscle detail textures.
- Hair two-tone dye, area, contrast and gloss; separate outfit dye.
- Full/Upper/Face cameras fit the posed meshes and viewport aspect ratio.
- Indoor/natural/colored lighting, two-axis light position and backgrounds.
- Native creator/normal idle clips, pause and browser hair spring simulation.
- Undo/redo, local drafts, saved looks, JSON import/export and local look links.

## Accuracy limits

This remains a browser reconstruction. Shader placement, skin shading, hair scattering, body constraints and hair springs are approximations of the original engine. Cloth physics is not implemented. The missing backward lip-corner pose is approximated by inverting the exported forward pose. No additional hair texture export is currently required; remaining hair differences require renderer work.

Presets restore available native mesh, bone, color, makeup, eye, hair and beard settings together. Face Shape selects an original head and resets previous face-bone offsets. Makeup presets change style layers, preserving face shape and eyes.

## Validation and pipeline

`npx tsc --noEmit`, `node tools/test_editor.mjs`, `node tools/test_customization.mjs`, `node tools/test_native_presets.mjs`, `node tools/test_motion.mjs`, and `npm run build` run locally.

Extraction tools discover existing Desktop export folders by their contents. Override with `ROORIN_ASSETS` or `ROORIN_PROPERTIES` when needed. `tools/expand_editor_data.py` rebuilds native appearance choices; `tools/convert_beards.py` runs in isolated background Blender.

See `docs/LOCAL_PROGRESS.md` for the latest work and remaining accuracy gaps. Saved looks are browser/origin specific; download JSON for a portable copy.
