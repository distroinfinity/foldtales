import { execFileSync } from "node:child_process"; import fs from "node:fs";
const cli=(d,a,j)=>{const t=Date.now();const o=execFileSync("node",["node_modules/@iwsdk/cli/dist/cli.js",d,a,...(j?["--input-json",JSON.stringify(j)]:[]),"--raw"],{encoding:"utf8",timeout:40000});return JSON.parse(o)};
const log=()=>fs.readFileSync("spike-telemetry.jsonl","utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const last=k=>log().filter(x=>x.kind===k).pop(); const wait=ms=>new Promise(r=>setTimeout(r,ms));
fs.writeFileSync("spike-telemetry.jsonl","");
cli("browser","reload"); await wait(5000);
cli("xr","enter"); await wait(1500); cli("xr","set-input-mode",{mode:"hand"}); await wait(2000);
console.log("placed:",JSON.stringify(last("stage-placed")));
const h="hand-right",c={x:0,y:1.45,z:-0.4},step=[];
for(let i=0;i<=16;i++){const a=i/16*Math.PI*2;step.push({position:{x:c.x+0.09*Math.cos(a),y:c.y+0.05*Math.sin(a),z:c.z},anchor:"index-tip",duration:0.08,...(i==0?{pinch:{value:1,at:"arrival"}}:{})});}
step.push({pinch:0,duration:0.1});step.push({poseId:"open",duration:0.15});
const seq=cli("xr","run-sequence",{device:h,steps:step});
console.log("sequence ok:",!!seq,"warnings:",JSON.stringify(seq.warnings||[]).slice(0,200),"selects:",JSON.stringify(seq.selectEvents||seq.events||"").slice(0,160));
await wait(4000);
const d=last("doodle"); if(d){const png=d.png;delete d.png;console.log("doodle:",JSON.stringify(d));fs.writeFileSync("doodle.png",Buffer.from(png,"base64"));}
const stage=last("stage-placed").position,yaw=Math.atan2(0-stage[0],0-stage[2]),L=[-0.18,0.03,0.08];
const wx=stage[0]+L[0]*Math.cos(yaw)+L[2]*Math.sin(yaw),wz=stage[2]-L[0]*Math.sin(yaw)+L[2]*Math.cos(yaw),wy=stage[1]+L[1];
for(let n=1;n<=3;n++){
 cli("xr","run-sequence",{device:h,steps:[{position:{x:wx,y:wy+0.12,z:wz},anchor:"index-tip",poseId:"point",duration:0.3},{position:{x:wx,y:wy,z:wz},anchor:"index-tip",duration:0.2},{position:{x:wx,y:wy+0.12,z:wz},anchor:"index-tip",duration:0.2}]});
 await wait(4500); console.log("level:",JSON.stringify(last("load-level")),"perf:",JSON.stringify(last("perf")));
}
execFileSync("node",["node_modules/@iwsdk/cli/dist/cli.js","browser","screenshot","--output-file",process.cwd()+"/shot3.png"],{encoding:"utf8",timeout:40000}); console.log("shot saved");
console.log("errors:",JSON.stringify(log().filter(x=>["error","rejection","doodle-failed","doodle-error"].includes(x.kind)).slice(0,4)));
// Regression: the other hand pinching and letting go while a line is being drawn must not freeze the page.
const LH="hand-left", R="hand-right", P=(x)=>({x,y:1.4,z:-0.35});
cli("xr","set-input-mode",{mode:"hand"});
const before=log().filter(x=>x.kind==="perf").length;
cli("xr","set-transform",{device:R,position:P(0.1),anchor:"index-tip",orientation:"auto"});
cli("xr","set-transform",{device:LH,position:P(-0.1),anchor:"index-tip",orientation:"auto"});
cli("xr","set-select-value",{device:R,value:1,duration:0.1}); await wait(300);
cli("xr","set-select-value",{device:LH,value:1,duration:0.1}); await wait(300);
cli("xr","set-select-value",{device:LH,value:0,duration:0.1});
for(let i=0;i<14;i++){cli("xr","animate-to",{device:R,position:{x:0.1+Math.sin(i)*0.05,y:1.4+i*0.004,z:-0.35},anchor:"index-tip",duration:0.25});await wait(200);}
cli("xr","set-select-value",{device:R,value:0,duration:0.1}); await wait(5000);
console.log("two-hand: perf reports after",log().filter(x=>x.kind==="perf").length-before,"| frame errors",log().filter(x=>x.kind==="frame-error").length,"| uncaught",log().filter(x=>x.kind==="error").length);
