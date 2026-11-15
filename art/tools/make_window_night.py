"""The window's night view, made for free from the shore's own layers (runs 004 and 011): its night
sky, then the headland's rocks and the sea, with the lighthouse taken out (it stands on the book). Seen through a window, a cut-out's paper rim
and the sky panel's cloud edge would look pasted on, so the rim is trimmed off the headland, the sky's
edge is softened, and the space round it is filled with the sky's own paint, stretched and blurred.
Run from the repo root: python3 art/tools/make_window_night.py"""
from PIL import Image, ImageFilter
import numpy as np

base = 'art/sets/shore-path'
sky = Image.open(f'{base}/layer-1-sky-night.png').convert('RGBA')
land = Image.open(f'{base}/layer-2-headland.png').convert('RGBA')
W, H = land.size

# Behind the sky panel, the sky itself: its inside stretched to the whole view and blurred, so the
# panel's cloud edge melts into the same paint.
alpha = np.array(sky.getchannel('A'))
ys, xs = np.where(alpha > 250)
# A patch to the right of the moon and below it, so the backdrop has no second, blurred moon.
x0, x1 = np.percentile(xs, 58), np.percentile(xs, 88)
y0, y1 = np.percentile(ys, 45), np.percentile(ys, 85)
out = sky.crop((int(x0), int(y0), int(x1), int(y1))).convert('RGB').resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(18)).convert('RGBA')

# The sky panel's edge melts into those colours instead of ending on a cut line.
a = sky.getchannel('A').filter(ImageFilter.MinFilter(71)).filter(ImageFilter.GaussianBlur(50))
sky.putalpha(a)
out.alpha_composite(sky, (0, H - sky.size[1]))

# No lighthouse: it stands on the book, so the window shows the shore it looks out over. Everything
# above the rocks in the tower's columns goes, and the sky shows through.
la = np.array(land)
TOWER = (340, 860)
ROCK_Y = 1068
la[:ROCK_Y, TOWER[0]:TOWER[1], 3] = 0
land = Image.fromarray(la)

# The headland's white paper rim is trimmed off.
a = land.getchannel('A').filter(ImageFilter.MinFilter(41)).filter(ImageFilter.GaussianBlur(2))
land.putalpha(a)
out.alpha_composite(land, (0, 0))
out = out.resize((W // 2, H // 2), Image.LANCZOS)
out.convert('RGB').save('art/room-fx/window-night.png', optimize=True)
print('art/room-fx/window-night.png', out.size)
