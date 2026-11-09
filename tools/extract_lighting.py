"""Package native creator lighting evidence plus explicitly approximate web settings."""
import json
import math
import re
import shutil
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
PROPS = Path.home()/'Desktop/Output/Exports/AION2/Content'
TEXTURES = Path.home()/'Desktop/AionModels/Aion2/Content'
OUT = PROJECT/'public/assets/environment'
OUT.mkdir(parents=True, exist_ok=True)

def read(ref):
    return json.loads((PROPS/(ref+'.json')).read_text(encoding='utf-8-sig'))

def ref(v):
    return (v or {}).get('ObjectPath', '').split('.')[0].removeprefix('/Game/')

def overrides(base, extra):
    out = dict(base)
    for k, v in extra.items():
        if k.startswith('bOverride_'): continue
        if extra.get('bOverride_'+k): out[k] = v
    return out

def position(rotation, arm, offset=None):
    # Map camera looks along UE +X from negative X. Rotate the scene so that
    # this camera is on web +Z: (UE x,y,z) -> (web y,z,-x). Spring-arm position
    # is inferred as -forward*length, relative to a character target.
    p = math.radians(rotation.get('Pitch', 0)); y = math.radians(rotation.get('Yaw', 0))
    x, uy, z = -math.cos(p)*math.cos(y)*arm, -math.cos(p)*math.sin(y)*arm, -math.sin(p)*arm
    o = offset or {}; x += o.get('X', 0); uy += o.get('Y', 0); z += o.get('Z', 0)
    return [round(uy*.01, 6), round(z*.01, 6), round(-x*.01, 6)]

def color(v):
    return '#'+v.get('Hex', 'FFFFFF')[-6:]

result = {'version': 1, 'presets': {}, 'environments': {},
          'notes': ['Native PC_WITHOUT_LUMEN overrides are resolved where explicitly enabled.',
                    'Web lights are normalized directional approximations: source intensity /1500. They do not preserve Unreal photometric units, area-light falloff or barn doors.',
                    'Web light offsets infer a spring arm and align the source map camera (-X) to web +Z; add your character target position. Skeletal local-axis conversion is different.',
                    'Web exposure is a fixed approximation; native histogram exposure, Lumen, film curve, color LUT and volumetrics are not reproduced.',
                    'HDR files are native FModel 2:1 equirectangular RGBE exports; environment azimuth has not been visually calibrated.']}
for name in ['02_HDR_12288x6144', 'approaching_storm_4k']:
    source = TEXTURES/f'BG/Common/TextureCube/{name}.hdr'
    header = source.read_bytes()[:200]
    dims = re.search(rb'-Y (\d+) \+X (\d+)', header)
    assert dims, source
    h, w = map(int, dims.groups()); assert w == 2*h, (w, h)
    shutil.copy2(source, OUT/source.name)
    result['environments'][name] = {'url': '/assets/environment/'+source.name, 'width': w, 'height': h,
                                    'projection': 'equirectangular', 'source': '/Game/BG/Common/TextureCube/'+name}
for lut in ['BG/Common/LUT/FilmColor/EndGame', 'BG/Common/LUT/Base/ExposureL']:
    source = TEXTURES/(lut+'.png')
    if source.exists(): shutil.copy2(source, OUT/source.name)
for key, name, exposure in [('studio', 'Preview_Customizing02', 1.0), ('outdoor', 'Preview_Customizing01_Outdoor', 1.0), ('social', 'Preview_SocialAction', .9)]:
    source = 'UnrealData/Environment/Setting/'+name
    p = read(source)[0]['Properties']
    extra = next((x['Value'] for x in p.get('AddtionalSettingMap', []) if x['Key'].endswith('::PC_WITHOUT_LUMEN')), {})
    lights = {}
    for light in ['KeyLight', 'FillLight', 'BackLight', 'SpotLight']:
        n = overrides(p.get('CharLightsSetting', {}).get(light, {}), extra.get('CharLightsSetting', {}).get(light, {}))
        rot = n.get('RotationOffset', {}); length = n.get('TargetArmLength', 200)
        lights[light] = {'color': color(n.get('LightColor', {})), 'intensity': round(n.get('Intensity', 0)/1500, 6),
                         'offset': position(rot, length, n.get('TargetOffset')),
                         'source': {k: n[k] for k in ['RotationOffset', 'TargetArmLength', 'TargetOffset', 'Intensity', 'LightColor', 'SourceWidth', 'SourceHeight', 'AttenuationRadius', 'CastShadows'] if k in n}}
    sky = overrides(p.get('SkyLightSetting', {}), extra.get('SkyLightSetting', {}))
    pp = overrides(p.get('PostProcessSettings', {}), extra.get('PostProcessSettings', {}))
    sun = overrides(p.get('SunSetting', {}), extra.get('SunSetting', {}))
    environment = ref(sky.get('Cubemap')).rsplit('/', 1)[-1]
    ppkeys = ['FilmSlope', 'FilmToe', 'FilmWhiteClip', 'SceneColorTint', 'AutoExposureMethod', 'AutoExposureBias', 'AutoExposureMinBrightness', 'AutoExposureMaxBrightness', 'ColorGradingIntensity', 'ColorGradingLUT']
    result['presets'][key] = {'source': '/Game/'+source, 'sourceProfile': 'PC_WITHOUT_LUMEN', 'environment': result['environments'][environment]['url'],
                             'environmentIntensity': sky.get('Intensity', .4), 'exposure': exposure, 'lights': lights,
                             'sourcePostProcess': {k: pp[k] for k in ppkeys if k in pp},
                             'sourceSun': {k: sun[k] for k in ['LightDirection', 'Intensity', 'LightColor'] if k in sun}}
(PROJECT/'public/assets/lighting.json').write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'presets': list(result['presets']), 'environments': result['environments']}, indent=2))
