/* ═══════════════════════════════════════════════════════════════
   Prueba de integridad del contenido jurídico.

       node pruebas/verificar-contenido.mjs

   Qué garantiza y qué NO garantiza — importa la diferencia:

   · SÍ garantiza que `data/etapas-cgd.json` no ha cambiado ni un
     carácter desde que se selló (prueba 1). Si alguien lo edita, aquí
     salta. Para resellar a propósito: node pruebas/verificar-contenido.mjs --sellar
   · SÍ garantiza que ninguno de los doce errores del manual original
     volvió a aparecer, ni en los datos ni en el código (prueba 4).
   · NO garantiza que la transcripción inicial sea fiel a la Ley 1952.
     Eso sólo lo puede decir el autor cotejando contra la fuente: el
     sello se calculó sobre la transcripción, no sobre el Diario
     Oficial. Está anotado en REVISION_JURIDICA.md.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const RUTA_DATOS = join(raiz, 'data', 'etapas-cgd.json');
const RUTA_SELLO = join(aqui, 'sello-contenido.json');

const sellar = process.argv.includes('--sellar');

let fallos = 0;
const ok   = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const mal  = (m) => { fallos++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const tema = (m) => console.log('\n\x1b[1m' + m + '\x1b[0m');

// Se normalizan los finales de línea antes de sellar: si no, un clon en
// Windows con core.autocrlf activo cambiaría los bytes y el sello saltaría
// sin que nadie hubiera tocado el contenido.
const CR = String.fromCharCode(13);
const crudo = Buffer.from(
  readFileSync(RUTA_DATOS).toString('utf8').split(CR + '\n').join('\n'), 'utf8');
const datos = JSON.parse(crudo.toString('utf8'));
const { etapas, reglasGenerales, meta } = datos;

/* ── 1. sello de integridad ─────────────────────────────────── */

tema('1. Sello de integridad del contenido');

const huella = createHash('sha256').update(crudo).digest('hex');

if (sellar) {
  writeFileSync(RUTA_SELLO, JSON.stringify({
    _aviso: 'Sello de etapas-cgd.json. Sólo debe regenerarse cuando el autor apruebe un cambio del contenido jurídico.',
    archivo: 'data/etapas-cgd.json',
    sha256: huella,
    bytes: crudo.length,
    etapas: etapas.length,
    sellado: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n');
  console.log('  Sello escrito: ' + huella.slice(0, 16) + '…');
} else if (!existsSync(RUTA_SELLO)) {
  mal('no hay sello. Genéralo con: node pruebas/verificar-contenido.mjs --sellar');
} else {
  const sello = JSON.parse(readFileSync(RUTA_SELLO, 'utf8'));
  if (sello.sha256 === huella) ok(`contenido intacto (sha256 ${huella.slice(0, 16)}…)`);
  else mal(`EL CONTENIDO JURÍDICO CAMBIÓ.\n      esperado ${sello.sha256}\n      obtenido ${huella}\n      Si el cambio es deliberado y está aprobado, resella con --sellar.`);
}

/* ── 2. estructura ──────────────────────────────────────────── */

tema('2. Estructura de las doce etapas');

const ESPERADAS = ['E00','E01','E02','E03','E04','E05','E06','E07','E08A','E08B','E09','E10'];
const ids = etapas.map((e) => e.id);
ids.join(',') === ESPERADAS.join(',')
  ? ok('las 12 etapas, en orden: ' + ids.join(' '))
  : mal('ids inesperados: ' + ids.join(' '));

const OBLIGATORIOS = ['id','fase','carril','titulo','articulos','norma','concepto','plazos','notificacion','recursos','animacion','siguientes'];
let completas = true;
for (const e of etapas) {
  for (const c of OBLIGATORIOS) {
    const v = e[c];
    const vacio = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    if (vacio) { mal(`${e.id}: campo «${c}» ausente o vacío`); completas = false; }
  }
}
if (completas) ok('los 12 campos del esquema están presentes y no vacíos en todas');

reglasGenerales.length === 5
  ? ok('las 5 tarjetas de la capa transversal')
  : mal(`se esperaban 5 reglas generales, hay ${reglasGenerales.length}`);

/* ── 3. notas interpretativas ───────────────────────────────── */

tema('3. Notas interpretativas');

const conNota = etapas.filter((e) => e.notaInterpretativa);
const esperadasNota = ['E02','E05','E07','E08A'];
conNota.map((e) => e.id).join(',') === esperadasNota.join(',')
  ? ok('4 notas por etapa: ' + esperadasNota.join(' '))
  : mal('notas en etapas inesperadas: ' + conNota.map((e) => e.id).join(' '));

meta.notaInterpretativaGlobal
  ? ok('1 nota interpretativa global (pie) — 5 en total')
  : mal('falta la nota interpretativa global');

// las que remiten a la nota deben tener la nota
for (const e of etapas) {
  const remite = [e.plazos, e.notificacion].some((t) => /ver nota interpretativa/i.test(t));
  if (remite && !e.notaInterpretativa) mal(`${e.id} remite a la nota interpretativa pero no la tiene`);
}

/* ── 4. los doce errores del manual original ────────────────── */

tema('4. Errores del manual original que no deben reaparecer');

// Cada patrón describe el error, no el texto correcto. Se busca en los
// datos Y en el código, por si alguna plantilla los reintroduce.
const ERRORES = [
  [1,  /al d[ií]a siguiente de su [úu]ltima notificaci[óo]n/i,        'firmeza «al día siguiente de la última notificación» (art. 138 inc. 2: el día en que se notifican)'],
  [2,  /presentes o legalmente convocados/i,                           'estrados «a presentes o legalmente convocados» (art. 126: se encuentren o no presentes)'],
  [3,  /se designa(r[áa])? defensor de oficio[^.]{0,40}pliego/i,       'pliego: «defensor de oficio» (art. 225: defensor público o estudiante de consultorio jurídico)'],
  [4,  /aviso[^.]{0,30}a la (PGN|Procuradur[íi]a)[^.]{0,20}o a la [Pp]ersoner[íi]a/,
                                                                       'aviso «a la PGN o a la Personería» (art. 216: Viceprocuraduría General de la Nación)'],
  [5,  /diez \(10\) d[íi]as[^.]{0,30}arts?\.? 117 y 221/i,             'evaluación: 10 días atribuidos también al art. 221'],
  [6,  /225 ?A[^.]{0,60}notifica[^.]{0,20}por estado/i,                'art. 225A «se notifica por estado»'],
  [7,  /fallo de segunda instancia[^.]{0,40}personal o por estado/i,   'segunda instancia «personal o por estado»'],
  [8,  /acuse t[ée]cnico/i,                                            'notificación electrónica con «acuse técnico» (art. 122: fecha de envío)'],
  [9,  /primera y [úu]nica instancia/i,                                '«fallos de primera y única instancia» (art. 121: «los fallos de instancia»)'],
  [10, /pliego[^.]{0,40}providencia motivada de sustanciaci[óo]n/i,    'pliego como «providencia motivada de sustanciación»'],
];

const textoDatos = JSON.stringify(datos);
const fuentes = ['app.js', 'index.html', 'ui/panel.js', 'ui/fallback-2d.js', 'data/grafo-flujo.json', 'data/config-entidad.json']
  .map((f) => { try { return readFileSync(join(raiz, f), 'utf8'); } catch { return ''; } })
  .join('\n');
const todo = textoDatos + '\n' + fuentes;

let limpio = true;
for (const [n, patron, desc] of ERRORES) {
  if (patron.test(todo)) { mal(`error ${n} del manual presente: ${desc}`); limpio = false; }
}

// 11 y 12 son omisiones: se comprueba que lo omitido SÍ esté
const correcciones = [
  [11, /art\. 110, par\. 1/.test(textoDatos) && /art\. 134/.test(textoDatos),
       'apelación del archivo (134) y legitimación del quejoso (110 par. 1)'],
  [12, etapas.some((e) => /inhibe de plano/i.test(e.norma)),
       'decisión inhibitoria del art. 209'],
];
for (const [n, presente, desc] of correcciones) {
  presente ? ok(`omisión ${n} subsanada: ${desc}`) : mal(`omisión ${n} sin subsanar: ${desc}`);
}
if (limpio) ok('ninguno de los 10 errores de redacción del manual aparece en datos ni en código');

/* ── 4 bis. etapas añadidas: no deben colarse como verificadas ── */

tema('4 bis. Etapas añadidas después del encargo');

const RUTA_EXTRA = join(raiz, 'data', 'etapas-adicionales.json');
if (!existsSync(RUTA_EXTRA)) {
  ok('no hay etapas añadidas');
} else {
  const extra = JSON.parse(readFileSync(RUTA_EXTRA, 'utf8'));

  // ninguna id añadida puede chocar con una de la sección 5
  const choque = extra.etapas.filter((e) => ids.includes(e.id)).map((e) => e.id);
  choque.length
    ? mal('ids añadidos que pisan la sección 5: ' + choque.join(' '))
    : ok(`${extra.etapas.length} añadidas sin pisar las verificadas: ` +
         extra.etapas.map((e) => e.id).join(' '));

  // cada una debe declarar procedencia, fuentes resolubles y nota
  for (const e of extra.etapas) {
    if (e.verificacion !== 'anadida-fuente-alterna') {
      mal(`${e.id}: debe declarar verificacion "anadida-fuente-alterna", no "${e.verificacion}"`);
    }
    if (!e.fuentes?.length) mal(`${e.id}: sin fuentes declaradas`);
    for (const f of e.fuentes ?? []) {
      if (!extra.procedencia.fuentes.some((x) => x.id === f)) {
        mal(`${e.id}: cita la fuente «${f}», que no está en procedencia.fuentes`);
      }
    }
    if (!e.notaInterpretativa) mal(`${e.id}: una etapa añadida debe llevar nota interpretativa`);
    for (const c of OBLIGATORIOS) {
      if (c === 'animacion' || c === 'siguientes') continue;
      const v = e[c];
      if (v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) {
        mal(`${e.id}: campo «${c}» ausente o vacío`);
      }
    }
  }
  extra.procedencia?.notaFuente
    ? ok('la procedencia advierte que el Senado no respondió y queda cotejo pendiente')
    : mal('falta procedencia.notaFuente');

  // y el archivo sellado no debe haber absorbido nada de esto
  const idsExtra = extra.etapas.map((e) => e.id);
  idsExtra.some((id) => textoDatos.includes(`"${id}"`))
    ? mal('una etapa añadida se filtró al archivo sellado')
    : ok('el archivo sellado sigue conteniendo sólo la sección 5');
}

/* ── 5. fuente y fecha ──────────────────────────────────────── */

tema('5. Fuente citada');

/secretariasenado/.test(meta.fuenteGeneral)
  ? ok('fuente general: compilación de la Secretaría del Senado')
  : mal('la fuente general no cita la compilación del Senado');

meta.fechaConsulta === '2026-10-07'
  ? ok('fecha de consulta 7-oct-2026')
  : mal('fecha de consulta inesperada: ' + meta.fechaConsulta);

meta.enlaces?.length === 4
  ? ok('4 enlaces a las páginas de la fuente')
  : mal('se esperaban 4 enlaces a la fuente');

/* ── cierre ─────────────────────────────────────────────────── */

console.log('');
if (fallos) {
  console.log(`\x1b[31m${fallos} comprobación(es) fallida(s).\x1b[0m`);
  process.exit(1);
}
console.log('\x1b[32mTodas las comprobaciones pasaron.\x1b[0m');
