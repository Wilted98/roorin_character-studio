export type Gender = 'GF' | 'GM';
export type AssetOption = {id:string;name:string;url:string;thumbnail?:string};
export type CharacterCatalog = {genders:Record<Gender,{body:{url:string};heads:AssetOption[];hair:AssetOption[];outfits?:AssetOption[];beards?:AssetOption[]}>};
export type StudioState = {
 version:2; name:string; gender:Gender; head:string; hair:string; outfit:string;
 skin:string; hairColor:string; eyeColor:string; dyeColor:string; values:Record<string,number>;
 appearance:Record<string,unknown>; pointedEars:boolean; pose:'neutral'|'relaxed';
 motion:'creator-idle'|'normal-idle'|'still'; animationPaused:boolean; physics:boolean;
};
export const INITIAL:StudioState={version:2,name:'My character',gender:'GF',head:'001',hair:'004',outfit:'base',skin:'#ffffff',hairColor:'#52372b',eyeColor:'#92aeb6',dyeColor:'#ffffff',values:{},appearance:{},pointedEars:false,pose:'relaxed',motion:'creator-idle',animationPaused:false,physics:true};
