import { filterCss, HEART_PATH, lineBaseline, maskPath, shapePoints, textLines } from '@/lib/design';
import { BLOCK_TYPES, SPEAKER, blockShapes, curveGeometry, resolveBg } from '@/lib/blocks';

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

export function Element({ el, pid, media }) {
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
    const font = {
      fontFamily: `"${el.fontFamily}", sans-serif`, fontSize: el.fontSize, fontWeight: el.fontWeight || 400,
      fontStyle: el.italic ? 'italic' : 'normal', letterSpacing: el.letterSpacing || undefined, style: { whiteSpace: 'pre' },
    };
    // Curved text follows an arc; otherwise one line per tspan.
    let arc = null;
    if (el.curve) {
      const g = curveGeometry(el);
      const a0 = g.up ? -Math.PI / 2 - g.angle / 2 : Math.PI / 2 + g.angle / 2;
      const a1 = g.up ? -Math.PI / 2 + g.angle / 2 : Math.PI / 2 - g.angle / 2;
      arc = `M${g.cx + g.r * Math.cos(a0)} ${g.cy + g.r * Math.sin(a0)}A${g.r} ${g.r} 0 ${g.angle > Math.PI ? 1 : 0} ${g.up ? 1 : 0} ${g.cx + g.r * Math.cos(a1)} ${g.cy + g.r * Math.sin(a1)}`;
    }
    const words = (dx = 0, dy = 0) => (arc
      ? <textPath href={`#cv-${key}`} startOffset="50%" textAnchor="middle">{(el.uppercase ? el.text.toUpperCase() : el.text).replace(/\s*\n\s*/g, ' ')}</textPath>
      : lines.map((line, i) => <tspan key={i} x={tx + dx} y={el.y + lineBaseline(el, i) + dy}>{line || ' '}</tspan>));
    const shadowCopies = el.longShadow?.length ? Math.min(60, Math.round(el.longShadow.length)) : 0;
    const gid = `tg-${key}`;
    const gv = el.textGradient ? gradientVector(el.textGradient.angle ?? 90) : null;
    return (
      <g {...common}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
        {el.bgColor ? (() => { const px = el.fontSize * (el.bgPadX ?? 0.25), py = el.fontSize * (el.bgPadY ?? 0.1); return <rect x={el.x - px} y={el.y - py} width={el.w + px * 2} height={el.h + py * 2} rx={Math.min((el.h + py * 2) / 2, el.fontSize * (el.bgRadius ?? 0.2))} fill={el.bgColor} stroke={el.bgBorder || undefined} strokeWidth={el.bgBorder ? Math.max(1, el.fontSize / 16) : undefined} />; })() : null}
        {arc || gv ? (
          <defs>
            {arc ? <path id={`cv-${key}`} d={arc} /> : null}
            {gv ? (
              <linearGradient id={gid} x1={gv.x1} y1={gv.y1} x2={gv.x2} y2={gv.y2}>
                <stop offset="0" stopColor={el.textGradient.from || el.color} />
                <stop offset="1" stopColor={el.textGradient.to || el.color} />
              </linearGradient>
            ) : null}
          </defs>
        ) : null}
        {shadowCopies ? (
          // Long / 3D shadow: copies stepping down-right behind the text.
          <g fill={el.longShadow.color || 'rgba(0,0,0,0.35)'}>
            {Array.from({ length: shadowCopies }, (_, s) => (
              <text key={s} {...font} textAnchor={anchor} transform={arc ? `translate(${shadowCopies - s} ${shadowCopies - s})` : undefined}>{arc ? words() : words(shadowCopies - s, shadowCopies - s)}</text>
            ))}
          </g>
        ) : null}
        <text
          {...font}
          textDecoration={el.underline && !arc ? 'underline' : undefined}
          fill={gv ? `url(#${gid})` : el.color}
          stroke={el.strokeWidth ? el.stroke : undefined}
          strokeWidth={el.strokeWidth || undefined}
          paintOrder="stroke"
          textAnchor={anchor}
          style={{ whiteSpace: 'pre', filter: el.glow?.size ? `drop-shadow(0 0 ${el.glow.size / 2}px ${el.glow.color || '#3ddc84'}) drop-shadow(0 0 ${el.glow.size}px ${el.glow.color || '#3ddc84'})` : undefined }}
        >
          {words()}
        </text>
      </g>
    );
  }

  if (el.type === 'image') {
    const mask = maskPath(el.mask, el.w, el.h);
    const clip = el.radius || mask ? `clip-${key}` : null;
    const flip = el.flipX || el.flipY ? `translate(${el.flipX ? 2 * el.x + el.w : 0} ${el.flipY ? 2 * el.y + el.h : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})` : undefined;
    const par = el.fit === 'fill' ? 'none' : el.fit === 'contain' ? 'xMidYMid meet' : `${/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(el.focus || '') ? el.focus : 'xMidYMid'} slice`;
    const c = el.crop && el.natW && el.natH ? el.crop : null;
    return (
      <g {...common}>
        {clip ? (
          <defs>
            <clipPath id={clip}>
              {mask ? <path d={mask} transform={`translate(${el.x} ${el.y})`} /> : <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius} />}
            </clipPath>
          </defs>
        ) : null}
        <g clipPath={clip ? `url(#${clip})` : undefined}>
          {c ? (
            // Cropped: show only part of the picture.
            <g transform={flip}>
              <svg x={el.x} y={el.y} width={el.w} height={el.h} viewBox={`${c.x * el.natW} ${c.y * el.natH} ${c.w * el.natW} ${c.h * el.natH}`} preserveAspectRatio={par}>
                <image href={el.src} width={el.natW} height={el.natH} style={{ filter: filterCss(el.filters) }} />
              </svg>
            </g>
          ) : (
            <image href={el.src} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio={par} transform={flip} style={{ filter: filterCss(el.filters) }} />
          )}
        </g>
        {el.strokeWidth ? (mask ? <path d={mask} transform={`translate(${el.x} ${el.y})`} fill="none" stroke={el.stroke} strokeWidth={el.strokeWidth} /> : <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius || 0} fill="none" stroke={el.stroke} strokeWidth={el.strokeWidth} />) : null}
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

  if (el.type === 'video') {
    const clip = `vclip-${key}`;
    const frag = el.trimStart || el.trimEnd ? `#t=${Number(el.trimStart) || 0}${el.trimEnd ? `,${el.trimEnd}` : ''}` : '';
    if (media && el.src) {
      // Presenting, websites, the view page: a real player.
      return (
        <g {...common}>
          <foreignObject x={el.x} y={el.y} width={el.w} height={el.h}>
            <video xmlns="http://www.w3.org/1999/xhtml" src={`${el.src}${frag}`} poster={el.poster || undefined} controls playsInline preload="metadata"
              autoPlay={media === 'autoplay'} muted={!!el.muted} loop={!!el.loop}
              style={{ width: '100%', height: '100%', objectFit: el.fit === 'contain' ? 'contain' : 'cover', borderRadius: el.radius || 0, background: '#000', display: 'block' }} />
          </foreignObject>
        </g>
      );
    }
    const r = Math.min(el.w, el.h) * 0.11;
    return (
      <g {...common}>
        <defs><clipPath id={clip}><rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius || 0} /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#000" />
          {el.poster ? <image href={el.poster} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio={el.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} /> : null}
        </g>
        <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.5)" />
        <polygon points={`${cx - r * 0.35},${cy - r * 0.5} ${cx - r * 0.35},${cy + r * 0.5} ${cx + r * 0.55},${cy}`} fill="#fff" />
      </g>
    );
  }

  if (el.type === 'audio') {
    if (media && el.src) {
      return (
        <g {...common}>
          <foreignObject x={el.x} y={el.y} width={Math.max(el.w, 260)} height={Math.max(el.h, 54)}>
            <audio xmlns="http://www.w3.org/1999/xhtml" src={el.src} controls preload="metadata" loop={!!el.loop} style={{ width: '100%' }} />
          </foreignObject>
        </g>
      );
    }
    const size = Math.min(el.w, el.h);
    const s = size / 24 * 0.55;
    return (
      <g {...common}>
        <circle cx={cx} cy={cy} r={size / 2} fill={el.color || '#1f9d5a'} />
        <g transform={`translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`}>
          <path d={SPEAKER.body} fill="#fff" />
          <path d={SPEAKER.waves} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    );
  }

  if (BLOCK_TYPES.includes(el.type)) {
    // Charts, tables and QR codes (laid out in lib/blocks.js).
    return (
      <g {...common}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
        {blockShapes(el).map((s, i) => <Piece key={i} s={s} />)}
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

function Piece({ s }) {
  if (s.k === 'rect') return <rect x={s.x} y={s.y} width={Math.max(0, s.w)} height={Math.max(0, s.h)} rx={s.r || 0} fill={s.fill || 'none'} stroke={s.stroke || undefined} strokeWidth={s.stroke ? s.sw : undefined} opacity={s.opacity} />;
  if (s.k === 'line') return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} />;
  if (s.k === 'path') return <path d={s.d} fill={s.fill || 'none'} stroke={s.stroke || undefined} strokeWidth={s.stroke ? s.sw : undefined} strokeLinejoin="round" strokeLinecap="round" opacity={s.opacity} />;
  if (s.k === 'text') {
    return (
      <text x={s.x} y={s.y} fontFamily={`"${s.font || 'Inter'}", sans-serif`} fontSize={s.size} fontWeight={s.weight || 400} fill={s.color} textAnchor={s.anchor || 'start'} style={{ whiteSpace: 'pre' }}>{s.text}</text>
    );
  }
  return null;
}

/**
 * One page as an SVG. `width` can be a CSS size (e.g. "100%") — the viewBox keeps everything in design units.
 */
export default function DesignPage({ design, page, width = '100%', height, className, style, id, uidPrefix = '', media }) {
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
      <Background bg={resolveBg(design, page)} w={W} h={H} pid={pid} />
      {page.elements.map((el) => (
        <Element key={el.id} el={el} pid={pid} media={media} />
      ))}
    </svg>
  );
}
