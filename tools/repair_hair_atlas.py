"""Bake current native card/cap UVs into a browser texture without reimporting rigs.

Native UV1 uses U in [0,1] for the five-card DOI atlas and U in [1,2]
for the scalp-cap ROI atlas. Card_Index_Texture is the already composed atlas
for the material's CardA-E index/section selections. Its green channel is
opacity. Legacy DIRO layouts differ (some include the cap in their lower half).
Preserves UV1; writes the resolved combined-atlas UVs to UV0.
"""
import argparse,hashlib,json,math,struct
from pathlib import Path
from source_paths import discover_source
from PIL import Image
PROJECT=Path(__file__).resolve().parents[1]
SOURCE=discover_source('textures')
PROPS=discover_source('properties')
ASSETS=PROJECT/'public/assets'

def parameters(ref):
    textures={};scalars={};seen=set()
    while ref:
        key=ref.split('.')[0].removeprefix('/Game/')
        if key in seen:break
        seen.add(key);path=PROPS/(key+'.json')
        if not path.exists():break
        obj=next((v for v in json.loads(path.read_text(encoding='utf-8-sig')) if v.get('Type') in ('Material','MaterialInstanceConstant')),None)
        if not obj:break
        props=obj.get('Properties',{})
        for name,dest in [('TextureParameterValues',textures),('ScalarParameterValues',scalars)]:
            for item in props.get(name,[]):dest.setdefault(item['ParameterInfo']['Name'],item['ParameterValue'])
        ref=props.get('Parent',{}).get('ObjectPath')
    return textures,scalars

def texture_path(ref):
    if isinstance(ref,dict):ref=ref.get('ObjectPath') or ref.get('AssetPathName')
    return SOURCE/(ref.split('.')[0].removeprefix('/Game/')+'.png') if ref else None

def atlas(textures):
    card=texture_path(textures.get('Card_Index_Texture'))
    cap=texture_path(textures.get('ROI_HairCap'))
    if not card or not cap or not card.exists() or not cap.exists():return None
    signature='v5b|'+str(card)+'|'+str(cap)
    dest=ASSETS/'material-textures'/('hair-v5-'+hashlib.sha256(signature.encode()).hexdigest()[:20]+'.png')
    if not dest.exists():
        card_image=Image.open(card).convert('RGB').resize((2048,1024),Image.Resampling.LANCZOS)
        cap_image=Image.open(cap).convert('RGB').resize((2048,1024),Image.Resampling.LANCZOS)
        out=Image.new('RGBA',(4096,1024))
        for x,source in [(0,card_image),(2048,cap_image)]:
            shade=source.getchannel('B').point([round(255*(.65+.35*v/255)) for v in range(256)])
            opacity=source.getchannel('G').point([round(255*math.sqrt(v/255)) for v in range(256)])
            out.paste(Image.merge('RGBA',(shade,shade,shade,opacity)),(x,0))
        out.save(dest)
    return dest,card,cap

def repair(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n])
    binary=bytearray(raw[28+n:28+n+doc['buffers'][0]['byteLength']]);updates={};sources=[]
    for i,material in enumerate(doc['materials']):
        if material.get('extras',{}).get('nativeName')=='M_Hide':
            material['pbrMetallicRoughness']['baseColorFactor']=[0,0,0,0]
            material['alphaMode']='BLEND';material['extras']['role']='hidden'
        if material.get('extras',{}).get('role')!='hair':continue
        textures,scalars=parameters(material['extras']['sourceMaterial']);result=atlas(textures)
        if result is None:continue
        dest,card,cap=result
        texture=material['pbrMetallicRoughness']['baseColorTexture']
        tex=doc['textures'][texture['index']]
        image_index=len(doc.setdefault('images',[]));doc['images'].append({'uri':'../material-textures/'+dest.name})
        new_tex=dict(tex,source=image_index)
        sampler_index=len(doc.setdefault('samplers',[]));doc['samplers'].append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071});new_tex['sampler']=sampler_index
        texture_index=len(doc['textures']);doc['textures'].append(new_tex)
        texture.update({'index':texture_index,'texCoord':0});texture.pop('extensions',None)
        material['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
        material['pbrMetallicRoughness']['roughnessFactor']=.5
        material['alphaMode']='MASK';material['alphaCutoff']=.35;material['doubleSided']=True
        material['extras'].update({'hairMaterialVersion':5,'hairUVMapping':'UV1: card U0..1, cap U1..2; baked UV0 U/2','hairCardTexture':str(card.relative_to(SOURCE)),'hairCapTexture':str(cap.relative_to(SOURCE))})
        updates[i]=True;sources.append({'material':material['name'],'cards':str(card.relative_to(SOURCE)),'cap':str(cap.relative_to(SOURCE))})
    remapped={};cap_vertices=0
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            if prim.get('material') not in updates:continue
            uv_index=prim['attributes'].get('TEXCOORD_1',prim['attributes']['TEXCOORD_0'])
            if 'TEXCOORD_1' not in prim['attributes']:
                # Preserve the original UV set on older single-UV meshes so reruns are stable.
                prim['attributes']['TEXCOORD_1']=uv_index
            if uv_index not in remapped:
                accessor=doc['accessors'][uv_index];view=doc['bufferViews'][accessor['bufferView']]
                assert accessor['type']=='VEC2' and accessor['componentType']==5126
                offset=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',8)
                values=[struct.unpack_from('<ff',binary,offset+i*stride) for i in range(accessor['count'])]
                cap_vertices+=sum(u>1.001 for u,v in values)
                binary.extend(b'\0'*((-len(binary))%4));start=len(binary)
                for u,v in values:binary.extend(struct.pack('<ff',u*.5,v))
                vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(values)*8,'target':34962})
                ai=len(doc['accessors']);doc['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(values),'type':'VEC2'})
                remapped[uv_index]=ai
            prim['attributes']['TEXCOORD_0']=remapped[uv_index]
    doc['buffers'][0]['byteLength']=len(binary);binary.extend(b'\0'*((-len(binary))%4))
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
    return {'file':path.name,'materials':sources,'capVertices':cap_vertices,'patched':len(updates)}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--gender',choices=['GF','GM']);p.add_argument('--id');a=p.parse_args()
    files=sorted((ASSETS/'models').glob(f'{a.gender.lower() if a.gender else "*"}-hair-{a.id or "*"}.glb'))
    result=[repair(f) for f in files]
    print(json.dumps(result,indent=2))
