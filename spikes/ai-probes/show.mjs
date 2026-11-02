import fs from "fs"; const r=JSON.parse(fs.readFileSync(process.argv[2]));
for(const x of r){console.log(x.name.padEnd(20),String(x.ms).padStart(5),x.error?("ERR "+x.error):`${x.label} | alt: ${x.alternatives.join(",")} | ${x.role}/${x.locomotion} | joints ${x.joints.length} | ${x.affordances.join(",")} | "${x.name}" | ${x.out}tok`)}
const ok=r.filter(x=>!x.error);console.log("avg in/out",Math.round(ok.reduce((a,x)=>a+x.in,0)/ok.length),Math.round(ok.reduce((a,x)=>a+x.out,0)/ok.length));
