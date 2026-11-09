"""Add varied native hairstyles and armor0103 without altering existing GLBs."""
from pathlib import Path
import sys,json,bmesh
HERE=Path(__file__).resolve().parent
exec((HERE/'convert_characters.py').read_text().split("\nmanifest={'version'")[0])
diagnostics=json.loads((HERE/'asset-bone-rest.json').read_text())
selected=('101','201','205','301','305','311','401','412')

def bind_piece(meshes,arm,other):
    missing=[b for b in other.data.bones if b.name not in arm.data.bones]
    if missing:
        bpy.context.view_layer.objects.active=arm;arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for b in missing:
            eb=arm.data.edit_bones.new(b.name);eb.matrix=b.matrix_local;eb.length=max(b.length,.005)
        for b in missing:
            if b.parent:arm.data.edit_bones[b.name].parent=arm.data.edit_bones.get(b.parent.name)
        bpy.ops.object.mode_set(mode='OBJECT')
    for mesh in meshes:
        mesh.parent=arm
        for mod in mesh.modifiers:
            if mod.type=='ARMATURE':mod.object=arm
    bpy.data.objects.remove(other,do_unlink=True)

def armor_material(sex,part):
    folder=SOURCE/f'Character/Player/{sex}/Armor/0103/{sex}_0103_T01'
    files=list(folder.rglob(f'{sex}_0103_T01_{part}_D.png'))
    # Native property exports for these armor MIs are absent. Missing parts share
    # the Body atlas provisionally; record this explicitly for later replacement.
    atlas=part if files else 'Body'
    files=list(folder.rglob(f'{sex}_0103_T01_{atlas}_D.png'))
    mat=bpy.data.materials.new(f'{sex}_0103_{part}');mat.use_nodes=True
    mat['role']='clothing';mat['nativeName']=f'MI_{sex}_0103_T01_{part}_LT';mat['atlas']=atlas
    mat['approximateAtlas']=atlas!=part
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.65;p.inputs['Specular IOR Level'].default_value=.25
    if files:
        n=tex_node(mat,image_from_file(files[0]));mat.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
        normal=files[0].with_name(files[0].name.replace('_D.png','_N.png'))
        if normal.exists():
            n=tex_node(mat,derived_image(normal,'normal'));nm=mat.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.5
            mat.node_tree.links.new(n.outputs['Color'],nm.inputs['Color']);mat.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    return mat

def armor(sex):
    bpy.ops.wm.read_factory_settings(use_empty=True);image_cache.clear()
    added,meshes,arm=import_model(sex,'body')
    # Armor Body/Pants already contain their required native exposed skin.
    # Retain the canonical skeleton and skin material but remove duplicate base geometry.
    skin=next(m for mesh in meshes for m in mesh.data.materials if m.get('role')=='skin')
    for mesh in meshes:
        bpy.data.objects.remove(mesh,do_unlink=True)
    meshes=[]
    for part in ('Body','Pants','Boots','Glove','Shoulder','Cape'):
        path=SOURCE/f'Character/Player/{sex}/Armor/0103/{sex}_0103_T01/{sex}_0103_T01_{part}.uemodel'
        before=set(bpy.data.objects)
        other,dto=UEFormatImport(UEModelOptions(import_morph_targets=True,reorient_bones=False,import_sockets=False)).import_file_with_dto(path)
        piece=[o for o in set(bpy.data.objects)-before if o.type=='MESH']
        for mesh in piece:
            mesh.data.materials.clear()
            for mi,item in enumerate(dto.lods[0].materials):
                mesh.data.materials.append(skin if 'basebody' in item.material_name.lower() else armor_material(sex,part))
                for face in mesh.data.polygons[item.first_index//3:item.first_index//3+item.num_faces]:face.material_index=mi
            mesh['part']='body';mesh['gender']=sex;mesh['variant']='0103'
        bind_piece(piece,arm,other);meshes+=piece
    for im in bpy.data.images:
        if max(im.size)>768:
            factor=768/max(im.size);im.scale(round(im.size[0]*factor),round(im.size[1]*factor))
    root=bpy.data.objects.new('CharacterOrientation',None);bpy.context.collection.objects.link(root);arm.parent=root
    target=ASSETS/'models'/f'{sex.lower()}-outfit-0103.glb'
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_animations=False,export_extras=True,export_skins=True,export_morph=True,export_materials='EXPORT',export_all_influences=False,export_cameras=False,export_lights=False)
    return {'id':'0103','name':'Expedition armor','url':'/assets/models/'+target.name,'bytes':target.stat().st_size,'vertices':sum(len(o.data.vertices) for o in meshes),'bones':len(arm.data.bones),'notes':'Original 0103 meshes with exposed base skin. Missing dedicated atlases use Body atlas: GF gloves/cape, GM shoulders. Unreal material property exports unavailable.'}

if __name__=='__main__':
    for sex in ('GF','GM'):
        additions=[]
        if '--outfits-only' not in sys.argv:
            for idx in selected:
                result=export_one(sex,'hair',idx);additions.append(result)
        outfit=armor(sex)
        manifest=json.loads((ASSETS/'characters.json').read_text())
        entry=manifest['genders'][sex]
        if additions:entry['hair']=[h for h in entry['hair'] if h['id'] not in selected]+additions
        entry['outfits']=[dict(entry['body'],name='Tailored base'),outfit]
        manifest['limitations']=[s for s in manifest.get('limitations',[]) if not s.startswith('Four head')]
        (ASSETS/'characters.json').write_text(json.dumps(manifest,indent=2))
    print('EXPANSION_COMPLETE',flush=True)
