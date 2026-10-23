"""IU-01: anonymised labelling sheets. Each tile carries only a running index — no URL, caption, slug or channel — so
the visual label is made from pixels alone. Sheets are written OUTSIDE the repository (publisher pixels)."""
import argparse, json, os, sys
from PIL import Image, ImageDraw

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', required=True, help='JSON list of {"idx","path"}')
    ap.add_argument('--out', required=True)
    ap.add_argument('--cols', type=int, default=6)
    ap.add_argument('--rows', type=int, default=5)
    ap.add_argument('--tile', type=int, default=300)
    a = ap.parse_args()
    if os.path.realpath(a.out).startswith(os.path.realpath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))):
        sys.exit('REFUSED: publisher pixels stay outside the repository')
    os.makedirs(a.out, exist_ok=True)
    items = json.load(open(a.index))
    per = a.cols * a.rows
    T = a.tile
    for s in range(0, len(items), per):
        sheet = Image.new('RGB', (a.cols * T, a.rows * (T + 18)), 'white')
        d = ImageDraw.Draw(sheet)
        for k, it in enumerate(items[s:s + per]):
            try:
                im = Image.open(it['path']); im.seek(0); im = im.convert('RGB')
            except Exception as e:
                im = Image.new('RGB', (T, T), 'red')
            w, h = im.size
            im.thumbnail((T - 6, T - 6))
            x, y = (k % a.cols) * T, (k // a.cols) * (T + 18)
            sheet.paste(im, (x + 3, y + 18 + (T - im.size[1]) // 2))
            d.rectangle([x, y, x + T - 1, y + T + 17], outline=(180, 180, 180))
            d.text((x + 4, y + 3), f"#{it['idx']}  {w}x{h}", fill=(200, 0, 0))
        sheet.save(os.path.join(a.out, f"sheet-{s // per:03d}.jpg"), quality=85)
    print(len(items), 'items', (len(items) + per - 1) // per, 'sheets')

if __name__ == '__main__':
    main()
