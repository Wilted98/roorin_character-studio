# Character customization data

The browser uses actual exported roorin face pose deltas, original face/body slider limits and source face preset values. This is a reconstruction of a supported subset, not a claim of complete native-game parity.

## Generated artifacts

- `public/assets/customization.json`: 56 face controls, 13 approximate body controls, 184 named additive poses and 12 face-value presets per gender. About 1 MB before HTTP compression.
- `tools/extract_customization.py`: reproducible extraction from Properties JSON. It only reads the game export directory; accepts `--source` and `--output`.
- `lib/customization.ts`: typed three.js runtime helper with neutral-pose caching, reversible slider updates and clamped ranges.
- `tools/test_customization.mjs`: checks actual exported GLB skeletons for non-no-op controls, finite endpoints, stable repeated application and exact neutral reset.

## Source evidence

`UnrealData/FaceCustomizeParamToWeightCurveData` maps slider values onto named positive and negative pose curves. `PcCustomizeFeatureTable_Bone` defines gender-specific minimum, neutral and maximum values, plus slider direction. `CustomizingUIListTable` supplies the overall original UI schema, but unsupported controls are not exposed as dummy controls in this subset.

Each source PoseAsset has 184 poses and 170 tracks. `LocalSpacePose` is **sparse**, so bone mapping uses `TrackPoseInfluenceIndices[track].Influences` with its `PoseIndex` and `BoneTransformIndex`. The extractor asserts every transform record has exactly one source bone mapping. It preserves translation, quaternion and additive scale offsets and validates every supported binding points to an existing pose.

`LipCorner_Depth` is excluded: its negative binding references `C_LipCorner_Bwd`, which is absent from both exported PoseAssets. The available forward pose is not silently inverted to fabricate the missing source data.

## Transform convention

The assets are imported from UEFormat version 10 with `reorient_bones=false`, scale factor 0.01. Their GLB bone-local transforms were compared directly to Blender local rest transforms in `tools/asset-bone-rest.json`: they match. Blender's glTF exporter applies its Y-up conversion above the individual bone nodes, so applying an additional Y-up change to every pose delta would be wrong.

For **local additive pose deltas** the runtime uses:

- Translation: Unreal `[x,y,z]` centimetres becomes `[x,-y,z] * 0.01` metres.
- Quaternion: Unreal `[x,y,z,w]` becomes `[-x,y,-z,w]` (equivalent to the importer's `[x,-y,z,-w]`).
- Scale: incoming source values are offsets around zero, so multiply the neutral scale by `1 + weightedOffset`.
- Rotation: weighted delta is pre-multiplied onto the neutral local quaternion, then normalized.

This follows Unreal's documented additive transform convention: translation adds, rotation multiplies on the left, and scale multiplies by one plus its delta. See [Epic's AccumulateWithAdditiveScale reference](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Core/TTransform/AccumulateWithAdditiveScale). Quaternion interpolation uses normalized slerp; exact multi-pose curve processing and native face graph order have not been fully reproduced.

Face values in source preset tables are already mapped curve-weight values. Initialization table integers are a different normalized input representation; they must not be mixed with raw pose weights. Source presets are therefore presented as **face parameter values only**: their original head mesh, hair, makeup and body preset may differ from the current assembled character. `sourceHead` metadata is preserved for future full-preset reconstruction.

## Body controls and accuracy

Body rigs contain native `BodyCstmRawData`, `BodyCstmBoneData` and `BodyCstmModifyBoneValues` structures. Their range/default values and anatomical bone names are available, but complete native calculations are not present as portable JavaScript. Every exposed body control is marked `approximate: true`.

The initial web implementation scales actual skeletal bones relative to their neutral transform:

- Height scales each modular skeleton's Root uniformly.
- Head/hand size and quadriceps fullness scale the corresponding named bones uniformly.
- Neck/arm/leg length scales a bone along the dominant local child-offset axis.
- Neck/arm/foot width scales the transverse axes.

These produce visible, reversible deformations using the real skin weights. Native compensating scales, pelvis/foot grounding, collision, clothing correction, nonlinear BMI behavior and some downstream scaling compensation are not reconstructed. They should be described as prototype proportion controls, not exact replicas of all roorin body sliders.

## Usage

```ts
const controls = getControls(data, gender);
const values = getDefaultValues(data, gender);
applyCustomization([bodyScene, headScene, hairScene], data, gender, values);
```

Pass every modular root so common bones update together. Values are reset from cached neutral transforms on each call; repeated calls do not accumulate drift. Do not modify the neutral skeleton in place after it has been cached. Call `forgetCustomizationRest(root)` only when intentionally rebinding a model.

## Remaining validation

The numerical/skeleton tests do not establish visual equivalence to the native game. Rendered endpoint checks, head/body seams on all variants, extreme combinations, native additive base-pose choice and clothing correction remain the next comparison targets.
