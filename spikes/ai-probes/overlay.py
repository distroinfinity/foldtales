import sys
sys.path.append('/Users/manu/Library/Python/3.9/lib/python/site-packages')
import json
from PIL import Image,ImageDraw
res=json.load(open(sys.argv[1])); idx=json.load(open('img/index.json')); out=sys.argv[2]; pick=sys.argv[3].split(',')
items=[(i['name'],r) for i,r in zip(idx,res) if i['name'] in pick and 'joints' in r]
W=4; H=(len(items)+W-1)//W
sheet=Image.new('RGB',(W*300,H*320),'white')
col={'root':'red','spine':'orange','head':'blue','neck':'blue','jaw':'blue','wing':'green','arm':'green','leg':'purple','tail':'brown','other':'gray'}
for k,(nm,r) in enumerate(items):
    im=Image.open(f"img/{nm}.png").convert('RGB'); d=ImageDraw.Draw(im)
    j={x['id']:x for x in r['joints']}
    for x in r['joints']:
        p=j.get(x['parent'])
        if p: d.line([(x['x']*384,x['y']*384),(p['x']*384,p['y']*384)],fill=(255,0,120),width=3)
    for x in r['joints']:
        c=col.get(x['part'],'gray'); d.ellipse([x['x']*384-7,x['y']*384-7,x['x']*384+7,x['y']*384+7],fill=c)
    im=im.resize((300,300)); sheet.paste(im,((k%W)*300,(k//W)*320)); ImageDraw.Draw(sheet).text(((k%W)*300+6,(k//W)*320+302),f"{r['truth']}: {r['label'][:28]} /{r['locomotion']} ({r['name'][:14]})",fill='black')
sheet.save(out)
