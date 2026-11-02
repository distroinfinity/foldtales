import json,random,sys,os
from PIL import Image,ImageDraw
data,out=sys.argv[1],sys.argv[2]
random.seed(7); idx=[]
for fn in sorted(os.listdir(data)):
    if not fn.endswith('.ndjson'): continue
    rows=[]
    for line in open(os.path.join(data,fn)):
        try: r=json.loads(line)
        except Exception: continue
        if r.get('recognized') and sum(len(s[0]) for s in r['drawing'])>25: rows.append(r)
    for i,r in enumerate(random.sample(rows,min(4,len(rows)))):
        name=f"{fn[:-7]}_{i}"; img=Image.new('RGB',(384,384),'white'); d=ImageDraw.Draw(img)
        for s in r['drawing']:
            pts=[(30+x*324/255,30+y*324/255) for x,y in zip(s[0],s[1])]
            d.line(pts,fill='black',width=4)
        img.save(f"{out}/{name}.png"); idx.append({"name":name,"truth":fn[:-7].replace('_',' ')})
json.dump(idx,open(f"{out}/index.json","w"))
print(len(idx),'images')
