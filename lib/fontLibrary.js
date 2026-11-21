// A big list of free Google Fonts, grouped by style. Any other Google Font can still be added by name.
const sans = `Inter, Geist, Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway, Nunito, Nunito Sans, Work Sans, Rubik, Mulish,
Noto Sans, Source Sans 3, PT Sans, Ubuntu, Fira Sans, Barlow, Barlow Condensed, Manrope, DM Sans, Space Grotesk, Outfit, Plus Jakarta Sans,
Urbanist, Lexend, Sora, Figtree, Onest, Karla, Josefin Sans, Quicksand, Cabin, Heebo, Hind, Kanit, Titillium Web, Exo 2, Archivo,
Archivo Narrow, Oswald, Roboto Condensed, Assistant, Red Hat Display, Albert Sans, Be Vietnam Pro, Public Sans, IBM Plex Sans, Mukta,
Prompt, Varela Round, Comfortaa, Questrial, Maven Pro, Signika, Asap, Catamaran, Overpass, Jost, Epilogue, Chivo, Saira, M PLUS Rounded 1c,
Zen Kaku Gothic New, Encode Sans, Atkinson Hyperlegible, Inclusive Sans, Instrument Sans, Schibsted Grotesk, Hanken Grotesk, Golos Text`;
const serif = `Playfair Display, Lora, Merriweather, Roboto Slab, Libre Baskerville, EB Garamond, Cormorant Garamond, Crimson Text, PT Serif,
Source Serif 4, Noto Serif, Bitter, Arvo, Zilla Slab, Domine, Spectral, Cardo, Old Standard TT, Vollkorn, Alegreya, Frank Ruhl Libre,
DM Serif Display, DM Serif Text, Prata, Cinzel, Bodoni Moda, Fraunces, Newsreader, Literata, Gelasio, Rozha One, Abhaya Libre, Marcellus,
Josefin Slab, Instrument Serif, Young Serif, Libre Caslon Text, Gilda Display, Yeseva One, Playfair, Crimson Pro, Sorts Mill Goudy`;
const display = `Bebas Neue, Anton, Archivo Black, Abril Fatface, Alfa Slab One, Righteous, Bungee, Bungee Shade, Black Ops One, Russo One,
Bangers, Lilita One, Fredoka, Luckiest Guy, Titan One, Passion One, Paytone One, Staatliches, Teko, Fjalla One, Ultra, Monoton, Audiowide,
Orbitron, Press Start 2P, Silkscreen, VT323, Rubik Mono One, Rubik Glitch, Rubik Bubbles, Bowlby One, Chango, Shrikhand, Coda, Unbounded,
Syne, Big Shoulders Display, Climate Crisis, Dela Gothic One, Krona One, Michroma, Bricolage Grotesque, Changa One, Holtwood One SC,
Faster One, Fascinate, Creepster, Nosifer, Eater, Pirata One, UnifrakturMaguntia, Cinzel Decorative, Limelight, Poiret One, Megrim,
Codystar, Bungee Inline, Londrina Solid, Sigmar, Gravitas One, Chewy, Boogaloo, Bubblegum Sans, Baloo 2, Carter One`;
const hand = `Pacifico, Lobster, Dancing Script, Caveat, Permanent Marker, Great Vibes, Satisfy, Sacramento, Shadows Into Light,
Indie Flower, Amatic SC, Kalam, Patrick Hand, Gloria Hallelujah, Architects Daughter, Covered By Your Grace, Handlee, Rock Salt,
Homemade Apple, Reenie Beanie, Nothing You Could Do, Allura, Alex Brush, Parisienne, Tangerine, Yellowtail, Kaushan Script, Courgette,
Cookie, Damion, Marck Script, Mr Dafoe, Herr Von Muellerhoff, Pinyon Script, Mrs Saint Delafield, Italianno, Ms Madi, Birthstone,
Comforter, Nanum Pen Script, Gochi Hand, Schoolbell, Coming Soon, Just Another Hand, Sue Ellen Francisco, Waiting for the Sunrise,
Caveat Brush, Rock Salt, Kristi, La Belle Aurore, Zeyada, Monsieur La Doulaise, Lobster Two, Leckerli One, Grand Hotel, Merienda`;
const mono = `Fira Code, JetBrains Mono, Source Code Pro, Roboto Mono, IBM Plex Mono, Space Mono, Ubuntu Mono, Inconsolata, Courier Prime,
DM Mono, Geist Mono, Red Hat Mono, Overpass Mono, Anonymous Pro, Cousine, Martian Mono, Azeret Mono, Major Mono Display, Share Tech Mono`;

const split = (s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];

export const FONT_CATEGORIES = [
  { id: 'sans', name: 'Sans serif', fonts: split(sans) },
  { id: 'serif', name: 'Serif', fonts: split(serif) },
  { id: 'display', name: 'Display', fonts: split(display) },
  { id: 'hand', name: 'Handwriting', fonts: split(hand) },
  { id: 'mono', name: 'Monospace', fonts: split(mono) },
];

export const ALL_LIBRARY_FONTS = [...new Set(FONT_CATEGORIES.flatMap((c) => c.fonts))];

export function categoryOf(font) {
  return FONT_CATEGORIES.find((c) => c.fonts.includes(font))?.id || 'sans';
}

/** A tiny stylesheet that only contains the letters needed to draw the font's own name (fast previews). */
export function previewHref(family) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&text=${encodeURIComponent(family + 'Aa')}&display=swap`;
}
