from pathlib import Path
HERE=Path(__file__).resolve().parent.parent/'tools'
s=(HERE/'convert_characters.py').read_text().split("\nmanifest={'version'")[0];exec(s)
added,meshes,arm=import_model('GF','head','001')
print('UV_AUDIT',[(o.name,[(uv.name,len(uv.data)) for uv in o.data.uv_layers]) for o in meshes],flush=True)
