"""Build the local editor catalog from the user's existing decoded exports."""
import json, runpy, struct
from pathlib import Path
env=runpy.run_path(str(Path(__file__).with_name('extract_appearance.py')))
catalog=env['catalog']; table=env['table']; copy=env['copy']; parameters=env['parameters']; read=env['read']; args=env['a']
def flatten(values):
    return {k:('#'+v['Hex'][:6] if isinstance(v,dict) and 'Hex' in v else v) for k,v in values.items() if isinstance(v,(int,float,str)) or isinstance(v,dict) and 'Hex' in v}
layers={
 'ShadingType':('Shading_NUMBER_Texture',2),'HighlighterType':('Highlighter_NUMBER_Texture',0),'BlusherType':('Blusher_NUMBER_Texture',1),
 'EyeshadowType':('EyeShadowA_NUMBER_Texture',0),'Eyeshadow2Type':('EyeShadowB_NUMBER_Texture',1),'EyelineType':('EyeLiner_NUMBER_Texture',2),
 'LipType':('LipA_NUMBER_Texture',0),'Lip2Type':('LipB_NUMBER_Texture',2),'FreckleType':('Freckle_NUMBER_Texture',1),'MoleType':('Mole_NUMBER_Texture',2),
 'TattooType':('Tattoo_NUMBER_Texture',0),'ScarType':('BurntArea_NUMBER_Texture',0),'WarPaintType':('WarPaint_Mask',0),'StubbleType':('Stubble_Number_Texture',1),
}
missing=[]
makeup=read(args.source/'UnrealData/PcCustomizeFeatureTable_PresetMakeup.json')[0]['Rows']
bodies=env['bodies']
bone_ranges=read(args.source/'UnrealData/PcCustomizeFeatureTable_Bone.json')[0]['Rows']
for gender,sex in [('GF','Female'),('GM','Male')]:
 g=catalog['genders'][gender]; src=table[sex]; sets=src['CustomizeFeatureDataSet'];g['options']={}
 for group,ranges in src['CustomizeValueSettings'].items():
  for k,r in ranges.items():g['ranges'][k]={'min':r['Min'],'mid':r['Mid'],'max':r['Max'],'reversed':r['SliderUIRangeType'].endswith('::MaxMin')}
 for k in ['EyelashLength','EyelashUpDown']:
  r=bone_ranges[sex]['CustomizeValueSettings']['Face'][k];g['ranges'][k]={'min':r['Min'],'mid':r['Mid'],'max':r['Max'],'reversed':r['SliderUIRangeType'].endswith('::MaxMin')}
 g['detailTextures']={key:copy('/Game/'+ref) for key,ref in [('veins',f'Character/Player/Customize/{gender}_BaseBody_Veins_N'),('muscle',f'Character/Player/Customize/{gender}_BaseBody_Muscle_N'),('regions',f'Character/Player/Customize/{gender}_BaseBody_Muscle_CSTM'),('sclera','Material/Chr/MM/Cstm/Func/Eye/T_Sclera_000_SV')]}
 for key,items in sets.items():
  if key in ('SkinColor','HeadType','HairType'):continue
  options=[]
  for item in items:
   v=item['Value']; p=parameters(v.get('MaterialPtr'));spec=layers.get(key)
   if key.startswith('BodyTattooType_'):spec=('Tattoo_'+key.removeprefix('BodyTattooType_'),0)
   ref=p['textures'].get(spec[0]) if spec else None
   # Some exported instances use the unnumbered tattoo parameter.
   if key=='TattooType' and not ref:ref=p['textures'].get('Tattoo_Texture') or p['textures'].get('Tattoo')
   url=copy(ref) if ref else None
   if spec and int(item['Key'])>1 and not url:missing.append({'gender':gender,'type':key,'id':item['Key'],'texture':ref,'material':v.get('MaterialPtr')})
   options.append({'id':str(item['Key']),'label':('None' if item['Key']=='1' and spec else key.removesuffix('Type')+' '+str(item['Key'])),'thumbnail':copy(v.get('Icon')),'texture':url,'channel':spec[1] if spec else 0,'scalars':p['scalars'],'resource':v.get('ResourceName')})
  g['options'][key]=options
 g['makeupPresets']=[{'id':k,'thumbnail':copy(v['Icon']),'values':flatten(v['MaterialCustomizeData'])} for k,v in makeup.items() if v['CustomizeDataKey']==sex]
 g['bodyPresets']=[{'id':k,'thumbnail':copy(v['Icon']),'values':v['BodyCustomizeData']} for k,v in bodies.items() if v['CustomizeDataKey']==sex]
 for p in g['presets']:
  p['appearance'].update(flatten(p['sourceMaterialValues']))
  p['appearance'].update(flatten(p['sourceHair']))
  p['appearance'].update(flatten(p['sourceBeard']))
  for k in ['EyelashLength','EyelashUpDown']:p['appearance'][k]=p['sourceFaceValues'].get(k,.5)
 g['defaults']=dict(g['presets'][0]['appearance'])
catalog['missingLayerTextures']=missing
(args.output/'appearance.json').write_text(json.dumps(catalog,separators=(',',':')),encoding='utf8')
print(json.dumps({'layerOptions':{g:sum(map(len,catalog['genders'][g]['options'].values())) for g in catalog['genders']},'missingLayers':missing},indent=2))
