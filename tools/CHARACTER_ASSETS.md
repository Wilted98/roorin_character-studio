# Browser character assets

Generated from the user's local exported AION2 assets using the installed UEFormat importer in a separate background Blender process. The interactive Blender scene and source files were not modified.

## Runtime contract

- `public/assets/characters.json` lists the two body types and four heads/four hairstyles per body type.
- Each model is an independent self-contained GLB with embedded textures and a skinned skeleton. Load body + selected head + selected hair at the same origin. Body contains BaseFull plus boots, rebound to the same body armature.
- Metres, glTF Y-up, face toward **+Z**. `CharacterOrientation` has identity transform; no additional rotation required.
- Native bone names are retained. Synchronize relevant transforms across independent skeletons by name. Sockets were omitted. Max four normalized skin weights per vertex are exported for browser compatibility.
- Native morph names are retained on head meshes. The catalog lists available morph targets.
- glTF material extras include `role` (`skin`, `clothing`, `hair`, `eyes`, `lashes`, `tear`), `nativeName` and `sourceMaterial`. Mesh extras include `part`, `gender`, `variant`.
- Material color multipliers may tint skin/hair/clothing. Eye material color multiplies sclera as well as iris, so selective iris tint requires a shader mask rather than uniform tint.
- Thumbnails are actual Blender renders of the reimported GLBs. Hair thumbnails use head001; head thumbnails use hair001.

## Material treatment and limits

Texture references resolve through exported Unreal material Parent chains. Skin and clothing use source diffuse and normal maps, with DirectX normal green converted to OpenGL. Source images are resized to at most 1024 pixels on the longest edge.

Unreal hair DIRO is repacked into a dark brown strand texture with its alpha channel as opacity. Hair is double-sided MASK with alpha cutoff 0.08 and roughness 0.65. Native scalp/strand shading, anisotropy, multilayer root/tip coloring and physics are approximated.

Eye material is a browser PBR approximation: original iris-mask detail is remapped to the eye sphere's projected UV region, with pupil/sclera. Original refraction, parallax, colored layers and eye reflection shader are not reproduced. Lashes use the native green lash mask; tear strips use faint translucency. Brows, layered makeup and skin microdetails are not fully reconstructed.

The base outfit is the actual BaseFull clothing geometry and decoded source diffuse where available. This is not a full wardrobe conversion. Skin looks can differ from in-game renderer due to lighting/subsurface differences.

## Rebuild and verification

`convert_characters.py` owns all model exports and the initial manifest. `render_character_previews.py` reimports all exports, renders thumbnails, and updates the manifest with thumbnail URLs and bounds. Re-run rendering after conversion because conversion rewrites the manifest.

`asset-bone-rest.json` records Blender local rest matrices and exported glTF node transforms to verify native customization pose coordinate conversion. `material-conversion.json` records per-material source chains and images. `glb-validation.json` records GLB sizes, hashes and structural checks. Full-body QA renders are `gf-full-preview.png` and `gm-full-preview.png`.

All 18 exported GLBs were reloaded for thumbnail rendering. They pass GLB header/declared-size checks, include skins and meshes, contain embedded images, and remain below 25 MiB each.
