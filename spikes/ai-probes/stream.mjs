import Anthropic from "@anthropic-ai/sdk"; import fs from "fs";
const client=new Anthropic({maxRetries:0});
const dir=process.argv[2], model=process.argv[3], outFile=process.argv[4];
const schema={type:"object",additionalProperties:false,required:["label","alternatives","role","locomotion","confidence","joints","affordances","name","safe"],properties:{
 label:{type:"string"},alternatives:{type:"array",items:{type:"string"}},
 role:{type:"string",enum:["character","object","scenery"]},
 locomotion:{type:"string",enum:["walk","fly","slither","hop","roll","sail","sway","static"]},confidence:{type:"number"},
 joints:{type:"array",items:{type:"object",additionalProperties:false,required:["id","part","x","y","parent"],properties:{id:{type:"integer"},part:{type:"string",enum:["root","spine","head","jaw","wing","arm","leg","tail","neck","other"]},x:{type:"number"},y:{type:"number"},parent:{type:"integer"}}}},
 affordances:{type:"array",items:{type:"string",enum:["carry","span_gap","climb","float","light","shelter","block","bounce","none"]}},
 name:{type:"string"},safe:{type:"boolean"}}};
const system=[{type:"text",text:`You read a hand-drawn doodle for a paper puppet theater. A person drew it quickly with a finger, so it is rough.
Judge the drawing on what it looks like. The scene is only a hint about why they drew it. Do not assume the drawing is a character already in the scene, and never name it after one.
label: the plain everyday noun for what it depicts (for example "dragon", "bridge", "hot air balloon"), one or two words. alternatives: 2 or 3 other plain nouns it could be.
role and locomotion: how it would move if it came alive. Things with wings or balloons fly. Animals with legs walk. Long legless bodies slither. Buildings, plants and tools are static or sway.
joints: a simple 2D puppet rig. x and y are 0 to 1 across the image, y down. Use 3 to 8 joints placed ON drawn lines. The root has parent -1 and sits at the center of the body. Limbs, wings and tails get a joint where they attach and one at the tip. Inanimate objects use a root and at most 2 more.
affordances: only what this thing would really let a small fox do.
name: a short fresh friendly name. safe: false only for sexual, hateful or violent imagery.`,cache_control:{type:"ephemeral"}}];
const ctx="A fox stands at a gap in a path and says: 'If only we could cross...'";
const idx=JSON.parse(fs.readFileSync(`${dir}/index.json`)); const out=[];
for(const item of idx){
 const data=fs.readFileSync(`${dir}/${item.name}.png`).toString("base64"); const t=performance.now(); let first=0,loco=0,buf="";
 try{
  const s=client.messages.stream({model,max_tokens:1200,system,thinking:model.includes("sonnet")?{type:"between_tools"}:{type:"disabled"},
   output_config:{effort:"low",format:{type:"json_schema",schema}},
   messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/png",data}},{type:"text",text:`Scene hint: ${ctx}`}]}]});
  s.on("text",d=>{buf+=d; if(!first)first=performance.now()-t; if(!loco&&/"locomotion"\s*:\s*"[a-z]+"/.test(buf))loco=performance.now()-t;});
  const m=await s.finalMessage(); const j=JSON.parse(m.content.find(b=>b.type==="text").text);
  out.push({model,name:item.name,truth:item.truth,ttft:Math.round(first),tLoco:Math.round(loco),ms:Math.round(performance.now()-t),in:m.usage.input_tokens,cr:m.usage.cache_read_input_tokens,out:m.usage.output_tokens,...j});
 }catch(e){out.push({model,name:item.name,truth:item.truth,error:String(e.message||e).slice(0,200)})}
}
fs.writeFileSync(outFile,JSON.stringify(out,null,1));
const ok=out.filter(x=>!x.error); const q=(k,p)=>{const a=ok.map(x=>x[k]).sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(p*a.length))]};
const syn={bird:["bird"],airplane:["airplane","plane","jet"],bridge:["bridge"],cat:["cat"],dragon:["dragon"],"hot air balloon":["balloon"],ladder:["ladder"],snake:["snake","serpent"],tree:["tree"]};
const hit=x=>syn[x.truth].some(w=>x.label.toLowerCase().includes(w)); const hit3=x=>hit(x)||x.alternatives.some(a=>syn[x.truth].some(w=>a.toLowerCase().includes(w)));
console.log(model,"n",ok.length,"err",out.length-ok.length,"| ttft p50/p90",q("ttft",.5),q("ttft",.9),"| locomotion known p50/p90",q("tLoco",.5),q("tLoco",.9),"| full rig p50/p90",q("ms",.5),q("ms",.9),"| top1",ok.filter(hit).length,"top3",ok.filter(hit3).length,"of",ok.length,"| avg out tok",Math.round(ok.reduce((a,x)=>a+x.out,0)/ok.length),"| err:",out.find(x=>x.error)?.error||"-");
const miss=ok.filter(x=>!hit(x)).map(x=>`${x.truth}->${x.label}`);console.log(" misses:",miss.join("; "));
