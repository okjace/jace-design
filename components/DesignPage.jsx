import { filterCss, HEART_PATH, lineBaseline, shapePoints, textLines } from '@/lib/design';

// Renders one page of a design as SVG. Pure (no hooks) so it works on the server and the client.

export function Background({ bg, w, h, pid }) {
  if (bg?.type === 'none') return null;
  if (!bg || bg.type === 'color') return <rect width={w} height={h} fill={bg?.color || '#ffffff'} />;
  if (bg.type === 'gradient') {
    const a = ((bg.angle ?? 135) - 90) * (Math.PI / 180);
    const x = Math.cos(a) / 2;
    const y = Math.sin(a) / 2;
    return (
      <>
        <defs>
          <linearGradient id={`bg-${pid}`} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
            <stop offset="0" stopColor={bg.from} />
            <stop offset="1" stopColor={bg.to} />
          </linearGradient>
        </defs>
        <rect width={w} height={h} fill={`url(#bg-${pid})`} />
      </>
    );
  }
  if (bg.type === 'image') {
    return (
      <>
        <rect width={w} height={h} fill={bg.color || '#ffffff'} />
        <image href={bg.src} width={w} height={h} preserveAspectRatio="xMidYMid slice" opacity={bg.opacity ?? 1} style={{ filter: filterCss(bg.filters) }} />
      </>
    );
  }
  return <rect width={w} height={h} fill="#ffffff" />;
}

function elStyle(el) {
  const s = el.shadow;
  const style = {};
  if (s && s.on) style.filter = `drop-shadow(${s.x ?? 4}px ${s.y ?? 6}px ${s.blur ?? 12}px ${s.color || 'rgba(0,0,0,0.35)'})`;
  if (el.blend && el.blend !== 'normal') style.mixBlendMode = el.blend;
  return Object.keys(style).length ? style : undefined;
}

export function dashArray(el) {
  const sw = el.strokeWidth || 1;
  if (el.borderStyle === 'dashed') return `${sw * 3} ${sw * 2}`;
  if (el.borderStyle === 'dotted') return `0 ${sw * 2}`;
  return undefined;
}

export function gradientVector(angle = 135) {
  const a = (angle - 90) * (Math.PI / 180);
  return { x1: 0.5 - Math.cos(a) / 2, y1: 0.5 - Math.sin(a) / 2, x2: 0.5 + Math.cos(a) / 2, y2: 0.5 + Math.sin(a) / 2 };
}

export function Element({ el, pid }) {
  if (el.hidden) return null;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const transform = el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined;
  const common = { transform, opacity: el.opacity ?? 1, style: elStyle(el), 'data-id': el.id };
  const key = `${pid}-${el.id}`;

  if (el.type === 'text') {
    const lines = textLines(el);
    const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
    const tx = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
    return (
      <g {...common}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
        {el.bgColor ? (() => { const px = el.fontSize * (el.bgPadX ?? 0.25), py = el.fontSize * (el.bgPadY ?? 0.1); return <rect x={el.x - px} y={el.y - py} width={el.w + px * 2} height={el.h + py * 2} rx={Math.min((el.h + py * 2) / 2, el.fontSize * (el.bgRadius ?? 0.2))} fill={el.bgColor} stroke={el.bgBorder || undefined} strokeWidth={el.bgBorder ? Math.max(1, el.fontSize / 16) : undefined} />; })() : null}
        <text
          fontFamily={`"${el.fontFamily}", sans-serif`}
          fontSize={el.fontSize}
          fontWeight={el.fontWeight || 400}
          fontStyle={el.italic ? 'italic' : 'normal'}
          textDecoration={el.underline ? 'underline' : undefined}
          letterSpacing={el.letterSpacing || undefined}
          fill={el.color}
          stroke={el.strokeWidth ? el.stroke : undefined}
          strokeWidth={el.strokeWidth || undefined}
          paintOrder="stroke"
          textAnchor={anchor}
          style={{ whiteSpace: 'pre' }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={tx} y={el.y + lineBaseline(el, i)}>{line || ' '}</tspan>
          ))}
        </text>
      </g>
    );
  }

  if (el.type === 'image') {
    const clip = el.radius ? `clip-${key}` : null;
    const flip = el.flipX || el.flipY ? `translate(${el.flipX ? 2 * el.x + el.w : 0} ${el.flipY ? 2 * el.y + el.h : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})` : undefined;
    return (
      <g {...common}>
        {clip ? (
          <defs>
            <clipPath id={clip}><rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius} /></clipPath>
          </defs>
        ) : null}
        <g clipPath={clip ? `url(#${clip})` : undefined}>
          <image
            href={el.src}
            x={el.x} y={el.y} width={el.w} height={el.h}
            preserveAspectRatio={el.fit === 'contain' ? 'xMidYMid meet' : `${/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(el.focus || '') ? el.focus : 'xMidYMid'} slice`}
            transform={flip}
            style={{ filter: filterCss(el.filters) }}
          />
        </g>
        {el.strokeWidth ? <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius || 0} fill="none" stroke={el.stroke} strokeWidth={el.strokeWidth} /> : null}
      </g>
    );
  }

  if (el.type === 'line') {
    const y = el.y + el.h / 2;
    const sw = el.strokeWidth || 4;
    const head = el.arrow ? sw * 3 : 0;
    return (
      <g {...common}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
        <line x1={el.x} y1={y} x2={el.x + el.w - head * 0.8} y2={y} stroke={el.stroke} strokeWidth={sw} strokeLinecap={el.dash ? 'butt' : 'round'} strokeDasharray={el.dash ? `${sw * 2.5} ${sw * 1.5}` : undefined} />
        {el.arrow ? <polygon points={`${el.x + el.w},${y} ${el.x + el.w - head},${y - head * 0.7} ${el.x + el.w - head},${y + head * 0.7}`} fill={el.stroke} /> : null}
      </g>
    );
  }

  if (el.type === 'draw') {
    // Freehand pen stroke: points are stored 0..1 inside the element's box, so it resizes with it.
    const pts = (el.points || []).map(([px, py]) => `${el.x + px * el.w},${el.y + py * el.h}`).join(' ');
    return (
      <g {...common}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
        <polyline points={pts} fill="none" stroke={el.stroke || '#16181d'} strokeWidth={el.strokeWidth || 6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (el.type === 'shape') {
    const paint = {
      fill: el.fill || 'none', stroke: el.strokeWidth ? el.stroke : 'none', strokeWidth: el.strokeWidth || 0,
      strokeDasharray: el.strokeWidth ? dashArray(el) : undefined, strokeLinecap: el.borderStyle === 'dotted' ? 'round' : undefined,
    };
    let fillDef = null;
    if (el.gradient) {
      paint.fill = `url(#g-${key})`;
      const v = gradientVector(el.gradientAngle ?? 135);
      fillDef = (
        <defs>
          <linearGradient id={`g-${key}`} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
            <stop offset="0" stopColor={el.fill} />
            <stop offset="1" stopColor={el.gradient} />
          </linearGradient>
        </defs>
      );
    }
    let shape;
    if (el.shape === 'rect') shape = <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius || 0} {...paint} />;
    else if (el.shape === 'ellipse') shape = <ellipse cx={cx} cy={cy} rx={el.w / 2} ry={el.h / 2} {...paint} />;
    else if (el.shape === 'heart') shape = <path d={HEART_PATH(el.w, el.h)} transform={`translate(${el.x} ${el.y})`} {...paint} />;
    else {
      const pts = shapePoints(el) || [];
      shape = <polygon points={pts.map(([px, py]) => `${el.x + px},${el.y + py}`).join(' ')} strokeLinejoin="round" {...paint} />;
    }
    return <g {...common}>{fillDef}{shape}</g>;
  }

  return null;
}

/**
 * One page as an SVG. `width` can be a CSS size (e.g. "100%") — the viewBox keeps everything in design units.
 */
export default function DesignPage({ design, page, width = '100%', height, className, style, id, uidPrefix = '' }) {
  const W = design.width;
  const H = design.height;
  const pid = `${uidPrefix}${page.id}`;
  return (
    <svg
      id={id}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
    >
      <Background bg={page.background} w={W} h={H} pid={pid} />
      {page.elements.map((el) => (
        <Element key={el.id} el={el} pid={pid} />
      ))}
    </svg>
  );
}
