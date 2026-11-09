"""Verify added assets and create genuine rendered thumbnail previews."""
from pathlib import Path
import json,sys
import bpy
from mathutils import Vector,Quaternion
HERE=Path(__file__).resolve().parent
exec((HERE/'render_character_previews.py').read_text().split("\nonly='--test'")[0])

def relaxed_pose(sex):
    data={}
    for arm in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
        for side in ('L','R'):
            name=f'Bip001-{side}-UpperArm';child=f'Bip001-{side}-Forearm'
            bone=arm.data.bones.get(name);end=arm.data.bones.get(child)
            if not bone or not end:continue
            direction=(end.head_local-bone.head_local).normalized()
            # Relax shoulders with enough clearance for the native torso/armor.
            target=Vector((.24 if direction.x>0 else -.24,-.06,-1)).normalized()
            delta=direction.rotation_difference(target)
            parent=bone.parent.matrix_local.to_quaternion() if bone.parent else Quaternion()
            local=parent.inverted()@delta@parent
            q=bone.matrix_local.to_quaternion()
            pb=arm.pose.bones[name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=q.inverted()@delta@q
            data[name]={'rotation':[local.x,local.y,local.z,local.w]}
    bpy.context.view_layer.update();return data

if __name__=='__main__':
    poses={'version':1,'description':'Authored static relaxed presentation pose derived from native skeleton; not a game animation. Apply rotation delta before each native bone local rest quaternion.','application':'q_local = deltaQuaternion * restQuaternion; synchronize matching bone names across modules.','genders':{}}
    additions=('101','201','205','301','305','311','401','412')
    for sex in ('GF','GM'):
        sc,_=scene(sex,'001','004',True);poses['genders'][sex]=relaxed_pose(sex)
        sc.cycles.samples=16;sc.render.filepath=str(ASSETS/'thumbnails'/f'{sex.lower()}-outfit-base.png');bpy.ops.render.render(write_still=True)
        if '--pose-only' in sys.argv:continue
        for idx in additions:
            sc,_=scene(sex,'001',idx)
            # Slightly wider portrait accommodates long/up-swept native silhouettes.
            center=sc.camera.location.z-.01
            sc.camera.location=(.42,-1.05,center+.02);aim(sc.camera,(0,0,center-.035))
            sc.camera.data.lens=68;sc.cycles.samples=16
            sc.render.filepath=str(ASSETS/'thumbnails'/f'{sex.lower()}-hair-{idx}.png');bpy.ops.render.render(write_still=True)
        sc,_=scene(sex,'001','004',True)
        for o in list(bpy.data.objects):
            if o.get('part')=='body':bpy.data.objects.remove(o,do_unlink=True)
        bpy.ops.import_scene.gltf(filepath=str(ASSETS/'models'/f'{sex.lower()}-outfit-0103.glb'))
        relaxed_pose(sex);sc.cycles.samples=16
        sc.render.filepath=str(ASSETS/'thumbnails'/f'{sex.lower()}-outfit-0103.png');bpy.ops.render.render(write_still=True)
        manifest=json.loads((ASSETS/'characters.json').read_text())
        for item in manifest['genders'][sex]['hair']:
            if item['id'] in additions:item['thumbnail']=f'/assets/thumbnails/{sex.lower()}-hair-{item["id"]}.png'
        for item in manifest['genders'][sex]['outfits']:item['thumbnail']=f'/assets/thumbnails/{sex.lower()}-outfit-{item["id"]}.png'
        (ASSETS/'characters.json').write_text(json.dumps(manifest,indent=2))
    (ASSETS/'relaxed-pose.json').write_text(json.dumps(poses,indent=2))
    print('EXPANSION_PREVIEWS_COMPLETE',flush=True)
