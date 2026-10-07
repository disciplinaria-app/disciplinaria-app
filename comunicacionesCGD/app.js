/* ═══════════════════════════════════════════════════════════════
   app.js — ensamblaje.

   Orden de arranque: datos → ¿hay WebGL? → escena o diagrama plano →
   interfaz. El panel y el índice son idénticos en los dos caminos:
   el contenido jurídico nunca depende de que la tarjeta gráfica
   coopere.
   ═══════════════════════════════════════════════════════════════ */

import { Panel, pintarReglas, pintarPie } from './ui/panel.js';
import { Navegacion } from './ui/navegacion.js';
import { Calculadora } from './ui/terminos.js';
import { construirFallback2D } from './ui/fallback-2d.js';

const $ = (s) => document.querySelector(s);

const ELEMENTOS = {
  cargando:     $('#cargando'),
  barraCarga:   $('#barra-progreso-i'),
  estadoCarga:  $('#cargando-estado'),
  radicado:     $('#radicado-tick'),
  lienzo:       $('#lienzo'),
  capa3d:       $('#capa-3d'),
  capaRotulos:  $('#capa-rotulos'),
  sinWebgl:     $('#sin-webgl'),
  fallback:     $('#fallback-2d'),
  panel:        $('#panel'),
  indice:       $('#indice'),
  indiceCuerpo: $('#indice-cuerpo'),
  btnIndice:    $('#btn-indice'),
  btnRecorrido: $('#btn-recorrido'),
  btnAnterior:  $('#btn-anterior'),
  btnSiguiente: $('#btn-siguiente'),
  btnAlejar:    $('#btn-alejar'),
  conmutadorVia: [...document.querySelectorAll('[data-via]')],
  chkReglas:    $('#chk-reglas'),
  chkTerminos:  $('#chk-terminos'),
  reglas:       $('#reglas'),
  calculadora:  $('#calculadora'),
  expedienteHud: $('#expediente-hud'),
  expedienteEstado: $('#expediente-estado'),
  pie:          $('#pie'),
  anuncio:      $('#anuncio'),
};

/* ─────────────────── carga ─────────────────── */

let progreso = 0;
function avanzarCarga(a, texto) {
  progreso = Math.max(progreso, a);
  ELEMENTOS.barraCarga.style.width = progreso + '%';
  if (texto) ELEMENTOS.estadoCarga.textContent = texto;
}

function tictacRadicado() {
  const el = ELEMENTOS.radicado;
  let n = 0;
  const destino = 174293;
  const id = setInterval(() => {
    n += Math.ceil((destino - n) / 7) + 137;
    if (n >= destino) { n = destino; clearInterval(id); }
    el.textContent = '2026-OCDI-' + String(n).padStart(6, '0');
  }, 55);
  return () => clearInterval(id);
}

async function cargarJSON(ruta) {
  const r = await fetch(ruta, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${r.status})`);
  return r.json();
}

/* ─────────────────── arranque ─────────────────── */

arrancar().catch((err) => {
  console.error(err);
  ELEMENTOS.estadoCarga.textContent = 'No se pudo abrir el expediente. ' + err.message;
  ELEMENTOS.barraCarga.style.background = '#EB5757';
});

async function arrancar() {
  // en móvil el índice arranca plegado: ocupa casi toda la pantalla y
  // taparía la escena antes de que el usuario la vea
  if (window.matchMedia('(max-width: 860px)').matches) {
    ELEMENTOS.indice.setAttribute('data-oculto', '');
    ELEMENTOS.btnIndice.setAttribute('aria-expanded', 'false');
  }

  const pararTictac = tictacRadicado();
  avanzarCarga(8, 'Leyendo el contenido verificado…');

  const [datos, grafo, config] = await Promise.all([
    cargarJSON('data/etapas-cgd.json'),
    cargarJSON('data/grafo-flujo.json'),
    cargarJSON('data/config-entidad.json'),
  ]);
  const etapas = datos.etapas;
  avanzarCarga(30, 'Levantando los carriles…');

  /* ── interfaz común ── */
  const panel = new Panel(ELEMENTOS.panel, {
    etapas, config,
    alCerrar: () => { navegacion.deseleccionar(); vista.alejar(); },
  });

  pintarReglas(ELEMENTOS.reglas, datos.reglasGenerales);
  pintarPie(ELEMENTOS.pie, datos.meta, config);
  montarBotonPie();

  const calculadora = new Calculadora(ELEMENTOS.calculadora, grafo);

  /* ── escenario: 3D si se puede, SVG si no ── */
  const { hayWebGL } = await import('./scene/escena.js');
  let vista;

  // ?2d=1 fuerza el diagrama plano: sirve para revisar esa versión sin
  // tener que encontrar un navegador sin WebGL
  const forzar2D = new URLSearchParams(location.search).get('2d') === '1';

  if (hayWebGL() && !forzar2D) {
    avanzarCarga(45, 'Montando la escena…');
    vista = await montarVista3D({ etapas, grafo, config, panel });
  } else {
    avanzarCarga(70, 'Sin WebGL: diagrama plano…');
    vista = montarVista2D({ etapas, grafo, config });
  }

  avanzarCarga(88, 'Afinando el encuadre…');

  /* ── navegación ── */
  const navegacion = new Navegacion({
    etapas, grafo, elementos: ELEMENTOS,
    acciones: {
      alSeleccionar(id, opciones) {
        panel.mostrar(id);
        calculadora.fijarEtapa(id);
        vista.enfocar(id, opciones);
        actualizarHash(id);
      },
      alAlejar() {
        panel.cerrar();
        navegacion.deseleccionar();
        vista.alejar();
        actualizarHash(null);
      },
      alCambiarVia(via) { vista.filtrarVia(via); },
      alAlternarReglas(on) {
        ELEMENTOS.reglas.hidden = !on;
        ELEMENTOS.capaRotulos.toggleAttribute('data-apagada', on);
        if (on) pintarReglas(ELEMENTOS.reglas, datos.reglasGenerales);  // reinicia la entrada escalonada
      },
      alAlternarCalculadora(on) {
        on ? calculadora.mostrar(navegacion.actual) : calculadora.ocultar();
      },
      alCambiarInsets() { vista.recalcularInsets?.(); },
    },
  });

  vista.conectarNavegacion(navegacion);
  vista.recalcularInsets?.();

  avanzarCarga(100, 'Listo');
  pararTictac();
  setTimeout(() => ELEMENTOS.cargando.setAttribute('data-listo', ''), 260);

  /* ── enlace directo ── */
  const inicial = etapaDeURL(etapas);
  if (inicial) setTimeout(() => navegacion.seleccionar(inicial), 420);
}

/* ─────────────────── vista 3D ─────────────────── */

async function montarVista3D({ etapas, grafo, config, panel }) {
  const THREE = await import('three');
  const { Escena, MOV_REDUCIDO } = await import('./scene/escena.js');
  const { calcularDisposicion, construirCarriles, amoblarCarriles, construirEstaciones, vidaAmbiente } =
    await import('./scene/estaciones.js');
  const { construirRutas } = await import('./scene/rutas.js');
  const { Elenco } = await import('./scene/personajes.js');
  const { fijarOpacidad } = await import('./scene/materiales.js');

  const escena = new Escena(ELEMENTOS.capa3d, ELEMENTOS.capaRotulos);
  const disp = calcularDisposicion(grafo);
  const elenco = new Elenco();

  const carriles = construirCarriles(grafo, config, disp);
  escena.escena.add(carriles.grupo);
  escena.escena.add(amoblarCarriles(grafo, disp, carriles.fichas, elenco));

  const estaciones = construirEstaciones(grafo, config, disp, elenco, escena);
  escena.escena.add(estaciones.grupo);

  const rutas = construirRutas(grafo, disp, estaciones.nodos, escena);
  escena.escena.add(rutas.grupo);

  const ambiente = vidaAmbiente(estaciones.nodos);
  if (MOV_REDUCIDO) elenco.congelar();

  /* ── rótulos ── */
  const porCarril = Object.fromEntries(config.carriles.map((c) => [c.id, c]));
  const xIzq = -grafo.escala.anchoPlataforma / 2;

  /* ── rotulación ────────────────────────────────────────────
     Regla: la vista general sólo muestra QUIÉN (la dependencia) y QUÉ
     (la etapa). Los plazos y las preguntas de las compuertas son letra
     chica: aparecen cuando te acercas a esa estación. Con todo encendido
     a la vez eran cuarenta chapas flotando y no se leía ninguna.
     ───────────────────────────────────────────────────────── */

  // nombre de la dependencia, apoyado sobre su mampara
  for (const id of grafo.ordenCarriles) {
    const c = porCarril[id];
    const nombre = (c.verificacion === 'sin-verificar'
      ? 'Segunda instancia — por confirmar' : (c.nombreCorto ?? c.nombre)).toUpperCase();
    escena.agregarRotulo(`${c.n} · ${nombre}`,
      new THREE.Vector3(carriles.fichas[id].xIni - 8, 18,
        disp.zCarril[id] - disp.fondos[id] / 2 + 1.6),
      ['rotulo--carril']);
  }

  const rotulosNodo = {};
  const rotulosDetalle = [];   // se encienden sólo con la etapa enfocada

  for (const n of grafo.nodos) {
    const p = disp.posicionNodo(n);

    if (n.tipo === 'etapa') {
      // alturas alternadas: en isométrico, dos rótulos a la misma altura
      // en columnas vecinas se montan uno sobre otro
      const alto = 29 + (n.t % 3) * 13;
      const titulo = escena.agregarRotulo(`${n.id} · ${n.rotulo}`,
        p.clone().add(new THREE.Vector3(0, alto, 0)));

      const detalle = [];
      if (n.plazo) {
        const pl = escena.agregarRotulo(n.plazo.texto,
          p.clone().add(new THREE.Vector3(18, alto + 15, 0)), ['rotulo--plazo']);
        if (n.plazo.interpretativo) pl.el.setAttribute('data-interpretativo', '');
        pl.el.title = n.plazo.nota ?? '';
        detalle.push(pl);
      }
      for (const s of n.satelites ?? []) {
        if (!s.plazo) continue;
        detalle.push(escena.agregarRotulo(s.plazo.texto,
          new THREE.Vector3(disp.x(s.t) + 16, 32, disp.zCarril[s.carril]), ['rotulo--plazo']));
      }

      rotulosNodo[n.id] = { titulo, detalle };
      for (const d of detalle) { d.visible = false; d.duenio = n.id; rotulosDetalle.push(d); }

    } else if (n.tipo === 'compuerta') {
      const r = escena.agregarRotulo(n.pregunta, p.clone().add(new THREE.Vector3(0, 9, 0)),
        ['rotulo--compuerta']);
      r.visible = false;
      r.duenio = n.ramas.map((x) => x.destino);
      rotulosDetalle.push(r);

    } else if (n.tipo === 'terminal') {
      escena.agregarRotulo(n.rotulo, p.clone().add(new THREE.Vector3(0, 26, 0)), ['rotulo--terminal']);
    }
  }

  /** Enciende la letra chica de una etapa (y la de las compuertas que
   *  desembocan en ella) y apaga la del resto. */
  function detalleVisible(id) {
    for (const r of rotulosDetalle) {
      r.visible = id != null &&
        (r.duenio === id || (Array.isArray(r.duenio) && r.duenio.includes(id)));
    }
  }

  /* ── interacción ── */
  let navegacion = null;
  let enfocado = null;

  const lienzo = escena.renderer.domElement;
  lienzo.style.cursor = 'default';

  lienzo.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    const o = escena.interseccion(ev);
    lienzo.style.cursor = o ? 'pointer' : 'default';
  });

  lienzo.addEventListener('click', (ev) => {
    const o = escena.interseccion(ev);
    if (!o) return;
    const id = o.userData.idNodo;
    if (!id) return;
    navegacion?.detenerRecorrido();
    if (id.startsWith('G_')) {        // compuerta: resalta sus ramas
      destacarCompuerta(id);
      return;
    }
    navegacion?.seleccionar(id);
  });

  function destacarCompuerta(id) {
    const c = rutas.compuertas[id];
    if (!c) return;
    const destinos = new Set(c.dato.ramas.map((r) => r.destino));
    for (const r of rutas.rutas) {
      const suya = r.dato.de === id && destinos.has(r.dato.a);
      r.material.opacity = suya ? 1 : r.opacidadBase * 0.3;
    }
    ELEMENTOS.anuncio.textContent =
      c.dato.pregunta + ' Ramas: ' + c.dato.ramas.map((r) => r.etiqueta).join(', ') + '.';
    clearTimeout(destacarCompuerta._t);
    destacarCompuerta._t = setTimeout(() => rutas.enfocarRutas(enfocado), 2600);
  }

  /* ── atenuación del resto de la escena al 35 % ── */
  function atenuar(idActivo) {
    // los pisos son la mayor masa visual: si no se atenúan, atenuar los
    // muebles no se nota. Van a un valor intermedio, no al 35 %, porque
    // el plano de la oficina tiene que seguir leyéndose de fondo.
    for (const id of grafo.ordenCarriles) {
      fijarOpacidad(carriles.fichas[id].grupo, idActivo == null ? 1 : 0.5);
    }
    for (const id in estaciones.nodos) {
      const n = estaciones.nodos[id];
      const activo = idActivo == null || id === idActivo;
      fijarOpacidad(n.grupo, activo ? 1 : 0.35);
      for (const s of n.satelites) fijarOpacidad(s.grupo, activo ? 1 : 0.35);
    }
    for (const id in rutas.terminales) {
      fijarOpacidad(rutas.terminales[id].grupo, idActivo == null ? 1 : 0.35);
    }
    for (const r of Object.values(rutas.compuertas)) {
      fijarOpacidad(r.grupo, idActivo == null ? 1 : 0.4);
    }
    for (const r of escena.rotulos) {
      const suyo = idActivo == null;
      r.el.toggleAttribute('data-atenuado', !suyo && !rotulosDe(idActivo).includes(r));
    }
  }

  const rotulosDe = (id) => {
    const r = rotulosNodo[id];
    return r ? [r.titulo, ...r.detalle] : [];
  };

  /* ── enfoque de una etapa ── */
  let secuencia = 0;

  async function enfocar(id, opciones = {}) {
    const n = estaciones.nodos[id];
    if (!n) return;
    const mio = ++secuencia;
    enfocado = id;

    atenuar(id);
    detalleVisible(id);
    rutas.enfocarRutas(id);
    elenco.enfocar(id);

    ELEMENTOS.expedienteHud.hidden = false;
    ELEMENTOS.expedienteEstado.textContent = textoExpediente(id, grafo);

    const dur = opciones.duracion ?? 1.2;
    await escena.acercarA(n.centroCamara, dur);
    if (mio !== secuencia) return;      // llegó otra selección mientras volaba

    rutas.posarExpediente(n.posicion);
    rutas.expediente.sumarFolios(8 + Math.round(Math.random() * 6));
    if (id === 'E10') rutas.expediente.sellar(0xEB5757);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rutas.despachar(id);
    }
  }

  function alejar() {
    secuencia++;
    enfocado = null;
    atenuar(null);
    detalleVisible(null);
    rutas.enfocarRutas(null);
    elenco.enfocar(null);
    rutas.expediente.mostrar(false);
    ELEMENTOS.expedienteHud.hidden = true;
    escena.verGeneral(1.0);
  }

  /* ── encuadre que respeta los paneles ── */
  function recalcularInsets() {
    const anchoVentana = window.innerWidth;
    const movil = window.matchMedia('(max-width: 860px)').matches;
    const izq = (!movil && !ELEMENTOS.indice.hasAttribute('data-oculto'))
      ? ELEMENTOS.indice.offsetWidth : 0;
    const der = (!movil && !ELEMENTOS.panel.hidden) ? ELEMENTOS.panel.offsetWidth : 0;
    const aba = movil && !ELEMENTOS.panel.hidden
      ? ELEMENTOS.panel.offsetHeight
      : 60;
    escena.fijarInsets({ izq, der, arr: 22, aba });
    // las capas flotantes (reglas, calculadora) usan los mismos insets:
    // si no, la primera tarjeta queda debajo del índice
    const r = document.documentElement.style;
    r.setProperty('--inset-izq', izq + 'px');
    r.setProperty('--inset-der', der + 'px');
    void anchoVentana;
  }

  // el panel cambia el ancho útil: hay que reencuadrar cuando entra o sale
  new MutationObserver(() => recalcularInsets())
    .observe(ELEMENTOS.panel, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', recalcularInsets);

  /* ── bucle ── */
  escena.cadaCuadro((dt, t) => {
    elenco.actualizar(t);
    ambiente(dt, t);
    rutas.actualizar(dt);
  });
  escena.verGeneral(0);
  escena.arrancar();

  return {
    tipo: '3d',
    enfocar, alejar, recalcularInsets,
    filtrarVia: (via) => {
      rutas.filtrarVia(via);
      for (const id of ['E08A', 'E08B']) {
        const n = estaciones.nodos[id];
        if (!n) continue;
        const v = n.dato.via;
        const visible = via === 'ambas' || v === via;
        n.grupo.visible = visible;
        const r = rotulosNodo[id];
        if (r) {
          r.titulo.visible = visible;
          for (const x of r.detalle) x.visible = visible && enfocado === id;
        }
      }
    },
    conectarNavegacion: (nav) => { navegacion = nav; },
  };
}

/** Qué está haciendo el expediente ahora mismo, en palabras del oficio. */
function textoExpediente(id, grafo) {
  const n = grafo.nodos.find((x) => x.id === id);
  const salida = grafo.rutas.find((r) => r.de === id && r.destacada);
  if (salida?.etiqueta) return 'en remisión · ' + salida.etiqueta;
  if (id === 'E10') return 'ejecutoriado';
  if (id === 'E09') return 'en segunda instancia';
  return 'en ' + (n?.rotulo ?? '').toLowerCase();
}

/* ─────────────────── vista 2D ─────────────────── */

function montarVista2D({ etapas, grafo, config }) {
  ELEMENTOS.sinWebgl.hidden = false;
  ELEMENTOS.capa3d.hidden = true;
  let navegacion = null;

  const ajustarInsets = () => {
    const movil = window.matchMedia('(max-width: 860px)').matches;
    const izq = (!movil && !ELEMENTOS.indice.hasAttribute('data-oculto'))
      ? ELEMENTOS.indice.offsetWidth : 0;
    document.documentElement.style.setProperty('--inset-izq', izq + 'px');
  };
  ajustarInsets();
  window.addEventListener('resize', ajustarInsets);

  const diagrama = construirFallback2D(ELEMENTOS.fallback, {
    etapas, grafo, config,
    alSeleccionar: (id) => navegacion?.seleccionar(id),
  });

  return {
    tipo: '2d',
    enfocar: (id) => diagrama.marcar(id),
    alejar: () => diagrama.marcar(null),
    filtrarVia: () => {},
    recalcularInsets: ajustarInsets,
    conectarNavegacion: (nav) => { navegacion = nav; },
  };
}

/* ─────────────────── enlaces directos y pie ─────────────────── */

function etapaDeURL(etapas) {
  const p = new URLSearchParams(location.search);
  const cand = (p.get('e') || location.hash.replace('#', '')).toUpperCase();
  return etapas.some((e) => e.id === cand) ? cand : null;
}

function actualizarHash(id) {
  const u = new URL(location.href);
  if (id) u.hash = id; else u.hash = '';
  history.replaceState(null, '', u.toString().replace(/#$/, ''));
}

function montarBotonPie() {
  const b = document.createElement('button');
  b.className = 'pie-boton';
  b.type = 'button';
  b.textContent = 'Fuentes';
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', 'pie');
  b.addEventListener('click', () => {
    const abierto = ELEMENTOS.pie.hasAttribute('data-abierto');
    ELEMENTOS.pie.toggleAttribute('data-abierto', !abierto);
    b.setAttribute('aria-expanded', String(!abierto));
    b.textContent = abierto ? 'Fuentes' : 'Ocultar fuentes';
  });
  document.body.appendChild(b);
}
