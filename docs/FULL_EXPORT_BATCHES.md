# roorin — full creator export batches

Prepared 2026-11-09 after inspecting https://aion2.gg/tools/character-creator and auditing local exported resource tables. This supersedes the earlier incremental export checklist.

## Scope and evidence

The reference has Preset, Face, Hair, Style, Body Shape, Closet and Dye. Its closet exposes Helm, Pauldrons, Top, Legs, Gloves, Shoes, Cloak, Earrings, Necklace, Weapons and Wings. Motion includes idle, nine character-select poses, seven equipment poses and a long emote list. Equipment dye has independent areas. Scene supports indoor/natural/colored light, position, backgrounds and transparency. PNG look restoration, links, history, search/filter and color favorites are application features.

Local GF armor has 2,224 models and 12 PNGs; GM armor has 2,378 models and 20 PNGs. These counts do not prove every model is complete, but show the major texture gap. Facial animation properties exist, including Blink, Normal and Smile; animation tracks still need export. Four body idle clips, native customization tables/icons, hair atlases and two lighting environments are already available. Fourteen referenced hair physics curves were unavailable in the current derived dataset.

The following is a broad export plan for complete source branches, not just a first test set. Some existing files will repeat. Export all subfolders, preserve source paths/names, and keep one game build together. A branch's export is not guaranteed to include dependencies stored elsewhere; that is why shared folders are explicitly included.

## Common settings

- Models: UEFormat (.uemodel), Highest Quality Only, Export Morph Targets ON, Auto-Export Attached Materials ON. Existing ZStandard compression is suitable. Keep skeleton/skin weights; no geometry-only conversion.
- Animations: UEFormat (.ueanim). Preserve pose assets as .uepose when supported; Properties and Raw Data preserve a fallback when pose export is unavailable.
- Textures: PNG, Export All Mips OFF, Save HDR as .hdr ON. Preserve full-resolution source exports; optimization belongs in our local conversion pipeline.
- Properties: .json. Export entire folders so skeletal meshes, material instances, physics assets, clothing data, curves, equipment settings, skeletons, animation lists and Blueprint properties are included when FModel decodes them.
- Raw Data: preserve original .uasset/.umap and any companion files FModel emits. These are source backups/reference inputs, not browser-ready files.
- Embedded Files: use where requested to retain embedded data that ordinary Models/Textures exports do not cover. No animations in a folder containing no animation assets is not itself an error.
- If FModel offers parent-material traversal, include parents. The shared Material batch below is still required.
- Save locally under a single export root, for example Desktop/RoorinExports. Do not rename internal game paths to roorin; only the app branding is renamed. Never mix an unrelated .usmap with a client build.

## Batch 1 — entire player asset library

Folder: `Character/Player`

Run these six exports on the entire folder:

1. Models
2. Textures
3. Properties (.json)
4. Animations
5. Raw Data
6. Embedded Files

This includes both GF and GM: all Armor sets and variants, ACC accessories, Basebody, Head, Hair, Beard and Ani. Also includes the shared Common, Customize, BP, HeadWear, ShoulderWear, Weapon and Wing branches that exist in the client. Do not select only GF/GM Armor and omit these shared branches. BP contains the missing hair curves. Include root-level assets too, not just child folders.

The full Ani export includes FACE/face, Normal, Common, Lobby, Equipment, SocialAction, class motions and other available branches. The current GF property inventory confirms Lobby, Equipment and SocialAction. This avoids repeated requests for individual emotes. Animations nested in Wing, Weapon or accessories are also covered by exporting Animations at the Player root.

## Batch 2 — shared accessory and collaboration assets

Run the same six exports as Batch 1 for:

- `Character/ETC/Enchant`
- `Character/ETC/Mannequin`
- `CLB/CLB01/Character/Player`
- `CLB/CLB01/Character/ETC`
- `CLB/CLB02/Character/Player`

These paths are directly referenced by the local wardrobe resource tables. The Enchant branch includes accessory meshes; its name does not mean it can be skipped as particle effects. Collaboration branches may be absent or not mounted in a different client. Export the listed branches if present; report missing ones rather than substituting unrelated folders. If your mounted client has additional CLB packages, include their Character/Player and Character/ETC branches as the same batch.

The tables also contain NPC and developer/test rows. Do not export all NPCs, monsters or developer folders merely because an unused resource row mentions them. The audit is recorded in outputs/wardrobe-dependency-audit.json and is a direct-reference inventory, not proof of complete transitive dependency coverage.

## Batch 3 — shared materials and shader inputs

Folder: `Material` (entire folder)

Export Textures, Properties (.json), Raw Data and Embedded Files. This intentionally includes more than Material/Chr/MM/Armor: parent materials, material functions, parameter collections and shared texture branches can live elsewhere under Material.

This supports hair cards/scalp, eyes/skin, makeup masks, packed texture channels, armor dye areas, cloth/metal roughness, opacity and emissive parameters. Retaining raw cooked assets does not recover the original editable shader source automatically or reproduce its rendering in Three.js.

## Batch 4 — character logic, curves and physics descriptions

Folder: `System/Animation`

Export Properties (.json), Raw Data, Animations and Embedded Files. Run Decompiled Blueprints as an additional export only if this FModel build supports it successfully; it is not a substitute for Properties/Raw Data.

Direct references confirm these shared assets under System/Animation/AnimBPs:

- ABP_PC_Base_BP
- ABP_Weapon_Base_BP
- ABP_Wing_Base_BP
- ABP_ShoulderAcc_Squirrel_BP

Player BP/ABP/physics/clothing assets are already included in Batch 1. No separate export of all game System assets is requested.

## Batch 5 — customization, wardrobe, item and localization data

- `UnrealData`: Properties (.json), Raw Data and Embedded Files, recursively.
- `Data`: Properties (.json), Raw Data and Embedded Files, if present as in the supplied FModel tree. This is a conservative coverage batch; exact contents have not been inspected locally.
- `L10N`: Embedded Files and Raw Data, recursively; retain .locres/.locmeta or other localized files emitted by FModel. This folder was shown in the supplied tree; its exact language layout is not verified. Include English when available. If the client uses a separate Localization branch, export that branch the same way.

The full UnrealData batch includes native presets/ranges, material options, armor/accessory/weapon/wing resources, hair replacement and equipment part settings, icon mappings, dye palette, camera/environment presets, and item/set metadata present there. Localized display names may require the separate data/localization exports. Models do not contain reliable human-readable closet names or rarity/set filters by themselves.

## Batch 6 — icons, thumbnails and UI resources

Folder: `UI/Resource`

Export Textures, Properties (.json) and Embedded Files, recursively.

Confirmed referenced texture branches include Texture/Customizing and Texture/Item/Armor, Weapon, Accessory, Wing and ETC. The broader resource folder covers sprite/atlas metadata and UI symbols too, so individual icon folders do not need to be guessed. Native customizing thumbnails already exist locally; this comprehensive pass fills wardrobe icons and any missing UI resources.

## Batch 7 — creator lighting, preview scenes and color grading

- `UI/Map`: Properties (.json) and Raw Data for the folder. This includes Preview_CreateChar and Preview_Customizing and other preview maps when present. No full world export is requested.
- `BG/Common/TextureCube`: Textures with HDR enabled, plus Properties (.json).
- `BG/Common/LUT`: Textures and Properties (.json).

UnrealData/Environment and UnrealData/PreviewSceneCameraPreset are already included in Batch 5. Existing source references include 02_HDR_12288x6144, approaching_storm_4k, FilmColor/EndGame and Base/ExposureL. We already have two HDR environments; this batch collects the shared environment branch and map definitions together. Lighting equivalence still requires local tone mapping/shader calibration.

## Optional Batch 8 — particle effects beyond basic creator parity

If the goal includes animated weapon auras, wing particles or other equipment VFX, export `FX` as Models, Textures, Properties (.json), Raw Data and Embedded Files. This is intentionally broad and can be large; it contains combat/world effects that the creator does not need. It is NOT required to repair hair textures or normal armor dye. A narrower VFX list requires resolving the newly exported equipment/Blueprint references first. No supported browser particle implementation is implied by obtaining these files.

Audio, whole world maps, quests, monsters and NPC libraries are not required for the observed silent character-creator features. If emote voices or UI sound are later desired, they form a separate audio scope.

## Hair curves included in Batch 1

Character/Player/BP:

HairDampingCurve_01, HairWdLocationCurve_01, HairStiffnessCurve_01, HairStiffnessCurve_02, HairRadiusCurve_01 through HairRadiusCurve_05, HairLimtAngleCurve_01, HairLimtAngleCurve_02, HairWindRateCurve_Short_01, HairWindRateCurve_Long_01, WindRateCurve.

The spelling Limt is intentional. Current hair textures are already present; the comprehensive batch is to include every variant and source dependency, not because repeating those texture exports will fix shading.

## After export

Keep FModel's export logs, especially failures and unmapped-property warnings, next to the export root. Counts alone do not guarantee success. I will index exported files, resolve references, flag unavailable client assets, then convert and integrate locally. This plan cannot guarantee that cooked files decode successfully or that dynamically selected dependencies are visible before the new metadata is inspected.

The reference currently reports EU/NA client 2.0.10.0, Steam build 26429009, extracted November 5, 2026. The mapping filename supplied earlier contains 1.0.52.0; that alone does not establish the currently loaded client version. Use mappings matching the actual installed build. Different regional/version data can change available cosmetics, IDs and presets.

Export completion is separate from app completion. Hair/skin/eye shading, makeup placement, armor assembly and skin hiding, dye masks, animation retargeting/blending, physics and cloth still require code. Copyable values, searchable closet, undo/redo, saved color palettes, PNG look metadata, local import/export and camera behavior require no additional game exports.
