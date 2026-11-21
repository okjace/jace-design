"""Draw the Jace Design app icon (same as the website's) and save it as PNG, ICO (Windows) and ICNS (macOS).

    python desktop/packaging/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "jdesign" / "assets"
GREEN = (31, 157, 90, 255)
WHITE = (255, 255, 255)


def draw(size: int = 1024) -> Image.Image:
    s = size / 64  # the website icon is drawn on a 64×64 grid
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=16 * s, fill=GREEN)

    def layer(alpha, paint):
        over = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        paint(ImageDraw.Draw(over), (*WHITE, int(255 * alpha)))
        img.alpha_composite(over)

    layer(0.95, lambda g, c: g.ellipse([13 * s, 13 * s, 31 * s, 31 * s], fill=c))                       # circle
    layer(0.70, lambda g, c: g.rounded_rectangle([34 * s, 14 * s, 52 * s, 32 * s], radius=4 * s, fill=c))  # square
    layer(0.90, lambda g, c: g.polygon([(14 * s, 50 * s), (28 * s, 32 * s), (40 * s, 50 * s)], fill=c))     # triangle
    layer(0.60, lambda g, c: g.chord([36 * s, 36 * s, 52 * s, 64 * s], 180, 360, fill=c))                  # hill
    return img


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    big = draw(1024)
    big.resize((512, 512), Image.LANCZOS).save(ASSETS / "icon.png")
    big.save(ASSETS / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    big.save(ASSETS / "icon.icns")
    print("Icons written to", ASSETS)


if __name__ == "__main__":
    main()
