"""Bake the exported native idle clips to glTF-local additive TRS channels.

Run with isolated Blender --background --factory-startup --python this_file.
No .blend file or source asset is written. Generated JSON is compatible with the
existing reorient_bones=False character GLBs, including glTF's root Y-up change.
"""
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('AION_ASSETS', str(Path.home() / 'Desktop/AionModels/Aion2/Content')))
OUTPUT = PROJECT / 'public/assets/animations'
sys.path.insert(0, str(Path.home() / 'AppData/Roaming/Blender Foundation/Blender/5.2/extensions/user_default'))
from io_scene_ueformat.importer.import_context import UEFormatImport
from io_scene_ueformat.options import UEAnimOptions, UEModelOptions

OUTPUT.mkdir(parents=True, exist_ok=True)
ROOT_CHANGE = Matrix.Rotation(-math.pi / 2, 4, 'X')
report = {}


def local_matrix(bone):
    return bone.parent.matrix.inverted() @ bone.matrix if bone.parent else ROOT_CHANGE @ bone.matrix


def rest_matrix(bone):
    return bone.parent.matrix_local.inverted() @ bone.matrix_local if bone.parent else ROOT_CHANGE @ bone.matrix_local


def compact_channel(samples, identity, fps, tolerance):
    if all(max(abs(v - identity[i]) for i, v in enumerate(row)) < tolerance for row in samples):
        return None
    constant = all(max(abs(a-b) for a, b in zip(row, samples[0])) < tolerance for row in samples)
    if constant:
        selected = [0]
    else:
        # Error-bounded key reduction. Reconstruct using the same lerp/slerp as Three.
        selected = {0, len(samples)-1}
        pending = [(0, len(samples)-1)]
        quaternion = len(identity) == 4
        while pending:
            first, last = pending.pop()
            if last-first < 2:
                continue
            qa = Quaternion((samples[first][3], *samples[first][:3])) if quaternion else None
            qb = Quaternion((samples[last][3], *samples[last][:3])) if quaternion else None
            maximum, chosen = 0.0, None
            for i in range(first+1, last):
                weight = (i-first)/(last-first)
                if quaternion:
                    q = qa.slerp(qb, weight)
                    predicted = [q.x, q.y, q.z, q.w]
                else:
                    predicted = [a+(b-a)*weight for a,b in zip(samples[first], samples[last])]
                error = max(abs(a-b) for a,b in zip(samples[i], predicted))
                if error > maximum:
                    maximum, chosen = error, i
            if maximum > tolerance:
                selected.add(chosen)
                pending.extend([(first, chosen), (chosen, last)])
        selected = sorted(selected)
    return {'times': [round(i / fps, 7) for i in selected],
            'values': [round(float(v), 7) for i in selected for v in samples[i]]}


def convert(gender, variant):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    native_name = f'{gender}_{"Customize" if variant == "creator" else "Normal"}_Idle'
    clip_path = SOURCE / f'Character/Player/{gender}/Ani/Normal/{native_name}.ueanim'
    samples = {}
    maximum_error = 0.0
    duplicate_rest_error = 0.0
    gltf_rest_error = 0.0
    previous_rest = {}
    source_tracks = set()
    for part, rel in [('body', f'Basebody/{gender}_BaseFull.uemodel'), ('head', f'Head/{gender}_Head_001/{gender}_Head_001.uemodel')]:
        mesh_path = SOURCE / f'Character/Player/{gender}' / rel
        armature, model = UEFormatImport(UEModelOptions(import_morph_targets=False, import_sockets=False, reorient_bones=False)).import_file_with_dto(mesh_path)
        rest = {bone.name: rest_matrix(bone).decompose() for bone in armature.data.bones}
        # Independently check local axes/rest against the actual browser GLB.
        glb_path = PROJECT / 'public/assets/models' / (f'{gender.lower()}-body.glb' if part == 'body' else f'{gender.lower()}-head-001.glb')
        raw = glb_path.read_bytes()
        gltf = json.loads(raw[20:20+struct.unpack_from('<I', raw, 12)[0]])
        for node in gltf['nodes']:
            if node.get('name') not in rest:
                continue
            rotation = node.get('rotation', [0, 0, 0, 1])
            matrix = Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])), Quaternion((rotation[3], *rotation[:3])), Vector(node.get('scale', [1, 1, 1])))
            expected = Matrix.LocRotScale(*rest[node['name']])
            gltf_rest_error = max(gltf_rest_error, max(abs(matrix[r][c]-expected[r][c]) for r in range(4) for c in range(4)))
        assert gltf_rest_error < 1e-5, ('Browser GLB local rest mismatch', gltf_rest_error)
        action, animation = UEFormatImport(UEAnimOptions(override_skeleton=armature, import_curves=False)).import_file_with_dto(clip_path)
        assert animation.metadata and int(animation.metadata.additive_anim_type) == 0, 'Expected a non-additive source idle'
        frames = animation.metadata.num_frames
        fps = animation.metadata.frames_per_second
        assert frames > 1 and fps > 0
        matched = {track.name.lower() for track in animation.tracks}
        source_tracks.update(matched)
        this_samples = {bone.name: {'t': [], 'q': [], 's': []} for bone in armature.pose.bones if bone.name.lower() in matched and bone.name not in samples}
        for name, value in rest.items():
            matrix = Matrix.LocRotScale(*value)
            if name in previous_rest:
                duplicate_rest_error = max(duplicate_rest_error, max(abs(matrix[r][c]-previous_rest[name][r][c]) for r in range(4) for c in range(4)))
            else:
                previous_rest[name] = matrix
        for frame in range(frames):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            for name, channels in this_samples.items():
                bone = armature.pose.bones[name]
                position, rotation, scale = local_matrix(bone).decompose()
                rt, rq, rs = rest[name]
                dp = position - rt
                dq = (rotation @ rq.inverted()).normalized()
                ds = Vector(tuple(scale[i] / rs[i] for i in range(3)))
                previous = channels['q']
                if previous:
                    last = previous[-1]
                    if dq.dot(Quaternion((last[3], last[0], last[1], last[2]))) < 0:
                        dq.negate()
                elif dq.w < 0:
                    dq.negate()
                channels['t'].append(list(dp))
                channels['q'].append([dq.x, dq.y, dq.z, dq.w])
                channels['s'].append(list(ds))
                reconstructed = Matrix.LocRotScale(rt + dp, dq @ rq, Vector(tuple(rs[i] * ds[i] for i in range(3))))
                expected = local_matrix(bone)
                maximum_error = max(maximum_error, max(abs(reconstructed[r][c]-expected[r][c]) for r in range(4) for c in range(4)))
        samples.update(this_samples)
    tracks = []
    dynamic = []
    for name, channels in samples.items():
        track = {'bone': name}
        for key, identity, tolerance in [('t', [0, 0, 0], 1e-5), ('q', [0, 0, 0, 1], 2e-5), ('s', [1, 1, 1], 1e-5)]:
            channel = compact_channel(channels[key], identity, fps, tolerance)
            if channel:
                track[key] = channel
                if len(channel['times']) > 1:
                    dynamic.append(name + ':' + key)
        if len(track) > 1:
            tracks.append(track)
    assert dynamic, 'Clip must have time-varying motion'
    assert maximum_error < 1e-4, ('TRS reconstruction error', maximum_error)
    output = {'version': 1, 'gender': gender, 'name': native_name,
              'source': str(clip_path.relative_to(SOURCE)).replace('\\', '/'),
              'coordinateSpace': 'Existing glTF bone local axes; metres; delta quaternion xyzw premultiplied; scale multiplier',
              'fps': fps, 'frames': frames, 'duration': (frames - 1) / fps, 'loop': True,
              'tracks': tracks}
    target = OUTPUT / f'{gender.lower()}-{variant}-idle.json'
    target.write_text(json.dumps(output, separators=(',', ':')), encoding='utf-8')
    key = f'{gender}-{variant}'
    report[key] = {'source': output['source'], 'sourceTracks': len(source_tracks),
                  'matchedTracks': len(samples), 'exportedTracks': len(tracks),
                  'dynamicChannels': len(dynamic), 'frames': frames, 'fps': fps,
                  'duration': output['duration'], 'bytes': target.stat().st_size,
                  'maxMatrixReconstructionError': maximum_error,
                  'maxSharedBodyHeadRestError': duplicate_rest_error,
                  'maxExistingGLBRestMatrixError': gltf_rest_error,
                  'dynamicChannelExamples': dynamic[:12],
                  'rootAnimated': any(t['bone'] == 'Root' for t in tracks),
                  'reductionTolerances': {'tMetres': 1e-5, 'qComponent': 2e-5, 'scale': 1e-5}}
    print('IDLE_EXPORTED', key, json.dumps(report[key]), flush=True)


for gender in ('GF', 'GM'):
    for variant in ('creator', 'normal'):
        convert(gender, variant)

(PROJECT / 'tools/idle-animation-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
