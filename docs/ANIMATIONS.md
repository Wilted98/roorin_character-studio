# Native idle animation assets

`tools/convert_idle_animations.py` imports exported UEFormat assets in an isolated
Blender process. It samples the evaluated pose matrices using the same skeleton
import settings as the existing character meshes (`reorient_bones=False`).
Original exports and the user's open Blender scene are untouched.

## Available clips

- `/assets/animations/gf-creator-idle.json`: `GF_Customize_Idle`, approximately 14 seconds.
- `/assets/animations/gm-creator-idle.json`: `GM_Customize_Idle`, approximately 14 seconds.
- `/assets/animations/gf-normal-idle.json`: `GF_Normal_Idle`, approximately 21 seconds.
- `/assets/animations/gm-normal-idle.json`: `GM_Normal_Idle`, approximately 20 seconds.

Use **creator** as the character editor's default motion. These are native game
animations, not authored substitute poses. The normal clips offer a second motion.
These body animations do not supply the missing facial blink/eye-expression system.

## Runtime integration

Each file contains `{version, gender, name, fps, frames, duration, loop, tracks}`.
Tracks identify bones by their original name (use `sourceBoneName ?? name`). Each
optional channel has `{times: number[], values: number[]}` with flattened values:

- `t`: XYZ translation delta in metres, interpolated linearly.
- `q`: XYZW unit quaternion delta, interpolated with quaternion slerp.
- `s`: XYZ scale multiplier, interpolated linearly.

For each animation frame, restore the customized pose, then apply the sampled
channels to **every matching bone across the body, head, and hair modules**:

```ts
bone.position.add(translationDelta);
bone.quaternion.premultiply(rotationDelta).normalize();
bone.scale.multiply(scaleMultiplier);
```

Missing channels mean identity: `[0,0,0]`, `[0,0,0,1]`, or `[1,1,1]`. Single-key
channels remain constant for the entire clip. Loop time with `time % duration`.
The deltas already use the GLB's local axes; do not mirror Y or apply another
Y-up conversion. The converter also handles glTF's conversion on root bones.

Avoid compounding transforms each frame. Either call `applyCustomization` before
animation application or cache the resulting customized local TRS and restore it
before sampling. Rebuild that cache when customization, gender, or modules change.
Do not apply the old authored relaxed-shoulder pose at the same time as an idle.
Pause should freeze time while continuing to restore and evaluate the frozen pose.

## Validation and limits

`tools/idle-animation-validation.json` records source/matched tracks, frame counts,
nonconstant channels, key-reduction tolerance, and matrix reconstruction errors.
All four clips reconstruct sampled Blender local matrices with maximum component
error below 0.000002 before key reduction. Position reduction error is at most
0.00001 metres per component; quaternion reduction uses a 0.00002 component bound.

Unmatched source tracks are omitted because these character modules have no
corresponding bone. Both body and head skeletons were inspected; these idle clips
did not add matching facial tracks beyond the body skeleton. Shared head/body
reference matrices differ slightly (maximum component differences approximately
0.0011 female and 0.0016 male); shared animation uses the body reference.
Hair/cloth physics and facial-expression playback are separate runtime work.
