"""Remove unused GLB delivery resources; preserve geometry, skins and morphs.

Only generated files under this project's public/assets are mutated. Source game
exports are never opened for writing. Cleanup checks the exact resolved folder.
"""
import argparse,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/assets'
MODELS=ASSETS/'models'
TEXTURES=(ASSETS/'material-textures').resolve()

def material_texture_infos(value):
    if isinstance(value,dict):
        for key,child in value.items():
            if key.endswith('Texture') and isinstance(child,dict) and isinstance(child.get('index'),int):yield child
            yield from material_texture_infos(child)
    elif isinstance(value,list):
        for child in value:yield from material_texture_infos(child)

def image_sources(texture):
    if isinstance(texture.get('source'),int):yield texture
    for extension in texture.get('extensions',{}).values():
        if isinstance(extension,dict) and isinstance(extension.get('source'),int):yield extension

def view_refs(value):
    if isinstance(value,dict):
        for key,child in value.items():
            if key=='bufferView' and isinstance(child,int):yield value
            elif key!='bufferViews':yield from view_refs(child)
    elif isinstance(value,list):
        for child in value:yield from view_refs(child)

def compact(file):
    raw=file.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size])
    assert not any(v in doc.get('extensionsUsed',[]) for v in ['EXT_meshopt_compression','KHR_draco_mesh_compression']), 'Run resource pruning before mesh compression.'
    old_counts={key:len(doc.get(key,[])) for key in ['textures','images','samplers','bufferViews']}
    infos=list(material_texture_infos(doc.get('materials',[])))
    selected=sorted({v['index'] for v in infos});remap={v:i for i,v in enumerate(selected)}
    for info in infos:info['index']=remap[info['index']]
    doc['textures']=[doc['textures'][i] for i in selected]
    sources=[source for texture in doc['textures'] for source in image_sources(texture)]
    selected=sorted({v['source'] for v in sources});remap={v:i for i,v in enumerate(selected)}
    for source in sources:source['source']=remap[source['source']]
    doc['images']=[doc['images'][i] for i in selected]
    selected=sorted({v['sampler'] for v in doc['textures'] if 'sampler'in v});remap={v:i for i,v in enumerate(selected)}
    for texture in doc['textures']:
        if 'sampler'in texture:texture['sampler']=remap[texture['sampler']]
    doc['samplers']=[doc['samplers'][i] for i in selected]
    refs=list(view_refs(doc));selected=sorted({v['bufferView'] for v in refs});remap={v:i for i,v in enumerate(selected)}
    old_binary=raw[28+size:28+size+doc['buffers'][0]['byteLength']];binary=bytearray();views=[]
    for index in selected:
        view=doc['bufferViews'][index];assert view.get('buffer',0)==0
        start=view.get('byteOffset',0);chunk=old_binary[start:start+view['byteLength']]
        binary.extend(b'\0'*((-len(binary))%4));views.append(dict(view,byteOffset=len(binary)));binary.extend(chunk)
    for ref in refs:ref['bufferView']=remap[ref['bufferView']]
    doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(binary)}]
    binary.extend(b'\0'*((-len(binary))%4));encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    output=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    file.write_bytes(output)
    return {'file':file.name,'before':len(raw),'after':len(output),'removed':{key:old_counts[key]-len(doc.get(key,[]))for key in old_counts}}

def remove_orphan_images():
    assert TEXTURES==(ROOT.resolve()/'public/assets/material-textures').resolve()
    used=set()
    for file in MODELS.glob('*.glb'):
        raw=file.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n])
        for image in doc.get('images',[]):
            if image.get('uri') and not image['uri'].startswith('data:'):used.add((file.parent/image['uri']).resolve())
    removed=[]
    for file in TEXTURES.iterdir():
        resolved=file.resolve();assert resolved.parent==TEXTURES
        if resolved.is_file() and resolved not in used:
            removed.append({'file':resolved.name,'bytes':resolved.stat().st_size});resolved.unlink()
    return removed

def asset_size():return sum(f.stat().st_size for f in ASSETS.rglob('*') if f.is_file())

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--png-optimize',action='store_true');args=parser.parse_args()
    before=asset_size();changes=[compact(f) for f in sorted(MODELS.glob('*.glb'))];removed=remove_orphan_images()
    if args.png_optimize:
        from PIL import Image
        for file in TEXTURES.glob('*.png'):
            im=Image.open(file);temporary=file.with_suffix('.optimized.png');im.save(temporary,optimize=True,compress_level=9)
            if temporary.stat().st_size<file.stat().st_size:temporary.replace(file)
            else:temporary.unlink()
    catalog_file=ASSETS/'characters.json';catalog=json.loads(catalog_file.read_text())
    for gender in catalog['genders'].values():
        for key in ['body','heads','hair','outfits']:
            options=[gender[key]] if key=='body' else gender.get(key,[])
            for option in options:option['bytes']=(ROOT/'public'/option['url'].lstrip('/')).stat().st_size
    catalog_file.write_text(json.dumps(catalog,indent=2))
    result={'beforeBytes':before,'afterBytes':asset_size(),'removedImages':removed,'models':changes}
    (ROOT/'tools/delivery-compaction-report.json').write_text(json.dumps(result,indent=2))
    print(json.dumps({'beforeMiB':before/1048576,'afterMiB':result['afterBytes']/1048576,'reclaimedMiB':(before-result['afterBytes'])/1048576,'orphanImagesRemoved':len(removed)},indent=2))
