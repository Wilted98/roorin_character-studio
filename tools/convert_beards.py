"""Isolated background conversion; never touches the interactive Blender scene."""
from pathlib import Path
import sys,json
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from shared_glb_images import externalize_images
converter=(HERE/'convert_characters.py').read_text().split("\nmanifest={'version'")[0]
converter=converter.replace("    (PROJECT/'tools/asset-bone-rest.json').write_text(json.dumps(diagnostics),encoding='utf-8')",'    pass')
converter=converter.replace("elif 'hair' in lower and 'facial' not in lower:role='hair'","elif 'hair' in lower or 'beard' in lower:role='hair'")
exec(converter)
catalog=json.loads((ASSETS/'appearance.json').read_text());character=json.loads((ASSETS/'characters.json').read_text())
for gender,g in catalog['genders'].items():
 result=[]
 for o in g['options']['BeardType']:
  resource=o.get('resource')
  if not resource or resource.endswith('_000'):continue
  idx=resource.rsplit('_',1)[-1]
  if not model_path(gender,'beard',idx).exists():continue
  asset=export_one(gender,'beard',idx);asset.update({'id':o['id'],'thumbnail':o['thumbnail']})
  target=ASSETS/'models'/Path(asset['url']).name
  externalize_images(target);result.append(asset)
 character['genders'][gender]['beards']=result
 (ASSETS/'characters.json').write_text(json.dumps(character,indent=2))
print('BEARDS_COMPLETE',flush=True)
