"""Convert selected local UEFormat assets to modular web GLBs in isolated Blender.

Run: blender --background --factory-startup --python tools/convert_characters.py
Original source assets and the interactive Blender instance are never edited.
"""
import os,sys,json,math,hashlib,struct
from pathlib import Path
import bpy,numpy as np
from mathutils import Vector,Matrix

PROJECT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('AION_ASSETS',str(Path.home()/'Desktop/AionModels/Aion2/Content')))
PROPS=Path(os.environ.get('AION_PROPERTIES',str(Path.home()/'Desktop/Output/Exports/AION2/Content')))
ASSETS=PROJECT/'public/assets'
sys.path.insert(0,str(Path.home()/'AppData/Roaming/Blender Foundation/Blender/5.2/extensions/user_default'))
from io_scene_ueformat.importer.import_context import UEFormatImport
from io_scene_ueformat.options import UEModelOptions

TEXTURE_CACHE=PROJECT/'tools/conversion-textures'
TEXTURE_CACHE.mkdir(parents=True,exist_ok=True)
for sub in ('models','thumbnails'):(ASSETS/sub).mkdir(parents=True,exist_ok=True)
prop_cache={}; material_records={}; diagnostics={}; image_cache={}
def package(p):return p.split('.')[0]
def read_props(ref):
    path=package(ref)
    if path not in prop_cache:
        p=PROPS/(path.removeprefix('/Game/')+'.json')
        prop_cache[path]=json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else []
    return prop_cache[path]
def params(ref):
    result={'textures':{},'scalars':{},'vectors':{}};chain=[]
    while ref and package(ref) not in chain:
        chain.append(package(ref));objects=read_props(ref)
        obj=next((o for o in objects if o.get('Type') in ('MaterialInstanceConstant','Material')),None)
        if obj is None:break
        p=obj.get('Properties',{})
        for source,target in [('TextureParameterValues','textures'),('ScalarParameterValues','scalars'),('VectorParameterValues','vectors')]:
            for item in p.get(source,[]):
                name=item.get('ParameterInfo',{}).get('Name')
                if name not in result[target]:result[target][name]=item.get('ParameterValue')
        ref=(p.get('Parent') or {}).get('ObjectPath')
    result['chain']=chain;return result
def texture_path(ref):
    if isinstance(ref,dict):ref=ref.get('ObjectPath')
    if not ref:return None
    base=SOURCE/package(ref).removeprefix('/Game/')
    p=base.with_suffix('.png')
    if p.exists():return p
    p=base.parent/(base.name+'_LAYER0.png')
    return p if p.exists() else None
def image_from_file(p,kind='color'):
    if not p:return None
    key=f'{p}|{kind}'
    if key in image_cache and image_cache[key].name in bpy.data.images:return image_cache[key]
    im=bpy.data.images.load(str(p),check_existing=True)
    im.colorspace_settings.name='sRGB' if kind=='color' else 'Non-Color'
    if max(im.size)>1024:
        scale=1024/max(im.size);im.scale(round(im.size[0]*scale),round(im.size[1]*scale))
    image_cache[key]=im;return im
def derived_image(path,mode):
    """Repack native data channels into a web PBR-compatible map."""
    key=f'{path}|{mode}|v3';name=hashlib.sha1(key.encode()).hexdigest()[:12]+'-'+mode
    target=TEXTURE_CACHE/(name+'.png')
    if target.exists():return image_from_file(target,'data' if mode=='normal' else 'color')
    im=image_from_file(path,'data');w,h=im.size
    pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels);arr=pixels.reshape(h,w,4)
    result=np.ones_like(arr)
    if mode=='hair':
        # Native DIRO: depth / strand-id / root / opacity. Use original opacity.
        shade=.34+.66*np.clip(arr[:,:,0],0,1)
        result[:,:,:3]=shade[:,:,None]*np.array([.095,.065,.044])
        result[:,:,3]=arr[:,:,3]
    elif mode=='lash':
        result[:,:,:3]=[.02,.012,.009]
        result[:,:,3]=arr[:,:,1]
    elif mode=='normal':
        # Unreal normal green axis differs from glTF/OpenGL.
        result[:,:,:]=arr;result[:,:,1]=1-arr[:,:,1];result[:,:,3]=1
    elif mode=='eye':
        # Iris material uses procedural layering in UE; use radial pattern mask.
        yy,xx=np.mgrid[0:h,0:w];r=np.sqrt(((xx+.5)/w-.5)**2+((yy+.5)/h-.5)**2)
        ix=np.clip(((xx/w-.5)/(.17/.475)+.5)*w,0,w-1).astype(int)
        iy=np.clip(((yy/h-.5)/(.17/.475)+.5)*h,0,h-1).astype(int)
        detail=np.clip(arr[iy,ix,0]*.5+arr[iy,ix,1]*.5,0,1)
        result[:,:,:3]=(.30+.70*detail[:,:,None])*np.array([.15,.27,.30])
        result[r<.05,:3]=[.006,.008,.009]
        result[r>.17,:3]=[.72,.69,.65]
        edge=np.clip((r-.15)/.02,0,1);inside=(r>.15)&(r<=.17)
        result[inside,:3]*=(1-.8*edge[inside,None])
    out=bpy.data.images.new(name,width=w,height=h,alpha=True)
    out.colorspace_settings.name='Non-Color' if mode=='normal' else 'sRGB'
    out.pixels.foreach_set(result.ravel());out.filepath_raw=str(target);out.file_format='PNG';out.save()
    return out
def tex_node(mat,im):
    if not im:return None
    n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im
    uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='UV0';mat.node_tree.links.new(uv.outputs['UV'],n.inputs['Vector'])
    return n
def make_material(name,ref):
    data=params(ref);textures=data['textures'];scalars=data['scalars'];vectors=data['vectors']
    m=bpy.data.materials.new(name);m.use_nodes=True;m.use_backface_culling=False
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.48
    p.inputs['Specular IOR Level'].default_value=.32
    role='clothing';lower=name.lower()
    if 'hair' in lower and 'facial' not in lower:role='hair'
    elif 'tear' in lower:role='tear'
    elif 'eyea' in lower or 'eye_a' in lower:role='lashes'
    elif '_eye' in lower:role='eyes'
    elif 'naked' in lower or 'basebody' in lower or ('head' in lower and 'hide' not in lower):role='skin'
    m['role']=role;m['sourceMaterial']=ref;m['nativeName']=name
    if role=='hair':
        source=texture_path(textures.get('DIRO') or textures.get('DIO_HairCard'))
        n=tex_node(m,derived_image(source,'hair') if source else None)
        p.inputs['Base Color'].default_value=(.08,.05,.028,1);p.inputs['Roughness'].default_value=.65;p.inputs['Specular IOR Level'].default_value=.15
        if n:m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(n.outputs['Alpha'],p.inputs['Alpha'])
        m.surface_render_method='DITHERED';m['alphaCutoff']=.08
    elif role=='lashes':
        source=texture_path(textures.get('EyelashAO'));n=tex_node(m,derived_image(source,'lash') if source else None)
        p.inputs['Base Color'].default_value=(.015,.01,.008,1);p.inputs['Roughness'].default_value=.6
        if n:m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(n.outputs['Alpha'],p.inputs['Alpha'])
        else:p.inputs['Alpha'].default_value=0
        m.surface_render_method='DITHERED';m['alphaCutoff']=.35
    elif role=='tear':
        p.inputs['Base Color'].default_value=(.65,.65,.65,1);p.inputs['Alpha'].default_value=.04;p.inputs['Roughness'].default_value=.12
        m.surface_render_method='DITHERED'
    elif role=='eyes':
        source=texture_path(textures.get('IrisMasks'));n=tex_node(m,derived_image(source,'eye') if source else None)
        p.inputs['Base Color'].default_value=(.11,.26,.3,1);p.inputs['Roughness'].default_value=.12
        p.inputs['Coat Weight'].default_value=.6
        if n:m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
    else:
        source=texture_path(textures.get('BaseColor'));n=tex_node(m,image_from_file(source))
        if n:m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
        else:p.inputs['Base Color'].default_value=(.52,.31,.22,1) if role=='skin' else (.25,.20,.15,1)
        if role=='skin':
            p.inputs['Roughness'].default_value=.53;p.inputs['Subsurface Weight'].default_value=.075
        normal=texture_path(textures.get('Normal') or textures.get('NormalBase'))
        if normal:
            n=tex_node(m,derived_image(normal,'normal'));nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.6
            m.node_tree.links.new(n.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    material_records[ref]={'name':name,'role':role,'parentChain':data['chain'],'texturesUsed':[n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]}
    return m
def model_path(sex,part,idx=None):
    if part=='body':return SOURCE/f'Character/Player/{sex}/Basebody/{sex}_BaseFull.uemodel'
    if part=='boots':return SOURCE/f'Character/Player/{sex}/Basebody/{sex}_BaseBoots.uemodel'
    cap=part.capitalize();return SOURCE/f'Character/Player/{sex}/{cap}/{sex}_{cap}_{idx}/{sex}_{cap}_{idx}.uemodel'
def import_model(sex,part,idx=None):
    path=model_path(sex,part,idx)
    before=set(bpy.data.objects)
    arm,dto=UEFormatImport(UEModelOptions(import_morph_targets=True,reorient_bones=False,import_sockets=False)).import_file_with_dto(path)
    added=set(bpy.data.objects)-before
    meshes=[o for o in added if o.type=='MESH']
    for mesh in meshes:
        mesh.data.materials.clear()
        for mi,item in enumerate(dto.lods[0].materials):
            mesh.data.materials.append(make_material(item.material_name,item.material_path))
            for face in mesh.data.polygons[item.first_index//3:item.first_index//3+item.num_faces]:face.material_index=mi
        mesh['part']=part;mesh['gender']=sex;mesh['variant']=idx or 'base'
    return added,meshes,arm
def export_one(sex,part,idx=None):
    bpy.ops.wm.read_factory_settings(use_empty=True);image_cache.clear()
    added,meshes,arm=import_model(sex,part,idx)
    if part=='body':
        boot_objects,boot_meshes,boot_arm=import_model(sex,'boots')
        for mesh in boot_meshes:
            mesh.parent=arm
            for modifier in mesh.modifiers:
                if modifier.type=='ARMATURE':modifier.object=arm
            mesh['part']='body'
        if boot_arm:
            boot_objects.discard(boot_arm);bpy.data.objects.remove(boot_arm,do_unlink=True)
        added|=boot_objects;meshes+=boot_meshes
    # Native imported models face Blender -Y (glTF +Z); keep bone locals untouched.
    root=bpy.data.objects.new('CharacterOrientation',None);bpy.context.collection.objects.link(root)
    root.rotation_euler.z=0
    for o in added:
        if o.parent not in added:o.parent=root
    bbox=[root.matrix_world@o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
    # Save converted bone local rest TRS for native pose delta integration.
    rest={}
    if arm:
        for b in arm.data.bones:
            local=b.parent.matrix_local.inverted()@b.matrix_local if b.parent else b.matrix_local
            t,r,s=local.decompose();rest[b.name]={'parent':b.parent.name if b.parent else None,'translation':list(t),'rotation':[r.x,r.y,r.z,r.w],'scale':list(s),'matrix':[list(row) for row in local]}
    filename=f'{sex.lower()}-{part}'+(f'-{idx}' if idx else '')+'.glb';target=ASSETS/'models'/filename
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_animations=False,export_extras=True,export_skins=True,export_morph=True,export_morph_normal=True,export_materials='EXPORT',export_image_format='AUTO',export_all_influences=False,export_cameras=False,export_lights=False)
    raw=target.read_bytes();n=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+n])
    for material in gltf.get('materials',[]):
        if material.get('extras',{}).get('role') in ('hair','lashes'):
            material['alphaMode']='MASK';material['alphaCutoff']=material.get('extras',{}).get('alphaCutoff',.25);material['doubleSided']=True
    # Rewrite JSON chunk to make alpha clipping deterministic across web renderers.
    encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    rest_bytes=raw[20+n:];total=12+8+len(encoded)+len(rest_bytes)
    target.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(encoded),b'JSON')+encoded+rest_bytes)
    diagnostics[f'{sex}-{part}-{idx or "base"}']={'blenderLocalRest':rest,'gltfNodes':[node for node in gltf.get('nodes',[]) if node.get('name') in rest or node.get('name')=='CharacterOrientation']}
    result={'id':idx or 'base','name':f'{part.title()} {int(idx):02}' if idx else 'Base body','url':'/assets/models/'+filename,'bytes':target.stat().st_size,'vertices':sum(len(o.data.vertices) for o in meshes),'bones':len(arm.data.bones) if arm else 0,'morphTargets':sorted({k.name for o in meshes if o.data.shape_keys for k in o.data.shape_keys.key_blocks if k.name!='Basis'})}
    print('EXPORTED',filename,result['bytes'],flush=True)
    (PROJECT/'tools/asset-bone-rest.json').write_text(json.dumps(diagnostics),encoding='utf-8')
    return result

manifest={'version':1,'units':'metres','upAxis':'Y','frontAxis':'+Z','rootOrientation':'Identity; native models face Blender -Y and glTF +Z','genders':{},'limitations':['Game materials approximated as browser PBR. Skin subsurface, layered makeup, iris shader and anisotropic hair are not exact Unreal shader replicas.','Four head and four hairstyle variants per body type are included in this first prototype.']}
for sex in ('GF','GM'):
    entry={'name':'Female' if sex=='GF' else 'Male','body':export_one(sex,'body'),'heads':[],'hair':[]}
    for part,key in [('head','heads'),('hair','hair')]:
        for idx in ('001','002','003','004'):
            if model_path(sex,part,idx).exists():entry[key].append(export_one(sex,part,idx))
    manifest['genders'][sex]=entry
    (ASSETS/'characters.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(PROJECT/'tools/material-conversion.json').write_text(json.dumps(material_records,indent=2),encoding='utf-8')
print('MODEL_EXPORT_COMPLETE',flush=True)
