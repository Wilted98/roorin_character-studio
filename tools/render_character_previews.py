"""Render web thumbnails from the exported GLBs, verifying reload in Blender."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
PROJECT=Path(__file__).resolve().parents[1]
ASSETS=PROJECT/'public/assets'
manifest=json.loads((ASSETS/'characters.json').read_text())
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;aim(o,(0,0,1.4))
def scene(sex,head,hair,full=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for part in (f'{sex.lower()}-body',f'{sex.lower()}-head-{head}',f'{sex.lower()}-hair-{hair}'):
        bpy.ops.import_scene.gltf(filepath=str(ASSETS/'models'/(part+'.glb')))
    sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
    sc.world=bpy.data.worlds.new('Studio');sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.036,.055,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.3
    area('Key',(-2,-3,3.4),250,3,(1,.87,.76));area('Fill',(2,-1.5,2),170,2.5,(.65,.8,1));area('Rim',(0,1.5,2.8),350,2,(.55,.7,1))
    camera=bpy.data.cameras.new('Portrait');co=bpy.data.objects.new('Portrait',camera);bpy.context.collection.objects.link(co);sc.camera=co
    bpy.context.view_layer.update()
    meshes=[o for o in sc.objects if o.type=='MESH' and o.get('part') and len(o.data.vertices)>0];bbox=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    top=max(v.z for v in bbox);bottom=min(v.z for v in bbox)
    print('BOUNDS',sex,top,bottom,flush=True)
    if full:co.location=(0,-4,(top+bottom)/2);camera.lens=55;aim(co,(0,0,(top+bottom)/2));sc.render.resolution_x=600;sc.render.resolution_y=900
    else:
        head_objs=[o for o in meshes if o.get('part')=='head'];hb=[o.matrix_world@v.co for o in head_objs for v in o.data.vertices]
        center=(max(v.z for v in hb)+min(v.z for v in hb))/2
        co.location=(.035,-1.3,center+.01);camera.lens=65;aim(co,(0,0,center));sc.render.resolution_x=320;sc.render.resolution_y=400
    sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
    sc.view_settings.view_transform='AgX'
    return sc,{'height':top-bottom,'top':top,'bottom':bottom}

only='--test' in sys.argv
for sex,entry in manifest['genders'].items():
    sc,bounds=scene(sex,'001','001',True);sc.render.filepath=str(PROJECT/'tools'/f'{sex.lower()}-full-preview.png');bpy.ops.render.render(write_still=True);entry['bounds']=bounds
    if only:break
    for key,part in [('heads','head'),('hair','hair')]:
        for option in entry[key]:
            sc,_=scene(sex,option['id'] if part=='head' else '001',option['id'] if part=='hair' else '001')
            fn=f'{sex.lower()}-{part}-{option["id"]}.png';sc.render.filepath=str(ASSETS/'thumbnails'/fn);bpy.ops.render.render(write_still=True)
            option['thumbnail']='/assets/thumbnails/'+fn
    (ASSETS/'characters.json').write_text(json.dumps(manifest,indent=2))
print('RENDER_COMPLETE')
