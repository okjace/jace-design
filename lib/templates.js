import { emojiEl, lineEl, shapeEl, textEl } from './design';

// Built-in templates. Each is a function so every use gets fresh element ids.
const page = (background, elements) => ({ id: Math.random().toString(36).slice(2, 10), background, elements });
const color = (c) => ({ type: 'color', color: c });
const grad = (from, to, angle = 135) => ({ type: 'gradient', from, to, angle });

export const TEMPLATES = [
  {
    id: 'ig-sale', name: 'Big Sale', category: 'Social media', width: 1080, height: 1080,
    make: () => [page(grad('#f093fb', '#f5576c'), [
      shapeEl('ellipse', { x: 640, y: -160, w: 600, h: 600, fill: '#ffffff', opacity: 0.15 }),
      shapeEl('ellipse', { x: -200, y: 700, w: 520, h: 520, fill: '#ffffff', opacity: 0.12 }),
      textEl({ text: 'WEEKEND', x: 90, y: 250, w: 900, fontFamily: 'Bebas Neue', fontSize: 120, color: '#ffffff', align: 'center', letterSpacing: 12 }),
      textEl({ text: 'SALE', x: 90, y: 370, w: 900, fontFamily: 'Archivo Black', fontSize: 260, color: '#ffffff', align: 'center', lineHeight: 1 }),
      shapeEl('rect', { x: 290, y: 690, w: 500, h: 110, fill: '#111111', radius: 55 }),
      textEl({ text: 'UP TO 50% OFF', x: 290, y: 718, w: 500, fontFamily: 'Poppins', fontWeight: 700, fontSize: 44, color: '#ffffff', align: 'center' }),
      textEl({ text: 'jaceo.vercel.app', x: 90, y: 920, w: 900, fontFamily: 'Inter', fontSize: 32, color: '#ffffff', align: 'center', opacity: 0.85 }),
    ])],
  },
  {
    id: 'ig-quote', name: 'Quote', category: 'Social media', width: 1080, height: 1080,
    make: () => [page(color('#fef3c7'), [
      textEl({ text: '“', x: 90, y: 120, w: 300, fontFamily: 'Playfair Display', fontSize: 300, color: '#f97316', lineHeight: 1 }),
      textEl({ text: 'Design is not just what it looks like. Design is how it works.', x: 120, y: 360, w: 840, fontFamily: 'Playfair Display', fontSize: 68, color: '#111111', lineHeight: 1.25 }),
      lineEl({ x: 120, y: 760, w: 140, stroke: '#f97316', strokeWidth: 8 }),
      textEl({ text: 'Someone wise', x: 120, y: 800, w: 600, fontFamily: 'Inter', fontWeight: 700, fontSize: 36, color: '#111111' }),
    ])],
  },
  {
    id: 'story-event', name: 'Event Story', category: 'Social media', width: 1080, height: 1920,
    make: () => [page(grad('#30cfd0', '#330867', 160), [
      emojiEl('🎉', { x: 390, y: 260, w: 300, h: 300, fontSize: 240 }),
      textEl({ text: "YOU'RE INVITED", x: 90, y: 640, w: 900, fontFamily: 'Bebas Neue', fontSize: 150, color: '#ffffff', align: 'center' }),
      textEl({ text: 'Summer Party', x: 90, y: 820, w: 900, fontFamily: 'Pacifico', fontSize: 120, color: '#fde68a', align: 'center' }),
      shapeEl('rect', { x: 140, y: 1120, w: 800, h: 300, fill: '#ffffff', opacity: 0.15, radius: 40 }),
      textEl({ text: 'Saturday · 7 PM\nRooftop Lounge', x: 140, y: 1180, w: 800, fontFamily: 'Poppins', fontSize: 64, color: '#ffffff', align: 'center', lineHeight: 1.4 }),
      textEl({ text: 'RSVP in bio', x: 90, y: 1650, w: 900, fontFamily: 'Inter', fontWeight: 700, fontSize: 44, color: '#ffffff', align: 'center', letterSpacing: 4 }),
    ])],
  },
  {
    id: 'yt-thumb', name: 'Bold Thumbnail', category: 'Video', width: 1280, height: 720,
    make: () => [page(color('#111111'), [
      shapeEl('rect', { x: 700, y: 0, w: 580, h: 720, fill: '#facc15' }),
      shapeEl('triangle', { x: 560, y: 0, w: 300, h: 720, fill: '#facc15', rotation: 0 }),
      textEl({ text: 'I TRIED IT FOR 30 DAYS', x: 60, y: 160, w: 680, fontFamily: 'Archivo Black', fontSize: 92, color: '#ffffff', lineHeight: 1.05, strokeWidth: 0 }),
      emojiEl('🤯', { x: 860, y: 190, w: 340, h: 340, fontSize: 280 }),
      shapeEl('rect', { x: 60, y: 560, w: 260, h: 80, fill: '#ef4444', radius: 12 }),
      textEl({ text: 'NEW', x: 60, y: 572, w: 260, fontFamily: 'Archivo Black', fontSize: 48, color: '#ffffff', align: 'center' }),
    ])],
  },
  {
    id: 'pitch-deck', name: 'Pitch Deck', category: 'Presentations', width: 1920, height: 1080,
    make: () => [
      page(grad('#7c3aed', '#06b6d4'), [
        textEl({ text: 'Project Nova', x: 160, y: 380, w: 1600, fontFamily: 'Poppins', fontWeight: 700, fontSize: 150, color: '#ffffff' }),
        textEl({ text: 'A better way to make things together', x: 160, y: 580, w: 1600, fontFamily: 'Inter', fontSize: 56, color: '#ffffff', opacity: 0.9 }),
      ]),
      page(color('#ffffff'), [
        textEl({ text: 'The problem', x: 160, y: 140, w: 1600, fontFamily: 'Poppins', fontWeight: 700, fontSize: 96, color: '#111111' }),
        shapeEl('rect', { x: 160, y: 300, w: 12, h: 500, fill: '#7c3aed' }),
        textEl({ text: '• Tools are scattered everywhere\n• Sharing work is slow\n• Nothing talks to anything else', x: 220, y: 320, w: 1400, fontFamily: 'Inter', fontSize: 60, color: '#334155', lineHeight: 1.7 }),
      ]),
      page(color('#0f172a'), [
        textEl({ text: 'Thank you', x: 160, y: 420, w: 1600, fontFamily: 'Poppins', fontWeight: 700, fontSize: 140, color: '#ffffff', align: 'center' }),
        textEl({ text: 'hello@example.com', x: 160, y: 620, w: 1600, fontFamily: 'Inter', fontSize: 48, color: '#94a3b8', align: 'center' }),
      ]),
    ],
  },
  {
    id: 'poster-concert', name: 'Concert Poster', category: 'Print', width: 1296, height: 1728,
    make: () => [page(color('#0f0f0f'), [
      shapeEl('ellipse', { x: 248, y: 260, w: 800, h: 800, fill: '#ef4444', gradient: '#f97316' }),
      textEl({ text: 'LIVE', x: 100, y: 520, w: 1096, fontFamily: 'Archivo Black', fontSize: 300, color: '#0f0f0f', align: 'center', lineHeight: 1 }),
      textEl({ text: 'THE MIDNIGHT ECHOES', x: 100, y: 1180, w: 1096, fontFamily: 'Bebas Neue', fontSize: 140, color: '#ffffff', align: 'center', letterSpacing: 6 }),
      textEl({ text: 'FRIDAY 21 NOV · DOORS 8PM · CITY HALL', x: 100, y: 1380, w: 1096, fontFamily: 'Oswald', fontSize: 52, color: '#f97316', align: 'center', letterSpacing: 4 }),
    ])],
  },
  {
    id: 'biz-card', name: 'Business Card', category: 'Print', width: 1050, height: 600,
    make: () => [
      page(color('#111827'), [
        textEl({ text: 'Alex Rivera', x: 80, y: 200, w: 890, fontFamily: 'Poppins', fontWeight: 700, fontSize: 80, color: '#ffffff' }),
        textEl({ text: 'Product Designer', x: 80, y: 310, w: 890, fontFamily: 'Inter', fontSize: 40, color: '#a78bfa' }),
        shapeEl('rect', { x: 80, y: 400, w: 120, h: 8, fill: '#a78bfa' }),
      ]),
      page(color('#ffffff'), [
        textEl({ text: 'alex@example.com\n+1 555 0100\nexample.com', x: 80, y: 180, w: 890, fontFamily: 'Inter', fontSize: 44, color: '#111827', lineHeight: 1.6 }),
        shapeEl('hexagon', { x: 800, y: 380, w: 160, h: 140, fill: '#7c3aed' }),
      ]),
    ],
  },
  {
    id: 'resume', name: 'Clean Resume', category: 'Docs', width: 816, height: 1056,
    make: () => [page(color('#ffffff'), [
      shapeEl('rect', { x: 0, y: 0, w: 816, h: 200, fill: '#1e293b' }),
      textEl({ text: 'Jordan Lee', x: 60, y: 50, w: 700, fontFamily: 'Poppins', fontWeight: 700, fontSize: 56, color: '#ffffff' }),
      textEl({ text: 'Software Engineer · jordan@example.com', x: 60, y: 130, w: 700, fontFamily: 'Inter', fontSize: 22, color: '#cbd5e1' }),
      textEl({ text: 'EXPERIENCE', x: 60, y: 250, w: 700, fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#7c3aed', letterSpacing: 3 }),
      textEl({ text: 'Senior Engineer — Acme (2022–now)\nBuilt the design system used by 40 teams.\n\nEngineer — Startup Co (2019–2022)\nShipped the mobile app from zero to 1M users.', x: 60, y: 290, w: 700, fontFamily: 'Inter', fontSize: 20, color: '#334155', lineHeight: 1.5 }),
      textEl({ text: 'SKILLS', x: 60, y: 560, w: 700, fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#7c3aed', letterSpacing: 3 }),
      textEl({ text: 'TypeScript · React · Node · Design systems · Postgres', x: 60, y: 600, w: 700, fontFamily: 'Inter', fontSize: 20, color: '#334155', lineHeight: 1.5 }),
      textEl({ text: 'EDUCATION', x: 60, y: 700, w: 700, fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#7c3aed', letterSpacing: 3 }),
      textEl({ text: 'B.Sc. Computer Science — State University', x: 60, y: 740, w: 700, fontFamily: 'Inter', fontSize: 20, color: '#334155' }),
    ])],
  },
  {
    id: 'logo-badge', name: 'Logo Badge', category: 'Marketing', width: 500, height: 500,
    make: () => [page(color('#ffffff'), [
      shapeEl('ellipse', { x: 50, y: 50, w: 400, h: 400, fill: '#7c3aed', gradient: '#06b6d4' }),
      shapeEl('star', { x: 175, y: 110, w: 150, h: 150, fill: '#ffffff' }),
      textEl({ text: 'STELLAR', x: 50, y: 290, w: 400, fontFamily: 'Bebas Neue', fontSize: 80, color: '#ffffff', align: 'center', letterSpacing: 6 }),
    ])],
  },
  {
    id: 'invite-wedding', name: 'Elegant Invite', category: 'Print', width: 1500, height: 2100,
    make: () => [page(color('#fdf8f3'), [
      shapeEl('rect', { x: 80, y: 80, w: 1340, h: 1940, fill: '', stroke: '#c8a96a', strokeWidth: 6 }),
      textEl({ text: 'Together with their families', x: 150, y: 400, w: 1200, fontFamily: 'Lora', italic: true, fontSize: 56, color: '#6b5b45', align: 'center' }),
      textEl({ text: 'Sam & Riley', x: 150, y: 620, w: 1200, fontFamily: 'Dancing Script', fontWeight: 700, fontSize: 200, color: '#8a6d3b', align: 'center' }),
      textEl({ text: 'request the pleasure of your company', x: 150, y: 960, w: 1200, fontFamily: 'Lora', fontSize: 56, color: '#6b5b45', align: 'center' }),
      lineEl({ x: 600, y: 1120, w: 300, stroke: '#c8a96a', strokeWidth: 4 }),
      textEl({ text: 'SATURDAY, JUNE 12\nFOUR O’CLOCK IN THE AFTERNOON\nTHE GARDEN HOUSE', x: 150, y: 1220, w: 1200, fontFamily: 'Montserrat', fontSize: 48, color: '#6b5b45', align: 'center', lineHeight: 1.7, letterSpacing: 4 }),
    ])],
  },
  {
    id: 'certificate', name: 'Certificate', category: 'Docs', width: 1123, height: 794,
    make: () => [page(color('#ffffff'), [
      shapeEl('rect', { x: 30, y: 30, w: 1063, h: 734, fill: '', stroke: '#1e3a8a', strokeWidth: 10 }),
      shapeEl('rect', { x: 50, y: 50, w: 1023, h: 694, fill: '', stroke: '#c8a96a', strokeWidth: 3 }),
      textEl({ text: 'CERTIFICATE OF ACHIEVEMENT', x: 100, y: 130, w: 923, fontFamily: 'Montserrat', fontWeight: 700, fontSize: 44, color: '#1e3a8a', align: 'center', letterSpacing: 4 }),
      textEl({ text: 'This certifies that', x: 100, y: 250, w: 923, fontFamily: 'Lora', italic: true, fontSize: 30, color: '#334155', align: 'center' }),
      textEl({ text: 'Your Name', x: 100, y: 310, w: 923, fontFamily: 'Dancing Script', fontWeight: 700, fontSize: 96, color: '#111111', align: 'center' }),
      textEl({ text: 'has completed the course with distinction', x: 100, y: 460, w: 923, fontFamily: 'Lora', fontSize: 30, color: '#334155', align: 'center' }),
      emojiEl('🏅', { x: 501, y: 560, w: 120, h: 120, fontSize: 100 }),
    ])],
  },
  {
    id: 'menu', name: 'Café Menu', category: 'Print', width: 816, height: 1056,
    make: () => [page(color('#1c1917'), [
      textEl({ text: 'Morning Café', x: 60, y: 70, w: 696, fontFamily: 'Pacifico', fontSize: 72, color: '#fbbf24', align: 'center' }),
      textEl({ text: 'COFFEE', x: 80, y: 260, w: 656, fontFamily: 'Oswald', fontSize: 36, color: '#fbbf24', letterSpacing: 6 }),
      textEl({ text: 'Espresso ................. 3\nCappuccino ............. 4\nLatte ...................... 4.5\nCold brew ............... 5', x: 80, y: 320, w: 656, fontFamily: 'Fira Code', fontSize: 26, color: '#f5f5f4', lineHeight: 1.8 }),
      textEl({ text: 'BAKERY', x: 80, y: 600, w: 656, fontFamily: 'Oswald', fontSize: 36, color: '#fbbf24', letterSpacing: 6 }),
      textEl({ text: 'Croissant ................ 3\nBlueberry muffin ...... 3.5\nCinnamon roll .......... 4', x: 80, y: 660, w: 656, fontFamily: 'Fira Code', fontSize: 26, color: '#f5f5f4', lineHeight: 1.8 }),
      emojiEl('☕', { x: 358, y: 900, w: 100, h: 100, fontSize: 80 }),
    ])],
  },
];

export function templateDesign(t) {
  return { width: t.width, height: t.height, pages: t.make(), assets: [] };
}
