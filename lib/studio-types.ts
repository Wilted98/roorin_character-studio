export type Gender = "GF" | "GM";
export type AssetOption = {id: string; name: string; url: string; thumbnail?: string};
export type CharacterCatalog = {genders: Record<Gender, {body: {url: string}; heads: AssetOption[]; hair: AssetOption[]}>};
export type StudioState = {version: 1; name: string; gender: Gender; head: string; hair: string; skin: string; hairColor: string; eyeColor: string; values: Record<string, number>};
export const INITIAL: StudioState = {version:1, name:"My character", gender:"GF", head:"001", hair:"004", skin:"#ffffff", hairColor:"#52372b", eyeColor:"#92aeb6", values:{}};
