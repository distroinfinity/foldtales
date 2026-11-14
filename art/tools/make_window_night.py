"""The window's night view, made for free from the shore's own layers (runs 004 and 011): its night
sky, then the headland with the lighthouse and the sea. Seen through a window, a cut-out's paper rim
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
x0, x1 = np.percentile(xs, 12), np.percentile(xs, 88)
y0, y1 = np.percentile(ys, 12), np.percentile(ys, 88)
out = sky.crop((int(x0), int(y0), int(x1), int(y1))).convert('RGB').resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(18)).convert('RGBA')

# The sky panel's edge melts into those colours instead of ending on a cut line.
a = sky.getchannel('A').filter(ImageFilter.MinFilter(71)).filter(ImageFilter.GaussianBlur(50))
sky.putalpha(a)
out.alpha_composite(sky, (0, H - sky.size[1]))

# The headland's white paper rim is trimmed off.
a = land.getchannel('A').filter(ImageFilter.MinFilter(41)).filter(ImageFilter.GaussianBlur(2))
land.putalpha(a)
out.alpha_composite(land, (0, 0))
out = out.resize((W // 2, H // 2), Image.LANCZOS)
out.convert('RGB').save('art/fx/window-night.png', optimize=True)
print('art/fx/window-night.png', out.size)
