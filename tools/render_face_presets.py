"""Render actual source face pose values on head001; no fictional preset images."""
from pathlib import Path
import bpy,json
from mathutils import Quaternion,Vector,Matrix
HERE=Path(__file__).resolve().parent
exec((HERE/'convert_characters.py').read_text().split("\nmanifest={'version'")[0])
exec((HERE/'render_character_previews.py').read_text().split("\nonly='--test'")[0])
data=json.loads((ASSETS/'customization.json').read_text())

def apply_values(arm,config,values):
    trs={}
    for b in arm.data.bones:
        local=b.parent.matrix_local.inverted()@b.matrix_local if b.parent else b.matrix_local
        t,q,s=local.decompose();trs[b.name]=[local,t,q,s]
    weights={}
    for control in config['controls']:
        if control['kind']!='face':continue
        v=max(control['min'],min(control['max'],values.get(control['id'],control['mid'])))
        for binding in control.get('bindings',[]):
            w=max(0,v if binding['side']=='positive' else -v)
            if w:weights[binding['pose']]=weights.get(binding['pose'],0)+w
    for pose,w in weights.items():
        for d in config['poses'].get(pose,[]):
            if d['bone'] not in trs:continue
            _,t,q,s=trs[d['bone']]
            t+=Vector((d['t'][0],-d['t'][1],d['t'][2]))*(.01*w)
            dq=Quaternion((d['q'][3],-d['q'][0],d['q'][1],-d['q'][2])).normalized()
            dq=Quaternion().slerp(dq,w);trs[d['bone']][2]=(dq@q).normalized()
            for axis in range(3):s[axis]*=max(.05,1+d['s'][axis]*w)
    for name,(rest,t,q,s) in trs.items():arm.pose.bones[name].matrix_basis=rest.inverted()@Matrix.LocRotScale(t,q,s)
    bpy.context.view_layer.update()

for sex in ('GF','GM'):
    config=data['genders'][sex]
    appearance=json.loads((ASSETS/'appearance.json').read_text())
    requested={p['id'] for p in appearance['genders'][sex]['presets']}
    sc,_=scene(sex,'001','004')
    head_meshes=[o for o in bpy.data.objects if o.get('part')=='head']
    arms={o.parent for o in head_meshes}
    for o in head_meshes:bpy.data.objects.remove(o,do_unlink=True)
    for o in arms:
        if o and o.type=='ARMATURE':bpy.data.objects.remove(o,do_unlink=True)
    image_cache.clear();_,meshes,arm=import_model(sex,'head','001')
    center=sc.camera.location.z-.01
    sc.camera.location=(.08,-.78,center+.01);aim(sc.camera,(0,0,center));sc.camera.data.lens=68
    sc.render.resolution_x=256;sc.render.resolution_y=320;sc.cycles.samples=16
    for preset in config['presets']:
        if preset['id'] not in requested:continue
        if any(p['id']==preset['id'] and p.get('thumbnailOrigin')=='game' for p in appearance['genders'][sex]['presets']):continue
        apply_values(arm,config,preset['values'])
        name=f'{sex.lower()}-preset-{preset["id"]}.png';sc.render.filepath=str(ASSETS/'thumbnails'/name);bpy.ops.render.render(write_still=True)
        # Re-read to preserve any simultaneous appearance metadata additions.
        appearance=json.loads((ASSETS/'appearance.json').read_text())
        dest=next(p for p in appearance['genders'][sex]['presets'] if p['id']==preset['id'])
        dest['thumbnail']='/assets/thumbnails/'+name;dest['thumbnailNote']='Actual source facial pose values rendered on head001; source makeup and hair are not represented.'
        (ASSETS/'appearance.json').write_text(json.dumps(appearance,separators=(',',':')))
print('FACE_PRESETS_RENDERED',flush=True)
