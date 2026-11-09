"""Extract source appearance selections, following material pointers and parents.
Reads original exports only; copies required raw packed textures to browser assets.
"""
import argparse,json,shutil
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--source',type=Path,default=Path.home()/'Desktop/Output/Exports/AION2/Content')
p.add_argument('--textures',type=Path,default=Path.home()/'Desktop/AionModels/Aion2/Content')
p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'public/assets')
a=p.parse_args(); out=a.output/'appearance';out.mkdir(parents=True,exist_ok=True)
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def package(ref):
    if isinstance(ref,dict):ref=ref.get('ObjectPath') or ref.get('AssetPathName')
    return (ref or '').split('.')[0].removeprefix('/Game/')
def parameters(ref):
    result={'textures':{},'scalars':{}};seen=set()
    while ref and package(ref) not in seen:
        key=package(ref);seen.add(key);path=a.source/(key+'.json')
        if not path.exists():break
        props=read(path)[0].get('Properties',{})
        for src,dst in [('TextureParameterValues','textures'),('ScalarParameterValues','scalars')]:
            for v in props.get(src,[]):result[dst].setdefault(v['ParameterInfo']['Name'],v['ParameterValue'])
        ref=props.get('Parent')
    return result
copied={}
def copy(ref):
    key=package(ref)
    if not key:return None
    source=a.textures/(key+'.png')
    if not source.exists():return None
    name=source.name.lower();target=out/name
    if name not in copied:shutil.copy2(source,target);copied[name]=str(source)
    return '/assets/appearance/'+name
table=read(a.source/'UnrealData/PcCustomizeFeatureTable_Material.json')[0]['Rows']
presets=read(a.source/'UnrealData/PcCustomizeFeatureTable_PresetFace.json')[0]['Rows']
custom=read(a.output/'customization.json')
catalog={'version':1,'genders':{},'pads':[],'notes':['Native packed textures; web material layering and brow placement are reconstructed approximations.','Source preset table has no faction column; no anatomical race mapping is inferred.']}
for gender,row in [('GF','Female'),('GM','Male')]:
    src=table[row];sets=src['CustomizeFeatureDataSet'];g={'ranges':{},'presets':[]}
    for key,name,param in [('IrisShape','iris','IrisMasks'),('PupilShape','pupils','PupilTex'),('EyebrowType','brows','EyeBrow_NUMBER_Texture'),('EyelashType','lashes','EyelashAO')]:
        g[name]=[]
        for item in sets[key]:
            value=item['Value'];ref=value['MaterialPtr'];params=parameters(ref);url=copy(params['textures'].get(param))
            if not url and key=='EyebrowType' and 'EyeBrow_NUMBER' in params['scalars']:
                url=copy('/Game/Character/Player/Customize/Cstm_EyeBrow_T2A_LAYER'+str(int(params['scalars']['EyeBrow_NUMBER'])))
            if not url:raise ValueError((gender,key,item['Key'],params))
            g[name].append({'id':item['Key'],'label':f'{key.replace("Shape", "").replace("Type", "")} {int(item["Key"]):02d}','texture':url,'sourceMaterial':'/Game/'+package(ref),'scalars':params['scalars']})
    g['skin']=[{'id':v['Key'],'color':'#'+v['Value']['Skin_Color']['Hex'][:6]} for v in sets['SkinColor']]
    for key,r in src['CustomizeValueSettings']['Material'].items():g['ranges'][key]={'min':r['Min'],'mid':r['Mid'],'max':r['Max']}
    for preset in custom['genders'][gender]['presets']:
        native=presets[preset['id']];m=native['MaterialCustomizeData']
        appearance={k:str(m[s]) for k,s in [('irisId','IrisShape_L'),('pupilId','PupilShape_L'),('browId','EyebrowType'),('lashId','EyelashType')]}
        appearance.update({k:m[s] for k,s in [('irisSize','IrisSize_L'),('pupilSize','PupilSize_L')]})
        appearance.update({k:'#'+m[s]['Hex'][:6] for k,s in [('irisColor','IrisColorMid_L'),('irisBorderColor','IrisColorEdge_L'),('scleraColor','ScleraColor_L'),('browColor','EyebrowColor'),('lashColor','EyelashColor_Upper')]})
        g['presets'].append({'id':preset['id'],'label':preset['label'],'faction':None,'thumbnail':None,'sourceIcon':native['Icon']['AssetPathName'],'sourceHead':native['HeadCustomizeData'],'sourceHair':native['HairCustomizeData'],'sourceMaterialValues':m,'appearance':appearance,'note':'Face values on selected head; original head, hairstyle, makeup and asymmetric eye values may differ.'})
    catalog['genders'][gender]=g
for label,x,y,group in [('Face position','Shape_InOut','Shape_UpDown','face'),('Jaw shape','Plastima_Width','Plastima_UpDown','face'),('Chin shape','Chin_Width','Chin_Length','face'),('Eye position','Eye_Dist','Eye_UpDown','eyes'),('Mouth shape','Lip_Width','Lip_Thickness','mouth'),('Ear position','Ear_FwdBwd','Ear_UpDown','ears'),('Mouth corners','LipCorner_InOut','LipCorner_UpDown','mouth')]:
    catalog['pads'].append({'id':x+'_'+y,'label':label,'x':x,'y':y,'group':group})
(a.output/'appearance.json').write_text(json.dumps(catalog,separators=(',',':')),encoding='utf-8')
print(json.dumps({'copiedTextures':len(copied),'bytes':sum((out/k).stat().st_size for k in copied),'counts':{k:{n:len(v[n]) for n in ['iris','pupils','brows','lashes','skin','presets']} for k,v in catalog['genders'].items()}},indent=2))
