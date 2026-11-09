"""Generate readable selection previews from native packed texture channels."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]/'public'
path=root/'assets/appearance.json';data=json.loads(path.read_text())
out=root/'assets/appearance/previews';out.mkdir(parents=True,exist_ok=True)
for gender,group in data['genders'].items():
 for kind in ['iris','pupils','brows','lashes']:
  for item in group[kind]:
   if item.get('thumbnailOrigin')=='game' and item.get('thumbnail'):continue
   src=Image.open(root/item['texture'].lstrip('/')).convert('RGBA')
   if kind=='iris':
    import math
    sample=src.resize((128,128));image=Image.new('RGB',(128,128),(215,220,222));p=image.load();q=sample.load()
    for y in range(128):
     for x in range(128):
      r=math.hypot(x-63.5,y-63.5)/64
      if r<.88:
       shade=int((.25+.75*(q[x,y][0]+q[x,y][1])/510)*185)
       border=max(0,min(1,(r-.72)/.16));shade=int(shade*(1-.6*border));p[x,y]=(shade,shade+min(10,255-shade),shade+min(15,255-shade))
      if r<.23:p[x,y]=(8,12,14)
   else:
    ch=src.getchannel('R' if kind=='pupils' else 'B' if kind=='brows' else 'G')
    if kind=='pupils':
     image=Image.merge('RGB',(ch,ch,ch)).resize((128,128))
    else:
     ch=ch.resize((192,96));image=Image.new('RGB',(192,96),(197,191,184));image.paste((42,34,31),(0,0,192,96),ch)
   name=f'{gender.lower()}-{kind}-{item["id"]}.png';image.save(out/name)
   item['thumbnail']='/assets/appearance/previews/'+name
path.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
print('Readable source-channel previews created.')
