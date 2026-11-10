# roorin — next exports

Paths below are relative to the game's Content folder in FModel. Preserve original folder and asset names in exports so references continue to resolve. App branding is separate from source filenames. Keep everything local.

## 1. Armor

Female armor: Character/Player/GF/Armor

Male armor: Character/Player/GM/Armor

Choose the numbered sets you want; start with two or three complete sets. Existing female export already contains 2,224 .uemodel files but only 12 PNG textures. Do not bulk-export all models again.

For each selected set's whole folder:

- Export Folder > Textures: PNG, Export All Mips disabled.
- Export Folder > Properties (.json): export all objects, including mesh, material instance, physics and Blueprint properties present in the folder.
- Export Folder > Models only if its models are missing: UEFormat (.uemodel), Highest Quality Only, Export Morph Targets enabled, Auto-Export Attached Materials enabled, ZStandard compression is fine.
- Include every piece in the set, such as Body, Pants, Boots, Glove, Shoulder, Cape and headgear where present.

Also export Properties (.json) from Material/Chr/MM/Armor, an existing referenced shared material branch. If a chosen material references textures outside the set folder, export those referenced textures as PNG too. Per-folder texture export does not guarantee that all external dependencies are included.

Include set 0103 to repair the currently selectable armor: dedicated material properties and texture dependencies are needed to replace provisional atlas assignments. The exporter must not infer dedicated textures from part names alone.

If selected pieces include cloth/physics assets, retain their Properties and Raw Data as well. Those files are reference inputs; cloth simulation still requires a browser implementation.

## 2. Hair physics curves

From Character/Player/BP, export Properties (.json) for these exact referenced assets:

- HairDampingCurve_01
- HairWdLocationCurve_01
- HairStiffnessCurve_01
- HairStiffnessCurve_02
- HairRadiusCurve_01
- HairRadiusCurve_02
- HairRadiusCurve_03
- HairRadiusCurve_04
- HairRadiusCurve_05
- HairLimtAngleCurve_01
- HairLimtAngleCurve_02
- HairWindRateCurve_Short_01
- HairWindRateCurve_Long_01
- WindRateCurve

The spelling Limt is intentional. Exporting Properties for the whole BP folder is an alternative. If curve key data does not decode into JSON, retain Raw Data for those curve assets and report the export warning.

Hair meshes, opacity/strand atlases and material properties are already available. No repeat hair Models/Textures export is currently requested. Hair scattering/transparency fidelity needs renderer work.

## 3. Facial motion

- Character/Player/GF/Ani/FACE
- Character/Player/GM/Ani/face

Export Folder > Animations with UEFormat (.ueanim). Their JSON properties already exist; the decoded animation tracks are needed. Female properties confirm GF_Blink_01, GF_Normal and GF_Smile_01.

The four body creator/normal idle clips are already converted. Do not repeat them. More gestures are optional: export chosen animation clips as .ueanim and their Properties (.json).

## Already available

Native face/style/body preset tables and thumbnails, hair textures, body idle animations, and lighting source data are present. No blanket re-export of these is requested. More source files alone cannot guarantee full visual parity: skin/eye shaders, makeup placement, dye-mask interpretation, equipment hiding and cloth behavior require implementation and verification.
