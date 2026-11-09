# AION Character Studio

A working browser prototype using the supplied AION2 exports. Built with React, TypeScript, Three.js and Vinext. Original exports and the interactive Blender scene remain unchanged; asset conversion runs in a separate background process.

## Run locally

Requires Node 22.13+ and Git. From this directory:

```sh
npm ci
npm run dev
```

Open the printed localhost URL. Check TypeScript with `npx tsc --noEmit` and pose behavior with `node tools/test_customization.mjs`. Build with `npm run build` (Sites publishing uses the installed Sites build helper).

## Included

- GF/GM complete fitted base outfits, four starting heads and four hairstyles each, plus no-hair option.
- 56 face controls per body type using decoded source pose deltas; 13 explicitly approximate body controls.
- Skin, hair and eye colors; orbit, zoom, portrait/full-body cameras, turntable and PNG capture.
- Undo, randomize, per-slider reset and complete reset.
- Browser-local draft and saved looks, validated JSON preset import/export.
- Responsive desktop and mobile layout.

The initial assets total about 82 MiB, but the viewer loads only the selected body, head and hair. Switching variants reloads those modules. A WebGL-capable browser is required.

## Current limits

This is an independent prototype, not a complete recreation of the official editor. Original Unreal shaders, facial shading, eyebrows, makeup, wardrobe and animation have not been fully reconstructed. Eye/hair materials and body scaling are approximations. 12 decoded source face presets per gender are retained in the data for later integration. One missing lip-corner source pose is deliberately excluded. Exported JSON is specific to this web app and cannot be imported into AION2.

Local saved looks belong to the current browser/origin; use JSON download to transfer them. No account sync or server storage is used.

## Asset pipeline and evidence

- `tools/CHARACTER_ASSETS.md`: modular model conversion and material decisions.
- `docs/CUSTOMIZATION.md`: source mapping, pose math and unsupported controls.
- `tools/convert_characters.py`, `tools/render_character_previews.py`: offline Blender conversion; local paths are configuration in these scripts.
- `tools/extract_customization.py`: offline extraction from decoded Properties JSON.
- `tools/glb-validation.json`, `tools/material-conversion.json`, `tools/asset-bone-rest.json`: verification artifacts.
- `tools/test_customization.mjs`: checks actual GF/GM GLB bones, all supported controls at endpoints, repeated application, neutral reset and preset values.

## Next milestones

1. Reconstruct eyebrow and layered makeup masks and original material parameter behavior.
2. Match the remaining body rig constraints and face preset semantics to game references.
3. Expand the appearance library and optimize delivery with shared textures/model caching.
4. Add creator idle animation when a usable animation export is available.


## Reference-driven editor update (2026-11-09)

The interface now follows the supplied screenshots: large left preview, top category tabs, face subsection rail, -100 to100 numeric controls and two-axis position pads. Source-neutral values display0 even when native bounds are asymmetric; reversed sliders preserve their source direction.

New working features:
- 12 hairstyles per gender,12 source face-proportion presets per gender with real pose thumbnails.
- Native standard/pointed ear morph and an authored relaxed standing pose.
- Five iris shapes,20 pupil shapes,11 female/12 male brow choices,10 lash choices,100 source skin colors; separate iris center/border/sclera colors and size controls.
- Two complete outfit options per gender (base and adapted0103 armor), with whole-outfit dye.
- Undo/redo, local saved looks, validated legacy preset migration, version2 JSON import/export and URL-fragment look sharing. Share links retain the site's existing private access.

Rendering limitations remain: no native physics or idle animation; faction is stored as a preference but no verified race mapping has been applied; body proportions and layered eye/brow materials are approximated. Armor0103 uses available source textures, with provisional atlas mapping for missing material properties. Most other exported armor lacks textures and is not offered. Makeup and individual accessory/equipment slots are unfinished. Face preset thumbnails show proportions on head001 without original source makeup; applying presets uses available heads and supported source appearance fields.

Additional checks: `node tools/test_editor.mjs` verifies range conversion, paired controls, migration, clamping, round-trip preservation and all appearance/model/thumbnail links. `tools/create_appearance_previews.py` (Pillow) produces readable previews from the packed texture channels. See `docs/APPEARANCE.md` for material reconstruction details.

Conversion-only PNG caches are retained under `tools/conversion-textures` and excluded from deployment. Runtime textures are embedded in GLBs or referenced explicitly by appearance.json.
