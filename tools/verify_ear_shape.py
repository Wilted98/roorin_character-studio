from pathlib import Path
import bpy,json
HERE=Path(__file__).resolve().parent
exec((HERE/'render_character_previews.py').read_text().split("\nonly='--test'")[0])
report={}
for sex in ('GF','GM'):
 sc,_=scene(sex,'001','004')
 center=sc.camera.location.z-.01
 sc.camera.location=(.35,-.7,center);aim(sc.camera,(0,0,center));sc.camera.data.lens=70
 changes=[]
 for o in bpy.data.objects:
  if o.type!='MESH' or not o.data.shape_keys:continue
  keys=o.data.shape_keys.key_blocks
  if 'EarShapeChange' not in keys:continue
  key=keys['EarShapeChange'];basis=keys['Basis']
  for i,v in enumerate(key.data):
   if (v.co-basis.data[i].co).length>1e-6:changes.append({'from':list(basis.data[i].co),'to':list(v.co)})
 report[sex]={'changedVertices':len(changes),'samples':changes[::max(1,len(changes)//10)]}
 for value in (0,1):
  for o in bpy.data.objects:
   if o.type=='MESH' and o.data.shape_keys and 'EarShapeChange' in o.data.shape_keys.key_blocks:o.data.shape_keys.key_blocks['EarShapeChange'].value=value
  sc.cycles.samples=16;sc.render.filepath=str(HERE/f'{sex.lower()}-ear-{value}.png');bpy.ops.render.render(write_still=True)
(HERE/'ear-shape-report.json').write_text(json.dumps(report,indent=2))
