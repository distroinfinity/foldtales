// Summarizes what the headset reported. Usage: node report.mjs
import fs from "node:fs";
const l=fs.readFileSync("spike-telemetry.jsonl","utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const of=k=>l.filter(x=>x.kind===k);
const s=of("session-start").pop(); console.log("Session:",s?`${s.sinceNav}ms after page load, target ${s.frameRate}Hz, rates ${s.rates}, features ${s.features}`:"never started");
console.log("Browser:",of("boot").pop()?.ua??"?");
const perf=of("perf").filter(p=>p.vis==="visible");
for(const lv of [0,1,2,3]){const p=perf.filter(x=>x.load===lv).slice(1);if(!p.length)continue;const f=p.map(x=>x.fps).sort((a,b)=>a-b);
 console.log(`Load ${lv}: n=${p.length} fps median ${f[f.length>>1]} min ${f[0]} | worst frame ${Math.max(...p.map(x=>x.worstMs))}ms | puppets ${p.at(-1).puppets} calls ${p.at(-1).calls} tris ${p.at(-1).tris}`);}
console.log("Room:",JSON.stringify(of("room").pop()??"none"));
console.log("Stage placed:",of("stage-placed").map(x=>x.by).join(", ")||"never");
const d=of("doodle"); const q=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))]};
if(d.length){console.log(`Doodles: ${d.length} | gait p50 ${q(d.map(x=>x.gaitMs),.5)}ms p90 ${q(d.map(x=>x.gaitMs),.9)}ms | rig p50 ${q(d.map(x=>x.rigMs),.5)}ms p90 ${q(d.map(x=>x.rigMs),.9)}ms | finished by ${d.map(x=>x.finishedBy).join(",")}`);
 fs.mkdirSync("doodles",{recursive:true}); d.forEach((x,i)=>fs.writeFileSync(`doodles/${i}-${String(x.label).replace(/\W+/g,"_")}.png`,Buffer.from(x.png,"base64"))); console.log("  read as:",d.map(x=>`${x.label}/${x.locomotion}/${x.joints}j`).join("; "));}
else console.log("Doodles: none");
console.log("Mic:",JSON.stringify(of("mic-granted").pop()??of("mic-failed").pop()??"not tried"),"| upload:",JSON.stringify(of("mic-upload").pop()??"none"));
console.log("Audio out:",JSON.stringify(of("tone").pop()??"not tried"));
console.log("Session visibility:",of("session-visibility").map(x=>x.state).join(" > ")||"no changes","| page:",of("page-visibility").map(x=>x.state).join(" > ")||"no changes");
const e=l.filter(x=>["error","rejection","doodle-failed","doodle-error"].includes(x.kind)); console.log("Errors:",e.length?JSON.stringify(e.slice(0,5)):"none");
