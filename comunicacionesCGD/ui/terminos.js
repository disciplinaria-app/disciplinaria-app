/* ═══════════════════════════════════════════════════════════════
   terminos.js — conteo ilustrativo de días hábiles en Colombia.

   Los festivos NO van en una tabla 2026–2027: se calculan, porque la
   regla es determinista y una tabla caduca sin avisar.

   Fuentes de la regla:
   · Ley 51 de 1983 («ley Emiliani»), arts. 1 y 2: traslada al lunes
     siguiente los festivos de Reyes, San José, San Pedro y San Pablo,
     Asunción, Día de la Raza, Todos los Santos e Independencia de
     Cartagena; y los de origen pascual Ascensión, Corpus Christi y
     Sagrado Corazón. No traslada Año Nuevo, 1 de mayo, 20 de julio,
     7 de agosto, Inmaculada Concepción ni Navidad, ni Jueves y
     Viernes Santos.
   · Pascua por el algoritmo gregoriano anónimo (Meeus/Jones/Butcher).

   Y, sobre todo: esto es ilustrativo. El conteo que vale es el del
   despacho. La advertencia va impresa junto al resultado, no en una
   nota al pie que nadie lee.
   ═══════════════════════════════════════════════════════════════ */

/** Domingo de Pascua del año dado, en UTC. */
export function pascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

const DIA = 86400000;
const sumarDias = (f, n) => new Date(f.getTime() + n * DIA);

/** Traslada al lunes siguiente si no cae en lunes (regla Emiliani). */
function alLunes(f) {
  const d = f.getUTCDay();                 // 0 domingo … 6 sábado
  return d === 1 ? f : sumarDias(f, (8 - d) % 7);
}

const cacheFestivos = new Map();

/** Conjunto de festivos del año, en claves 'AAAA-MM-DD'. */
export function festivos(anio) {
  if (cacheFestivos.has(anio)) return cacheFestivos.get(anio);
  const s = new Set();
  const poner = (f) => s.add(clave(f));

  // fijos, sin traslado
  for (const [m, d] of [[0, 1], [4, 1], [6, 20], [7, 7], [11, 8], [11, 25]]) {
    poner(new Date(Date.UTC(anio, m, d)));
  }
  // trasladables al lunes
  for (const [m, d] of [[0, 6], [2, 19], [5, 29], [7, 15], [9, 12], [10, 1], [10, 11]]) {
    poner(alLunes(new Date(Date.UTC(anio, m, d))));
  }
  // pascuales
  const p = pascua(anio);
  poner(sumarDias(p, -3));                 // Jueves Santo — no se traslada
  poner(sumarDias(p, -2));                 // Viernes Santo — no se traslada
  poner(sumarDias(p, 43));                 // Ascensión (lunes)
  poner(sumarDias(p, 64));                 // Corpus Christi (lunes)
  poner(sumarDias(p, 71));                 // Sagrado Corazón (lunes)

  cacheFestivos.set(anio, s);
  return s;
}

const clave = (f) =>
  `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;

export function esHabil(f) {
  const d = f.getUTCDay();
  if (d === 0 || d === 6) return false;
  return !festivos(f.getUTCFullYear()).has(clave(f));
}

/**
 * Suma `n` días hábiles a partir del día siguiente a `inicio`.
 * Devuelve la fecha de vencimiento y los festivos que se saltaron.
 */
export function sumarHabiles(inicio, n) {
  let f = new Date(inicio.getTime());
  let contados = 0;
  const saltados = [];
  let guarda = 0;
  while (contados < n && guarda++ < 4000) {
    f = sumarDias(f, 1);
    if (esHabil(f)) contados++;
    else if (f.getUTCDay() !== 0 && f.getUTCDay() !== 6) saltados.push(clave(f));
  }
  return { fecha: f, saltados };
}

/** Los términos en meses se cuentan por calendario, no en hábiles. */
export function sumarMeses(inicio, n) {
  const f = new Date(inicio.getTime());
  const d = f.getUTCDate();
  f.setUTCMonth(f.getUTCMonth() + n);
  if (f.getUTCDate() < d) f.setUTCDate(0);   // 31-ene + 1 mes → 28/29-feb
  return f;
}

const FMT = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
});
export const formatear = (f) => FMT.format(f).replace(/\./g, '');

/* ─────────────────── el panel de la calculadora ─────────────────── */

export class Calculadora {
  constructor(raiz, grafo) {
    this.el = raiz;
    this.grafo = grafo;
    this.entrada = raiz.querySelector('#calc-fecha');
    this.salida = raiz.querySelector('#calc-resultado');
    this.etapa = null;

    const hoy = new Date();
    this.entrada.value = clave(new Date(Date.UTC(
      hoy.getFullYear(), hoy.getMonth(), hoy.getDate())));

    this.entrada.addEventListener('input', () => this.recalcular());
    raiz.querySelector('#btn-cerrar-calc').addEventListener('click', () => this.ocultar());
  }

  mostrar(idEtapa) {
    if (idEtapa) this.etapa = idEtapa;
    this.el.hidden = false;
    this.recalcular();
  }

  ocultar() {
    this.el.hidden = true;
    document.getElementById('chk-terminos').checked = false;
  }

  fijarEtapa(idEtapa) {
    this.etapa = idEtapa;
    if (!this.el.hidden) this.recalcular();
  }

  recalcular() {
    const v = this.entrada.value;
    this.salida.textContent = '';
    if (!v) return;
    const [a, m, d] = v.split('-').map(Number);
    const inicio = new Date(Date.UTC(a, m - 1, d));

    const nodo = this.grafo.nodos.find((n) => n.id === this.etapa);
    const plazos = [];

    if (nodo?.plazo) {
      plazos.push({ etiqueta: nodo.rotulo, plazo: nodo.plazo });
    }
    for (const s of nodo?.satelites ?? []) {
      if (s.plazo) plazos.push({ etiqueta: s.carril, plazo: s.plazo });
    }
    if (!plazos.length) {
      const p = document.createElement('p');
      p.className = 'sin-dato';
      p.textContent = nodo
        ? 'Esta etapa no tiene un término propio que computar.'
        : 'Selecciona una etapa para calcular sus términos.';
      this.salida.appendChild(p);
      return;
    }

    for (const { etiqueta, plazo } of plazos) {
      let texto, nota = '';
      if (plazo.meses) {
        texto = formatear(sumarMeses(inicio, plazo.meses));
        nota = ' (calendario)';
      } else if (plazo.dias) {
        const r = sumarHabiles(inicio, plazo.dias);
        texto = formatear(r.fecha);
        if (r.saltados.length) nota = ` (+${r.saltados.length} festivo${r.saltados.length > 1 ? 's' : ''})`;
      } else continue;

      const fila = document.createElement('div');
      fila.className = 'calc-fila';
      const et = document.createElement('span');
      et.className = 'calc-fila__et';
      et.textContent = `${etiqueta} · ${plazo.texto}${plazo.interpretativo ? ' ⚠' : ''}`;
      const val = document.createElement('span');
      val.className = 'calc-fila__v';
      val.textContent = texto + nota;
      fila.append(et, val);
      this.salida.appendChild(fila);
    }
  }
}
