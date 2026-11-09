"""Extract compact, traceable AION2 customization data; source files remain untouched.

Run with Python 3. Source paths can be overridden through --source/--output.
PoseAsset data uses sparse TrackPoseInfluenceIndices; it is NOT indexed by Tracks directly.
"""
import argparse
import json
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=Path(r'C:\Users\MyPc\Desktop\Output\Exports\AION2\Content'))
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'public/assets/customization.json')
args=parser.parse_args()
def read(rel): return json.loads((args.source/rel).read_text(encoding='utf-8-sig'))
def vector(d,axes='XYZ'):return [round(float(d.get(a,0)),8) for a in axes]
def label(name):
    names={'ForeHead_Height':'Forehead depth','CheekBone_Height':'Cheekbone depth','AppleZone_Height':'Cheek fullness','CheekBone_UpDown':'Cheekbone height','Chin_Length':'Chin length','Chin_Width':'Chin width','Chin_Forward':'Chin projection','Plastima_UpDown':'Jaw height','Plastima_Width':'Jaw width','PlastimaA_UpDown':'Jawline height','Shape_UpDown':'Face height','Shape_InOut':'Face width','Puff_InOut':'Cheek volume','EyeBrow_UpDown':'Brow height','EyeBrow_Depth':'Brow depth','EyeBrowIn_InOut':'Inner brow spacing','Eye_UpDown':'Eye height','Eye_Dist':'Eye spacing','Eye_Depth':'Eye depth','Eye_Rotate':'Eye tilt','Eye_Size':'Eye size','EyeTail_InOut':'Outer eye width','EyeTail_UpDown':'Outer eye height','EyeHead_UpDown':'Inner eye height','EyeHead_InOut':'Inner eye width','EyeBrowUpper_UpDown':'Upper eyelid height','EyeBrowLower_UpDown':'Lower eyelid height','Nose_Size':'Nose size','Nose_Length':'Nose length','NoseTip_Height':'Nose tip projection','NoseTip_UpDown':'Nose tip height','NoseBridge_Height':'Nose bridge depth','NoseBridge_UpDown':'Nose bridge height','NoseBridgeLow_Height':'Lower bridge depth','NoseBridgeLow_UpDown':'Lower bridge height','Nostril_InOut':'Nostril width','Nostril_UpDown':'Nostril height','Lip_UpDown':'Mouth height','Lip_Width':'Mouth width','Lip_Thickness':'Lip thickness','LipCorner_UpDown':'Mouth corner height','LipCorner_InOut':'Mouth corner width','LipCorner_Depth':'Mouth corner depth','LipLower_Width':'Lower lip width','LipLower_Thickness':'Lower lip thickness','LipUpper_Width':'Upper lip width','LipUpper_Thickness':'Upper lip thickness','LipUpperSide_Thickness':'Upper lip edge','Lip_Height':'Lip projection','LipLower_Height':'Lower lip projection','LipUpper_Height':'Upper lip projection','LipRotation':'Mouth tilt','Ear_UpDown':'Ear height','Ear_Size':'Ear size','Ear_FwdBwd':'Ear projection','Ear_Rotate':'Ear rotation','Earlobe_Size':'Earlobe size'}
    return names.get(name,name.replace('_',' '))
def group(name):
    if name.startswith(('Eye','Brow')):return 'eyes'
    if name.startswith(('Nose','Nostril')):return 'nose'
    if name.startswith('Lip'):return 'mouth'
    if name.startswith('Ear'):return 'ears'
    return 'face'

body=[
 ('Height','Height','uniform',['Root']),
 ('Size_Head','Head size','uniform',['Bip001-Head']),
 ('Length_Neck','Neck length','length',['Bip001-Neck']),
 ('Thick_Neck','Neck width','thickness',['Bip001-Neck']),
 ('Length_UpperArm','Upper arm length','length',['Bip001-L-UpperArm','Bip001-R-UpperArm']),
 ('Length_LowerArm','Forearm length','length',['Bip001-L-Forearm','Bip001-R-Forearm']),
 ('Thick_Upperarm','Upper arm width','thickness',['Bip001-L-UpperArm','Bip001-R-UpperArm']),
 ('Thick_Forearm','Forearm width','thickness',['Bip001-L-Forearm','Bip001-R-Forearm']),
 ('Size_Hand','Hand size','uniform',['Bip001-L-Hand','Bip001-R-Hand']),
 ('Length_Thigh','Thigh length','length',['Bip001-L-Thigh','Bip001-R-Thigh']),
 ('Length_Calf','Calf length','length',['Bip001-L-Calf','Bip001-R-Calf']),
 ('Thick_Quadriceps','Thigh fullness','uniform',['L_Quadriceps','R_Quadriceps']),
 ('Width_Foot','Foot width','thickness',['Bip001-L-Foot','Bip001-R-Foot']),
]

bindings=read('UnrealData/FaceCustomizeParamToWeightCurveData.json')[0]['Properties']
ranges=read('UnrealData/PcCustomizeFeatureTable_Bone.json')[0]['Rows']
source_presets=read('UnrealData/PcCustomizeFeatureTable_PresetFace.json')[0]['Rows']
source_bodies=read('UnrealData/PcCustomizeFeatureTable_PresetBody.json')[0]['Rows']
ui=read('UnrealData/CustomizingUIListTable.json')[0]['Rows']
result={'version':1,'coordinateSpace':'Unreal local additive transforms; translation centimetres, quaternion xyzw, scale offsets around zero','sources':{'faceBindings':'UnrealData/FaceCustomizeParamToWeightCurveData','ranges':'UnrealData/PcCustomizeFeatureTable_Bone','poses':'Character/Player/{GF,GM}/Head/Common/*_Head_Cstm_{PA,Pose}','body':'Native rig names and original ranges; browser approximation, not native RigVM execution'},'genders':{}}
summary={}
for sex,gender,posefile in [('GF','Female','GF_Head_Cstm_PA'),('GM','Male','GM_Head_Cstm_Pose')]:
    src=read(f'Character/Player/{sex}/Head/Common/{posefile}.json')[0]['Properties']
    assert src['bAdditivePose'] is True
    pc=src['PoseContainer']; poses={n:[] for n in pc['PoseFNames']};assigned=set()
    for track,entry in zip(pc['Tracks'],pc['TrackPoseInfluenceIndices']):
        for influence in entry['Influences']:
            pi,ti=influence['PoseIndex'],influence['BoneTransformIndex']
            assert (pi,ti) not in assigned
            assigned.add((pi,ti)); transform=pc['Poses'][pi]['LocalSpacePose'][ti]
            t=vector(transform['Translation']);q=vector(transform['Rotation'],'XYZW');s=vector(transform['Scale3D'])
            if max(map(abs,t+s+q[:3]))<1e-7 and abs(abs(q[3])-1)<1e-7:continue
            poses[pc['PoseFNames'][pi]].append({'bone':track,'t':t,'q':q,'s':s})
    assert len(assigned)==sum(len(p['LocalSpacePose']) for p in pc['Poses'])
    controls=[]; unsupported=[]; rr=ranges[gender]['CustomizeValueSettings']
    for key,mapping in bindings.items():
        if key not in rr['Face']:continue
        missing=[b['CurveName'] for b in mapping if b['CurveName'] not in poses]
        if missing:
            unsupported.append({'id':key,'reason':'Missing source pose','poses':missing})
            continue
        rng=rr['Face'][key]
        control={'id':key,'label':label(key),'group':group(key),'kind':'face','min':rng['Min'],'max':rng['Max'],'mid':rng['Mid'],'reversed':rng['SliderUIRangeType'].endswith('::MaxMin'),'bindings':[]}
        for b in mapping:
            assert b['CurveName'] in poses,(sex,key,b['CurveName'])
            control['bindings'].append({'pose':b['CurveName'],'side':b['ValueUseType'].split('::')[-1].lower()})
        controls.append(control)
    for key,title,op,bones in body:
        if key not in rr['Body']:continue
        rng=rr['Body'][key]
        controls.append({'id':key,'label':title,'group':'body','kind':'body','min':rng['Min'],'max':rng['Max'],'mid':rng['Mid'],'reversed':rng['SliderUIRangeType'].endswith('::MaxMin'),'operation':op,'bones':bones,'approximate':True})
    ids={c['id'] for c in controls if c['kind']=='face'}
    body_ids={c['id'] for c in controls if c['kind']=='body'}
    presets=[]
    for key,p in source_presets.items():
        if p['CustomizeDataKey']!=gender:continue
        values={k:round(float(v),6) for k,v in p['FaceCustomizeData'].items() if k in ids and isinstance(v,(int,float))}
        native_body=source_bodies.get(str(p.get('BodyPresetKey','')),{}).get('BodyCustomizeData',{})
        values.update({k:round(float(v),6) for k,v in native_body.items() if k in body_ids})
        presets.append({'id':key,'label':f'Game preset {key}','values':values,'sourceHead':p.get('HeadCustomizeData'),'sourceBodyKey':p.get('BodyPresetKey'),'note':'Original face and supported body values; appearance catalog resolves original mesh and material selections.'})
    presets.sort(key=lambda p:int(p['id']))
    result['genders'][sex]={'controls':controls,'poses':poses,'presets':presets,'unsupported':unsupported}
    summary[sex]={'face_controls':sum(c['kind']=='face' for c in controls),'body_controls':sum(c['kind']=='body' for c in controls),'poses':len(poses),'bone_deltas':sum(map(len,poses.values())),'source_presets':len(presets),'sparse_entries_validated':len(assigned)}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
print(json.dumps({'bytes':args.output.stat().st_size,'summary':summary},indent=2))
