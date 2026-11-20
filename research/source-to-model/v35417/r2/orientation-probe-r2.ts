/**
 * v3.54.17 R2 §4 — the audit's orientation probe (orientation-probe.ts, sha256 415572183a20…) re-run against the PRODUCTION
 * orientationOf after the fix: the same model and the same four sketches, copied verbatim below. The audit's own copy of
 * the old function gave UNDECIDED for different eaves (3 m / 2 m, the lower body hidden on the left) and AS_LABELLED for
 * the equal-eaves control; the fixed function must give AS_LABELLED for both, each body read only where it alone stands.
 *   npx vite-node research/source-to-model/v35417/r2/orientation-probe-r2.ts
 */
import { orientationOf } from '../../../../packages/analysis-service/src/consult/massing/ops.js'
import type { CanonicalBuildingModel } from '@buildapp/model'
// ---- verbatim from the audit's probe ----
const walls:any[]=[];const wallRings:any[]=[];
function ring(id:string,x0:number,x1:number,z0:number,z1:number){let q=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];let ids=[];for(let i=0;i<4;i++){let w=id+'-'+i;ids.push(w);walls.push({id:w,kind:'EXTERIOR',start:{x:q[i][0],z:q[i][1]},end:{x:q[(i+1)%4][0],z:q[(i+1)%4][1]}})}wallRings.push({id,levelId:'ground',wallIds:ids})}
ring('main',0,10,0,6);ring('garage',10,14,0,4);const model={walls,wallRings,roofs:[],roofPlanes:[]};
const rect=(x0:number,x1:number,y0:number,y1:number)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function sketches(garageBottom:number){return [
{facade:'FRONT',frameId:'front',groundRow:100,walls:[rect(0,100,70,100),rect(100,140,garageBottom,100)],roofs:[rect(0,100,40,70),rect(100,140,garageBottom-2,garageBottom)]},
{facade:'REAR',frameId:'rear',groundRow:100,walls:[rect(40,140,70,100),rect(0,40,garageBottom,100)],roofs:[rect(40,140,40,70),rect(0,40,garageBottom-2,garageBottom)]},
{facade:'RIGHT',frameId:'right',groundRow:100,walls:[rect(0,60,70,100),rect(0,40,garageBottom,100)],roofs:[[[0,70],[30,40],[60,70]],rect(0,40,garageBottom-2,garageBottom)]},
{facade:'LEFT',frameId:'left',groundRow:100,walls:[rect(0,60,70,100)],roofs:[[[0,70],[30,40],[60,70]]]}
]}
// ---- end verbatim ----
const run = (garageBottom: number) => orientationOf(sketches(garageBottom) as never, model as unknown as CanonicalBuildingModel, (f: string) => f as never)
const different = run(80)
const equal = run(70)
process.stdout.write(`${JSON.stringify({ scope: 'production orientationOf after R2 on the audit probe geometry (not a full host)', differentEaves: different, equalEavesControl: equal }, null, 1)}\n`)
if (different.assignment !== 'AS_LABELLED' || equal.assignment !== 'AS_LABELLED') throw new Error(`R2 probe: expected AS_LABELLED twice, got ${different.assignment} / ${equal.assignment}`)
