# Browser character assets

Generated from the user's local exported roorin assets using the installed UEFormat importer in a separate background Blender process. The interactive Blender scene and source files were not modified.

## Runtime contract

- `public/assets/characters.json` lists two body types, four heads, twelve hairstyles, and two outfit options per body type.
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

## Expanded library (November 2026)

`expand_characters.py` preserves the original GLBs and extends the manifest with eight additional native hairstyles per body type: 101, 201, 205, 301, 305, 311, 401, 412. Selection spans short, shoulder-length, updo and long silhouettes. It also builds `gf-outfit-0103.glb` and `gm-outfit-0103.glb` from the original Body, Pants, Boots, Glove, Shoulder and Cape meshes. Native exposed skin is retained from the armor Body/Pants sections, with no duplicate base-body surface. Helmet is intentionally omitted so head/hair customization stays visible. The resulting eighteen additional GLBs occupy 58.17 MiB combined; each is under 9 MiB.

Only armor0103 has corresponding texture exports. Its exported material properties are missing. Direct diffuse/normal maps are used where present; GF gloves/cape and GM shoulders provisionally share the Body atlas. Native dye/shader behavior is not reconstructed. The armor is visibly different from the tailored base through shoulder plates, gloves, boots and cape; both share the0103 tunic/pants foundation. This is not a second independent armor family.

`render_expansion.py` reloads the new GLBs and renders real hairstyle/outfit thumbnails. It also writes `public/assets/relaxed-pose.json`: an authored static presentation pose, not a game animation. For each gender and named UpperArm bone, premultiply the stored quaternion onto the native local rest quaternion **after** the customization helper resets/applies its values. The pose is verified with relaxed, torso-clearing arms in both body types. Preserve matching transformations on all modules.

`verify_ear_shape.py` confirms the actual `EarShapeChange` morph changes rounded ears (0) to elongated pointed ears (1). Evidence images and vertex-change report live in tools. This does not establish the game's faction mapping; expose anatomy independently unless source faction mapping is confirmed.

`render_face_presets.py` renders 24 distinct face-shape previews from the real preset values and native PoseAsset deltas on head001. It uses the same clamping, positive/negative pose selection, reflected translation/quaternion and additive scale arithmetic as the browser helper. Images link through appearance.json. These previews show face-shape values only, not the source preset's unconverted head, hair or makeup. The native head is imported directly with bone reorientation disabled to retain the confirmed local coordinate contract.

The expanded GLBs were all reloaded successfully by Blender and rendered; structural checks are recorded in `expansion-validation.json`. The open interactive Blender scene remains untouched.
