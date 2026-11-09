"""Losslessly move embedded GLB images to shared sibling PNG/JPEG files.

Geometry, morph targets, skin weights, bind matrices and image bytes are unchanged.
glTF image URIs resolve relative to public/assets/models/.
"""
import hashlib,json,struct
from pathlib import Path

def externalize_images(path):
    path=Path(path);raw=path.read_bytes()
    json_size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+json_size])
    embedded=[im for im in doc.get('images',[]) if 'bufferView' in im]
    if not embedded:return {'before':len(raw),'after':len(raw),'images':0}
    binary_start=20+json_size
    bin_size,bin_type=struct.unpack_from('<I4s',raw,binary_start)
    assert bin_type==b'BIN\0'
    binary=raw[binary_start+8:binary_start+8+bin_size]
    image_views={im['bufferView'] for im in embedded}
    # Image buffers must not be shared with geometry accessors.
    for accessor in doc.get('accessors',[]):
        assert accessor.get('bufferView') not in image_views
        for v in accessor.get('sparse',{}).values():
            if isinstance(v,dict):assert v.get('bufferView') not in image_views
    folder=path.parent.parent/'material-textures';folder.mkdir(exist_ok=True)
    for im in embedded:
        view=doc['bufferViews'][im.pop('bufferView')]
        assert view.get('buffer',0)==0
        data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        extension='.png' if im.pop('mimeType')=='image/png' else '.jpg'
        name=hashlib.sha256(data).hexdigest()[:24]+extension
        dest=folder/name
        if not dest.exists():dest.write_bytes(data)
        im['uri']='../material-textures/'+name
    new_binary=bytearray();new_views=[];remap={}
    for old,view in enumerate(doc['bufferViews']):
        if old in image_views:continue
        assert view.get('buffer',0)==0
        remap[old]=len(new_views)
        start=view.get('byteOffset',0)
        new_binary.extend(b'\0'*((-len(new_binary))%4))
        new_views.append(dict(view,byteOffset=len(new_binary)))
        new_binary.extend(binary[start:start+view['byteLength']])
    def update_refs(value):
        if isinstance(value,dict):
            for key,child in value.items():
                if key=='bufferView':value[key]=remap[child]
                else:update_refs(child)
        elif isinstance(value,list):
            for child in value:update_refs(child)
    update_refs(doc)
    doc['bufferViews']=new_views
    doc['buffers']=[{'byteLength':len(new_binary)}]
    new_binary.extend(b'\0'*((-len(new_binary))%4))
    encoded=json.dumps(doc,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    result=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(new_binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(new_binary),b'BIN\0')+new_binary
    path.write_bytes(result)
    return {'before':len(raw),'after':len(result),'images':len(embedded)}

if __name__=='__main__':
    import sys
    for path in sys.argv[1:]:print(path,externalize_images(path))
