# PSYCH0 — generate PWA icons: pixel-art "P0" glyph on a dark CRT background.
from PIL import Image, ImageDraw, ImageFont
import os

OUT = '/home/z/my-project/public/icons'
os.makedirs(OUT, exist_ok=True)
BG = (10, 10, 12)
LINE = (22, 22, 26)
FG = (255, 92, 0)
FG2 = (0, 224, 200)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def make(size: int, maskable: bool) -> Image.Image:
    img = Image.new('RGB', (size, size), BG)
    d = ImageDraw.Draw(img)
    # CRT scanlines
    step = max(3, size // 96)
    for y in range(0, size, step):
        d.line([(0, y), (size, y)], fill=LINE, width=1)
    # corner brackets — pixel terminal vibe
    m = int(size * 0.14 if maskable else size * 0.07)
    ln = int(size * 0.12)
    w = max(2, size // 64)
    for (x0, y0, dx, dy) in [(m, m, 1, 1), (size - m, m, -1, 1), (m, size - m, 1, -1), (size - m, size - m, -1, -1)]:
        d.line([(x0, y0), (x0 + dx * ln, y0)], fill=FG, width=w)
        d.line([(x0, y0), (x0, y0 + dy * ln)], fill=FG, width=w)
    # the glyph
    fs = int(size * (0.46 if maskable else 0.55))
    f = ImageFont.truetype(FONT, fs)
    text = 'P0'
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1]
    # drop shadow in accent-2 for depth
    off = max(2, size // 128)
    d.text((tx + off, ty + off), text, font=f, fill=FG2)
    d.text((tx, ty), text, font=f, fill=FG)
    return img


for size in (192, 512):
    make(size, False).save(f'{OUT}/icon-{size}.png')
    make(size, True).save(f'{OUT}/icon-maskable-{size}.png')

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f, os.path.getsize(p), 'bytes')
print('ICONS OK')
