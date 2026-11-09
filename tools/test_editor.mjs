import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
const file=new URL('../lib/editor-controls.ts',import.meta.url);
let code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
code=code.replaceAll("'./customization'",JSON.stringify(new URL('../lib/customization.ts',import.meta.url).href)).replaceAll("'./studio-types'",JSON.stringify(new URL('../lib/studio-types.ts',import.meta.url).href));
const {toDisplay,fromDisplay,validState,POSITION_PAIRS}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const read=name=>JSON.parse(readFileSync(new URL('../public/assets/'+name,import.meta.url)));
const data=read('customization.json'),catalog=read('characters.json'),appearance=read('appearance.json');
for(const gender of ['GF','GM']){
 for(const c of data.genders[gender].controls){assert.equal(toDisplay(c,c.mid),0);for(const v of [-100,-57,0,14,100]){const raw=fromDisplay(c,v);assert.ok(raw>=c.min-1e-9&&raw<=c.max+1e-9);assert.equal(toDisplay(c,raw),v)}}
 for(const pairs of Object.values(POSITION_PAIRS))for(const pair of pairs)for(const id of [pair.x,pair.y])assert.ok(data.genders[gender].controls.some(c=>c.id===id));
 const state=validState({version:1,gender,head:'bad',hair:'bad',values:{Eye_Size:Infinity},eyeColor:'#123456',appearance:{irisSize:999,pupilSize:-2,browOpacity:9,irisColor:'invalid',browId:'../../bad'}},data,catalog);
 assert.equal(state.version,2);assert.equal(state.head,catalog.genders[gender].heads[0].id);assert.equal(state.values.Eye_Size,0);assert.equal(state.appearance.irisSize,5);assert.equal(state.appearance.pupilSize,0);assert.equal(state.appearance.browOpacity,1);assert.equal(state.appearance.irisColor,'#123456');assert.ok(!state.appearance.browId);
 assert.deepEqual(validState(JSON.parse(JSON.stringify(state)),data,catalog),state);
 for(const kind of ['hair','heads','outfits'])for(const option of catalog.genders[gender][kind])for(const key of ['url','thumbnail'])if(option[key])assert.ok(existsSync(new URL('../public'+option[key],import.meta.url)),option[key]);
 for(const preset of appearance.genders[gender].presets){assert.ok(preset.thumbnail);assert.ok(existsSync(new URL('../public'+preset.thumbnail,import.meta.url)));}
 for(const kind of ['iris','pupils','brows','lashes'])for(const option of appearance.genders[gender][kind])assert.ok(existsSync(new URL('../public'+option.texture,import.meta.url)));
 console.log(gender+': source range mapping, paired controls, preset migration/validation, appearance selections and asset links pass.');
}
