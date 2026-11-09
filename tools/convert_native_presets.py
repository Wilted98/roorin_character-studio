"""Convert the exact models referenced by native preset table selections.

Run in background Blender; --heads-only or --hair-only supports staged conversion.
Existing body/outfit manifest entries are retained. Originals/open scenes untouched.
"""
from pathlib import Path
import sys,json
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from shared_glb_images import externalize_images
converter=(HERE/'convert_characters.py').read_text().split("\nmanifest={'version'")[0]
# Bulk conversion stores one audit at the end, avoiding repeated large rewrites.
converter=converter.replace("    (PROJECT/'tools/asset-bone-rest.json').write_text(json.dumps(diagnostics),encoding='utf-8')",'    pass')
exec(converter)
if (HERE/'asset-bone-rest.json').exists():diagnostics=json.loads((HERE/'asset-bone-rest.json').read_text())
appearance=json.loads((ASSETS/'appearance.json').read_text())
report=[]
for sex,group in appearance['genders'].items():
    for part,key,resource in [('head','heads','headResource'),('hair','hair','hairResource')]:
        if '--heads-only' in sys.argv and part!='head':continue
        if '--hair-only' in sys.argv and part!='hair':continue
        choices={p[resource]['id']:p[resource] for p in group['presets']}
        if part in ('head','hair'):
            initial=json.loads((ASSETS/'characters.json').read_text())
            material_rows=json.loads((PROPS/'UnrealData/PcCustomizeFeatureTable_Material.json').read_text(encoding='utf-8-sig'))[0]['Rows']
            native=material_rows['Female' if sex=='GF' else 'Male']['CustomizeFeatureDataSet']['HeadType' if part=='head' else 'HairType']
            by_name={v['Value']['ResourceName']:v['Value'] for v in native}
            for old in initial['genders'][sex][key]:
                name=f'{sex}_{part.title()}_{old["id"]}'
                if old['id'] not in choices:
                    info=by_name.get(name,{})
                    icon=info.get('Icon',{}).get('AssetPathName','').split('.')[0].removeprefix('/Game/')
                    thumbnail=old.get('thumbnail')
                    thumbnail_origin=old.get('thumbnailOrigin','rendered')
                    if icon:
                        source=SOURCE/(icon+'.png')
                        if source.exists():
                            import shutil
                            target=ASSETS/'appearance'/source.name.lower();shutil.copy2(source,target)
                            thumbnail='/assets/appearance/'+target.name
                            thumbnail_origin='game'
                    choices[old['id']]={'id':old['id'],'resource':name,'thumbnail':thumbnail,'thumbnailOrigin':thumbnail_origin}
        # Include old choices to share their embedded images and update thumbnails.
        for idx,res in sorted(choices.items()):
            target=ASSETS/'models'/f'{sex.lower()}-{part}-{idx}.glb'
            current=json.loads((ASSETS/'characters.json').read_text())
            entry=current['genders'][sex]
            option=next((o for o in entry[key] if o['id']==idx),None)
            rebuild='--rebuild' in sys.argv
            if '--resume-material4' in sys.argv and target.exists() and option:
                raw=target.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
                materials=[m for m in doc.get('materials',[]) if m.get('extras',{}).get('role')=='hair']
                if materials and all(m['extras'].get('hairMaterialVersion')==4 for m in materials):rebuild=False
            if not target.exists() or not option or rebuild:
                option=export_one(sex,part,idx)
            assert option is not None,(sex,part,idx)
            shared=externalize_images(target)
            option.update({'thumbnail':res['thumbnail'],'thumbnailOrigin':res.get('thumbnailOrigin','game'),'sourceResource':res['resource'],'bytes':target.stat().st_size})
            entry[key]=[o for o in entry[key] if o['id']!=idx]+[option]
            entry[key].sort(key=lambda o:o['id'])
            current['version']=2
            (ASSETS/'characters.json').write_text(json.dumps(current,indent=2))
            report.append({'gender':sex,'part':part,'id':idx,**shared})
            print('NATIVE_PRESET_ASSET',sex,part,idx,shared,flush=True)
        # Externalize any remaining old options too, avoiding duplicate shared skins.
        current=json.loads((ASSETS/'characters.json').read_text())
        for option in current['genders'][sex][key]:
            target=PROJECT/'public'/option['url'].lstrip('/')
            if target.exists():externalize_images(target);option['bytes']=target.stat().st_size
        (ASSETS/'characters.json').write_text(json.dumps(current,indent=2))
report_name='native-preset-'+('heads' if '--heads-only' in sys.argv else 'hair' if '--hair-only' in sys.argv else 'all')+'-conversion.json'
(HERE/report_name).write_text(json.dumps(report,indent=2))
(HERE/'native-bone-rest.json').write_text(json.dumps(diagnostics),encoding='utf-8')
print('NATIVE_PRESET_CONVERSION_COMPLETE',len(report),flush=True)
