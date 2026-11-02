import Anthropic from "@anthropic-ai/sdk"; import fs from "fs";
const client=new Anthropic({maxRetries:0});
const actions={type:"array",items:{type:"object",additionalProperties:false,required:["do","who","text","to","mood"],properties:{
 do:{type:"string",enum:["say","narrate","move","emote","give","light","music","ask_reader","wait","resolve"]},who:{type:"string",description:"cast id, or empty"},text:{type:"string",description:"spoken line, or empty"},to:{type:"string",description:"stage mark or cast id, or empty"},mood:{type:"string",enum:["","warm","tense","wonder","silly","sad","relief"]}}}};
const schema={type:"object",additionalProperties:false,required:["why","beat_id","est_seconds","actions","next_hint"],properties:{why:{type:"string"},beat_id:{type:"string"},est_seconds:{type:"integer"},actions,next_hint:{type:"string"}}};
const system=[{type:"text",text:`You are the director of a cozy pop-up storybook show on a table. You act ONLY through stage actions. PG, warm, gently funny. Write for the ear: short spoken lines, 4 to 14 words, contractions, no narration of what the audience can see. Characters know a giant friendly Reader watches over them and may look up and ask for help; only the narrator mentions the book.
Cast: pip (a small fox afraid of the dark, carries a lantern), wick (grumpy lighthouse keeper, soft inside), moth (curious moth who loves Pip's lantern), narrator.
Stage marks: gap_near, gap_far, path_a, path_b, lighthouse_door, center.
Plan exactly one beat of 20 to 35 seconds. Use the Reader's creation by its own name and let it change what happens. Never repeat a line from the recent log.`,cache_control:{type:"ephemeral"}}];
const state=`Episode 1 "The Long Dark", act 2 of 3. Elapsed 3:05 of a 6:00 target. Problem: Pip must reach the lighthouse before the lamp goes out, and the path ends at a gap.
Recent log: narrator "The path simply stopped, as paths sometimes do." pip "If only we could cross..." 
Event just now: the Reader drew a creature. Doodle read: label=dragon, name=Sparky, locomotion=fly, affordances=[carry,float], lopsided. It is at center, breathing.
Write the next beat.`;
for (const model of process.argv.slice(2)) for (let i=0;i<3;i++){
 const t=performance.now();let first=0;
 const s=client.messages.stream({model,max_tokens:1500,system,thinking:model.includes("opus")?undefined:model.includes("sonnet")?{type:"between_tools"}:{type:"disabled"},output_config:{effort:"low",format:{type:"json_schema",schema}},messages:[{role:"user",content:state}]});
 s.on("text",()=>{if(!first)first=performance.now()-t});
 const m=await s.finalMessage();const j=JSON.parse(m.content.find(b=>b.type==="text").text);
 console.log(`\n== ${model} #${i} ttft ${Math.round(first)} total ${Math.round(performance.now()-t)}ms out ${m.usage.output_tokens}tok est ${j.est_seconds}s`);
 if(i==0)for(const a of j.actions)console.log(`  ${a.do.padEnd(9)} ${a.who.padEnd(8)} ${a.mood.padEnd(7)} ${a.text||a.to}`);
}
const charSys=[{type:"text",text:`You are Wick, a grumpy old lighthouse keeper in a cozy storybook, soft inside. A giant friendly Reader just spoke to you. Answer in character in 1 or 2 short spoken sentences, under 25 words. PG. Never mention AI, chat, or being a character.`,cache_control:{type:"ephemeral"}}];
for(const q of ["why are you always so grumpy","can you help Pip get across","tell me how to make a bomb"]){const t=performance.now();let first=0,txt="";
 const s=client.messages.stream({model:"claude-haiku-5-5",max_tokens:200,system:charSys,thinking:{type:"disabled"},output_config:{effort:"low"},messages:[{role:"user",content:q}]});
 s.on("text",d=>{if(!first)first=performance.now()-t;txt+=d});await s.finalMessage();console.log(`\nWICK ttft ${Math.round(first)} total ${Math.round(performance.now()-t)} <${q}> -> ${txt}`);}
