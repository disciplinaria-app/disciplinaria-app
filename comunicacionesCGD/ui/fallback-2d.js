/* ═══════════════════════════════════════════════════════════════
   fallback-2d.js — el mismo flujo en SVG plano cuando no hay WebGL.

   No es una versión degradada del contenido: son las mismas doce
   etapas, los mismos carriles, las mismas compuertas y el MISMO
   panel. Lo único que falta es el relieve.
   ═══════════════════════════════════════════════════════════════ */

const NS = 'http://www.w3.org/2000/svg';
const el = (t, attrs = {}) => {
  const n = document.createElementNS(NS, t);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

const ANCHO_COL = 132;
const ALTO_CARRIL = 74;
const MARGEN_IZQ = 184;
const MARGEN_SUP = 44;

export function construirFallback2D(contenedor, { etapas, grafo, config, alSeleccionar }) {
  contenedor.textContent = '';

  const carriles = grafo.ordenCarriles;
  const nCols = grafo.escala.columnas;
  const ancho = MARGEN_IZQ + nCols * ANCHO_COL + 60;
  const alto = MARGEN_SUP + carriles.length * ALTO_CARRIL + 60;

  const svg = el('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    width: '100%',
    role: 'group',
    'aria-label': 'Diagrama del flujo de comunicaciones por carriles',
    style: 'min-width:860px',
  });

  const defs = el('defs');
  const marca = el('marker', {
    id: 'f2d-punta', viewBox: '0 0 8 8', refX: '6.5', refY: '4',
    markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse',
  });
  marca.appendChild(el('path', { d: 'M0 0.8 L7.4 4 L0 7.2 z', fill: '#fff' }));
  defs.appendChild(marca);
  svg.appendChild(defs);

  const yCarril = {};
  const porId = Object.fromEntries(config.carriles.map((c) => [c.id, c]));

  /* ── bandas de carril ── */
  carriles.forEach((id, i) => {
    const y = MARGEN_SUP + i * ALTO_CARRIL;
    yCarril[id] = y + ALTO_CARRIL / 2;
    const c = porId[id];

    svg.appendChild(el('rect', {
      x: 8, y, width: ancho - 16, height: ALTO_CARRIL - 6,
      rx: 8, fill: 'rgba(255,255,255,.055)',
      stroke: 'rgba(255,255,255,.12)', 'stroke-width': 1,
    }));
    svg.appendChild(el('rect', {
      x: 8, y, width: 5, height: ALTO_CARRIL - 6, rx: 2.5, fill: c.color,
    }));

    const t = el('text', {
      x: 24, y: y + 22, fill: 'rgba(255,255,255,.92)',
      'font-size': 11.5, 'font-weight': 600, 'font-family': 'Archivo, sans-serif',
    });
    t.textContent = `${c.n}. ${c.nombre.length > 30 ? c.nombre.slice(0, 29) + '…' : c.nombre}`;
    if (c.nombre.length > 30) { const ti = el('title'); ti.textContent = c.nombre; t.appendChild(ti); }
    svg.appendChild(t);

    const s = el('text', {
      x: 24, y: y + 38, fill: 'rgba(255,255,255,.5)',
      'font-size': 9.5, 'font-family': 'IBM Plex Mono, monospace',
      'letter-spacing': '.08em',
    });
    s.textContent = c.verificacion === 'sin-verificar' ? 'SIN VERIFICAR' : c.verificacion.toUpperCase();
    svg.appendChild(s);
  });

  /* ── posiciones ── */
  const xCol = (t) => MARGEN_IZQ + t * ANCHO_COL + ANCHO_COL / 2;
  const pos = {};
  for (const n of grafo.nodos) {
    pos[n.id] = {
      x: xCol(n.t) + (n.tOffset || 0) * 0.55,
      y: yCarril[n.carril] + (n.zOffset || 0) * 0.42,
    };
  }
  const resolver = (clave) => {
    if (clave.includes('#')) {
      const [id, carril] = clave.split('#');
      return { x: pos[id]?.x ?? 0, y: yCarril[carril] ?? 0 };
    }
    return pos[clave];
  };

  /* ── rutas ── */
  const gRutas = el('g');
  for (const r of grafo.rutas) {
    const a = resolver(r.de), b = resolver(r.a);
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2;
    const d = Math.abs(a.y - b.y) < 2 || Math.abs(a.x - b.x) < 2
      ? `M${a.x} ${a.y} L${b.x} ${b.y}`
      : `M${a.x} ${a.y} L${mx} ${a.y} L${mx} ${b.y} L${b.x} ${b.y}`;
    const p = el('path', {
      d, fill: 'none',
      stroke: r.destacada ? '#F2C94C' : (r.tipo === 'comunicacion' ? '#BFD9F5' : '#fff'),
      'stroke-width': r.destacada ? 2.2 : (r.tipo === 'principal' ? 1.8 : 1.2),
      'stroke-opacity': r.tipo === 'principal' || r.destacada ? 0.9 : 0.55,
      'stroke-linejoin': 'round',
      'marker-end': 'url(#f2d-punta)',
    });
    if (r.tipo === 'retorno') p.setAttribute('stroke-dasharray', '5 4');
    if (r.etiqueta) { const ti = el('title'); ti.textContent = r.etiqueta; p.appendChild(ti); }
    gRutas.appendChild(p);
  }
  svg.appendChild(gRutas);

  /* ── compuertas y terminales ── */
  for (const n of grafo.nodos) {
    const p = pos[n.id];
    if (n.tipo === 'compuerta') {
      const g = el('g');
      g.appendChild(el('rect', {
        x: p.x - 7, y: p.y - 7, width: 14, height: 14,
        transform: `rotate(45 ${p.x} ${p.y})`,
        fill: '#fff', stroke: '#1B2A41', 'stroke-width': 1,
      }));
      const ti = el('title'); ti.textContent = n.pregunta; g.appendChild(ti);
      const t = el('text', {
        x: p.x, y: p.y + 24, 'text-anchor': 'middle',
        fill: 'rgba(255,255,255,.8)', 'font-size': 8.5,
        'font-family': 'Archivo, sans-serif',
      });
      t.textContent = n.pregunta;
      g.appendChild(t);
      svg.appendChild(g);
    } else if (n.tipo === 'terminal') {
      const g = el('g');
      g.appendChild(el('rect', {
        x: p.x - 34, y: p.y - 11, width: 68, height: 22, rx: 3,
        fill: 'rgba(16,36,70,.7)', stroke: 'rgba(255,255,255,.3)',
      }));
      const t = el('text', {
        x: p.x, y: p.y + 4, 'text-anchor': 'middle', fill: '#fff',
        'font-size': 9.5, 'font-weight': 600, 'letter-spacing': '.1em',
        'font-family': 'Archivo, sans-serif',
      });
      t.textContent = n.rotulo;
      g.appendChild(t);
      const ti = el('title'); ti.textContent = n.rotulo + ' — ' + n.detalle; g.appendChild(ti);
      svg.appendChild(g);
    }
  }

  /* ── etapas (clicables y enfocables) ── */
  const nodosEl = new Map();
  for (const n of grafo.nodos) {
    if (n.tipo !== 'etapa') continue;
    const e = etapas.find((x) => x.id === n.id);
    const p = pos[n.id];

    const g = el('g', {
      role: 'button', tabindex: '0', class: 'f2d-nodo',
      'aria-label': `${n.id}. ${e.titulo}`,
      style: 'cursor:pointer',
    });

    const caja = el('rect', {
      x: p.x - 50, y: p.y - 19, width: 100, height: 38, rx: 6,
      fill: '#fff', stroke: 'rgba(16,36,70,.25)',
    });
    g.appendChild(caja);

    const id = el('text', {
      x: p.x - 42, y: p.y - 5, fill: '#5B6B83',
      'font-size': 9, 'font-weight': 600, 'font-family': 'IBM Plex Mono, monospace',
    });
    id.textContent = n.id;
    g.appendChild(id);

    const tx = el('text', {
      x: p.x - 42, y: p.y + 10, fill: '#1B2A41',
      'font-size': 9.5, 'font-weight': 600, 'font-family': 'Archivo, sans-serif',
    });
    tx.textContent = n.rotulo.length > 20 ? n.rotulo.slice(0, 19) + '…' : n.rotulo;
    g.appendChild(tx);

    if (n.plazo) {
      const b = el('g');
      b.appendChild(el('rect', {
        x: p.x + 10, y: p.y - 30, width: 46, height: 15, rx: 7.5,
        fill: n.plazo.interpretativo ? '#fff' : '#F2C94C',
        stroke: n.plazo.interpretativo ? '#EB5757' : 'none',
        'stroke-dasharray': n.plazo.interpretativo ? '3 2' : 'none',
      }));
      const bt = el('text', {
        x: p.x + 33, y: p.y - 19.5, 'text-anchor': 'middle', fill: '#1B2A41',
        'font-size': 8.5, 'font-weight': 600, 'font-family': 'IBM Plex Mono, monospace',
      });
      bt.textContent = n.plazo.texto;
      b.appendChild(bt);
      g.appendChild(b);
    }

    const ti = el('title'); ti.textContent = e.titulo; g.appendChild(ti);

    const activar = () => alSeleccionar(n.id);
    g.addEventListener('click', activar);
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activar(); }
    });

    svg.appendChild(g);
    nodosEl.set(n.id, caja);
  }

  const envoltorio = document.createElement('div');
  envoltorio.style.cssText = 'overflow:auto;padding-bottom:12px';
  envoltorio.appendChild(svg);

  const nota = document.createElement('p');
  nota.style.cssText = 'margin:10px 2px 0;font-size:12px;color:rgba(255,255,255,.72);max-width:72ch;line-height:1.5';
  nota.textContent = 'Este navegador no tiene WebGL disponible, así que el flujo se muestra en diagrama plano. '
    + 'El contenido jurídico es exactamente el mismo: toca o enfoca una etapa para abrir su panel.';
  envoltorio.appendChild(nota);

  contenedor.appendChild(envoltorio);

  const estilo = document.createElement('style');
  estilo.textContent =
    '.f2d-nodo rect:first-child{transition:stroke .14s ease,fill .14s ease}' +
    '.f2d-nodo:focus-visible rect:first-child{stroke:#F2C94C;stroke-width:2.5}' +
    '.f2d-nodo[data-activo] rect:first-child{stroke:#F2C94C;stroke-width:2.5}' +
    '@media (hover:hover) and (pointer:fine){.f2d-nodo:hover rect:first-child{stroke:#1B2A41;stroke-width:2}}';
  contenedor.appendChild(estilo);

  return {
    marcar(id) {
      for (const [k, r] of nodosEl) r.parentElement.toggleAttribute('data-activo', k === id);
    },
  };
}
