import Anthropic from "@anthropic-ai/sdk"; import fs from "fs";
const client=new Anthropic({maxRetries:0});
const dir=process.argv[2], models=process.argv[3].split(","), ctx="A fox named Pip stands at a gap in a path on a paper-theater stage and said: 'If only we could cross...'";
const schema={type:"object",additionalProperties:false,required:["label","confidence","alternatives","role","locomotion","joints","affordances","name","safe"],properties:{
 label:{type:"string"},confidence:{type:"number"},alternatives:{type:"array",items:{type:"string"}},
 role:{type:"string",enum:["character","object","scenery"]},
 locomotion:{type:"string",enum:["walk","fly","slither","hop","roll","sail","sway","static"]},
 joints:{type:"array",items:{type:"object",additionalProperties:false,required:["id","part","x","y","parent"],properties:{id:{type:"integer"},part:{type:"string",enum:["root","spine","head","jaw","wing","arm","leg","tail","neck","other"]},x:{type:"number"},y:{type:"number"},parent:{type:"integer"}}}},
 affordances:{type:"array",items:{type:"string",enum:["carry","span_gap","climb","float","light","shelter","block","bounce","none"]}},
 name:{type:"string"},safe:{type:"boolean"}}};
const system=`You read hand-drawn doodles for a paper puppet theater. Say what the drawing is and give a simple 2D puppet rig for it. Coordinates are normalized to the image: x and y from 0 to 1, y down. Use 3 to 8 joints placed ON the drawn lines. The root joint has parent -1 and sits at the body's center of mass. Each limb gets a joint where it attaches and, if long, one at its tip. Inanimate objects get a root and at most 2 more. Give a short friendly name. Doodles are rough, so guess generously. Set safe=false only for sexual, hateful or violent imagery.`;
const idx=JSON.parse(fs.readFileSync(`${dir}/index.json`));
const results=[];
async function one(model,item){
  const data=fs.readFileSync(`${dir}/${item.name}.png`).toString("base64");
  const t=performance.now();
  try{
    const r=await client.messages.create({model,max_tokens:1200,system,
      thinking: model.includes("opus")?undefined:(model.includes("sonnet")?{type:"between_tools"}:{type:"disabled"}),
      output_config:{effort:"low",format:{type:"json_schema",schema}},
      messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/png",data}},{type:"text",text:`Scene: ${ctx}`}]}]});
    const ms=performance.now()-t; const txt=r.content.find(b=>b.type==="text")?.text;
    const j=JSON.parse(txt);
    results.push({model,name:item.name,truth:item.truth,ms:Math.round(ms),in:r.usage.input_tokens,out:r.usage.output_tokens,...j});
  }catch(e){results.push({model,name:item.name,truth:item.truth,ms:Math.round(performance.now()-t),error:String(e.message||e).slice(0,160)});}
}
for(const m of models){ for(const it of idx){ await one(m,it); } }
fs.writeFileSync(process.argv[4],JSON.stringify(results,null,1));
for(const m of models){const rs=results.filter(r=>r.model===m&&!r.error).map(r=>r.ms).sort((a,b)=>a-b);const errs=results.filter(r=>r.model===m&&r.error);
 const q=p=>rs[Math.min(rs.length-1,Math.floor(p*rs.length))];
 const ok=results.filter(r=>r.model===m&&!r.error&&(r.label.toLowerCase().includes(r.truth.split(' ').pop())||r.alternatives.slice(0,0).length));
 console.log(m,"n",rs.length,"err",errs.length,"p50",q(.5),"p90",q(.9),"max",rs.at(-1),"strictLabelHit",ok.length,errs[0]?.error||"");}
