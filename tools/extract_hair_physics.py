"""Extract native KawaiiPhysics data; do not execute Unreal Blueprint logic.

Source assets are read only. Distances and rotations intentionally remain in
Unreal centimetres / local axes, so consumers cannot mistake them for glTF TRS.
"""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, default=Path.home()/'Desktop/Output/Exports/AION2/Content')
p.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1]/'public/assets/hair-physics.json')
a = p.parse_args()

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else []

def package(ref):
    return (ref or {}).get('ObjectPath', '').split('.')[0].removeprefix('/Game/')

def xyz(v):
    return [v.get(k, 0) for k in ('X', 'Y', 'Z')]

def bone(v):
    return (v or {}).get('BoneName', '')

def collision(v):
    # Location/Rotation are cached world transforms: keep authored offsets instead.
    return {k: v[k] for k in ('Radius', 'Length', 'DrivingBone', 'OffsetLocation',
                             'OffsetRotation', 'bEnable', 'LimitType') if k in v}

result = {'version': 1, 'coordinateSpace': 'Unreal local axes; distances in centimetres; rotations are Unreal rotators in degrees',
          'genders': {'GF': {}, 'GM': {}}, 'limitSets': {}, 'curves': {},
          'notes': ['Native exported KawaiiPhysics settings; browser execution is a separate reconstruction.',
                    'External curves marked missing are not silently replaced with guessed keys.',
                    'Cached world collider transforms are discarded; authored bone-relative offsets are retained.',
                    'Blueprint dynamic overrides and graph reachability are not evaluated.']}
for gender in result['genders']:
    root = a.source/f'Character/Player/{gender}/Hair'
    for f in sorted(root.glob(f'{gender}_Hair_*/ABP_{gender}_Hair_*.json')):
        asset_id = f.parent.name.removeprefix(f'{gender}_Hair_')
        objects = read(f)
        sk_path = f.parent/f'SK_{gender}_Hair_{asset_id}.json'
        sk = next((o for o in read(sk_path) if o.get('Type') == 'Skeleton'), {})
        info = sk.get('ReferenceSkeleton', {}).get('FinalRefBoneInfo', [])
        parents = {b['Name']: info[b['ParentIndex']]['Name'] if b['ParentIndex'] >= 0 else None for b in info}
        children = {}
        for b, parent in parents.items(): children.setdefault(parent, []).append(b)
        nodes = []
        for obj in objects:
            for key, v in obj.get('Properties', {}).items():
                if 'KawaiiPhysics' not in key or not isinstance(v, dict) or 'RootBone' not in v: continue
                root_bone = bone(v['RootBone'])
                excluded = [bone(x) for x in v.get('ExcludeBones', [])]
                descendants = []
                def descend(name):
                    if name in excluded: return
                    descendants.append({'name': name, 'parent': parents.get(name)})
                    for c in children.get(name, []): descend(c)
                if root_bone in parents: descend(root_bone)
                limit_ref = package(v.get('LimitsDataAsset'))
                limit_obj = read(a.source/(limit_ref+'.json')) if limit_ref else []
                authored = next((x.get('Properties', {}) for x in limit_obj if x.get('Type') == 'KawaiiPhysicsLimitsDataAsset'), {})
                # Cached node arrays can differ from asset-authored values. Preserve
                # both explicitly; runtime may choose a documented resolution.
                limits = {'source': '/Game/'+limit_ref if limit_ref else None,
                          'authored': {k: [collision(x) for x in authored.get(k, [])] for k in ('CapsuleLimits', 'SphericalLimits', 'PlanarLimits')},
                          'node': {k: [collision(x) for x in v.get(k, [])] for k in ('CapsuleLimits', 'SphericalLimits', 'PlanarLimits', 'CapsuleLimitsData', 'SphericalLimitsData', 'PlanarLimitsData')}}
                lid = hashlib.sha1(json.dumps(limits, sort_keys=True).encode()).hexdigest()[:12]
                result['limitSets'][lid] = limits
                curves = {}
                for ck, cv in v.items():
                    if not ck.endswith('CurveData') or not isinstance(cv, dict): continue
                    ref = package(cv.get('ExternalCurve'))
                    if ref:
                        loaded = read(a.source/(ref+'.json'))
                        result['curves'][ref] = {'source': '/Game/'+ref, 'available': bool(loaded), 'objects': loaded} if loaded else {'source': '/Game/'+ref, 'available': False}
                        curves[ck] = {'external': ref}
                    elif cv.get('EditorCurveData', {}).get('Keys'):
                        curves[ck] = {'inline': cv['EditorCurveData']}
                nodes.append({'node': key, 'root': root_bone, 'rootFound': root_bone in parents, 'bones': descendants,
                              'exclude': excluded, 'settings': v.get('PhysicsSettings', {}), 'curves': curves,
                              'limitSet': lid, 'gravity': xyz(v.get('Gravity', {})), 'targetFrameRate': v.get('TargetFrameRate'),
                              'dummyBoneLength': v.get('DummyBoneLength', 0), 'boneForwardAxis': v.get('BoneForwardAxis'),
                              'planarConstraint': v.get('PlanarConstraint'),
                              'wind': {'enabled': v.get('bEnableWind'), 'direction': xyz(v.get('Wind_Direction', {})), 'speed': v.get('Wind_Speed'), 'scale': v.get('WindScale')},
                              'alpha': v.get('Alpha'), 'lodThreshold': v.get('LODThreshold'),
                              'teleportDistanceThreshold': v.get('TeleportDistanceThreshold'), 'teleportRotationThreshold': v.get('TeleportRotationThreshold')})
        if nodes:
            result['genders'][gender][asset_id] = {'source': '/Game/'+str(f.relative_to(a.source).with_suffix('')).replace('\\', '/'),
                                                  'skeleton': '/Game/'+str(sk_path.relative_to(a.source).with_suffix('')).replace('\\', '/'), 'nodes': nodes}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'bytes': a.output.stat().st_size, 'hairVariants': {g: len(v) for g, v in result['genders'].items()},
                  'nodes': sum(len(h['nodes']) for v in result['genders'].values() for h in v.values()),
                  'missingRoots': sum(not n['rootFound'] for v in result['genders'].values() for h in v.values() for n in h['nodes']),
                  'missingCurves': [k for k, v in result['curves'].items() if not v['available']]}, indent=2))
