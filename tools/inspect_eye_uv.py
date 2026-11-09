import sys,numpy as np,json
from pathlib import Path
sys.path.insert(0,str(Path.home()/'AppData/Roaming/Blender Foundation/Blender/5.2/extensions/user_default'))
from io_scene_ueformat.importer.import_context import UEFormatImport
from io_scene_ueformat.options import UEModelOptions
_,d=UEFormatImport(UEModelOptions()).import_file_with_dto(Path.home()/'Desktop/AionModels/Aion2/Content/Character/Player/GF/Head/GF_Head_001/GF_Head_001.uemodel')
l=d.lods[0]
for m in l.materials:
 ids=np.unique(l.indices.reshape(-1)[m.first_index:m.first_index+m.num_faces*3])
 if 'Eye' not in m.material_name:continue
 ps=l.vertices[ids]; uv=l.uvs[0][ids]
 print(m.material_name,'n',len(ids),'pos',ps.min(axis=0),ps.max(axis=0),'uv',uv.min(axis=0),uv.max(axis=0))
 front=np.argsort(ps[:,1])[:10]
 print('front uv',uv[front].tolist())
