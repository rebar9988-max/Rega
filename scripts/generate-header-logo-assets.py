"""Header composition: extract the owner's existing silver artwork without redrawing it.
The original master is never changed. Coordinates include each complete mark/wordmark.
"""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
master = Image.open(root / 'docs/brand/rega24-official-logo-master.png')
for name, bounds in [('symbol', (185, 330, 765, 1055)), ('wordmark', (75, 1060, 880, 1255))]:
    crop = master.crop(bounds)
    for width in ((240, 480) if name == "symbol" else (240, 480, 805)):
        image = crop.resize((width, round(width * crop.height / crop.width)), Image.Resampling.LANCZOS)
        image.save(root / f'public/brand/rega24-header-{name}-{width}.webp', quality=94, method=6)
