import {getDefaultValues,type CustomizationData} from './customization';
import type {AppearanceCatalog} from './appearance-materials';
import type {StudioState} from './studio-types';
/** A preset is one transaction, so undo restores the entire previous look. */
export function nativePresetPatch(state:StudioState,id:string,data:CustomizationData,catalog:AppearanceCatalog):Partial<StudioState>{
 const group=catalog.genders[state.gender],preset=group.presets.find(p=>p.id===id),bones=data.genders[state.gender].presets.find(p=>p.id===id);
 if(!preset||!bones)throw Error('Preset is not available for this character.');
 return {head:preset.head,hair:preset.hair,skin:preset.skin,hairColor:preset.hairColor,eyeColor:String(preset.appearance.IrisColorMid_L??preset.appearance.irisColor??state.eyeColor),pointedEars:preset.pointedEars,values:{...getDefaultValues(data,state.gender),...bones.values},appearance:{...group.defaults,...preset.appearance}};
}
