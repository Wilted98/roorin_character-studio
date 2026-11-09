import sys,json
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path.home()/'AppData/Roaming/Blender Foundation/Blender/5.2/extensions/user_default'))
from io_scene_ueformat.importer.import_context import parse_header,parse_body
from io_scene_ueformat.importer.archive.reader import FArchiveReader
source=Path.home()/'Desktop/AionModels/Aion2/Content/Character/Player'
result={}
for sex in ('GF','GM'):
 rows=[]
 for folder in sorted((source/sex/'Hair').glob(sex+'_Hair_*')):
  p=folder/(folder.name+'.uemodel')
  if not p.exists():continue
  h,a=parse_header(FArchiveReader(p.read_bytes()));d=parse_body(h,a);v=d.lods[0].vertices
  rows.append({'id':folder.name[-3:],'min':v.min(0).round(2).tolist(),'max':v.max(0).round(2).tolist(),'vertices':len(v),'materials':[m.material_path for m in d.lods[0].materials]})
 result[sex]=rows
Path(__file__).with_name('hair-inventory.json').write_text(json.dumps(result,indent=2))
