/* ═══════════════════════════════════════════════════════════════
   estaciones.js — plataformas de carril y escenografía de cada etapa.

   Todo está construido con primitivas (cajas, cilindros, cápsulas,
   conos, toros). Ningún modelo externo: nada que licenciar, nada que
   descargar, y el peso de la página no depende de un .glb.

   Los carriles van en el plano XZ: el tiempo corre en X (de la queja
   a la ejecutoria) y la dependencia responsable en Z. Puesto así, la
   separación de funciones del art. 12 se ve sola: el carril de la
   OCDI se apaga en E06 y el expediente cruza al de juzgamiento.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import {
  COLOR, mat, matPropio, geoCaja, geoCilindro, geoEsfera, geoCono, geoPlano,
  pieza, caja, cilindro,
} from './materiales.js';
import { crearPersonaje, ponerEnMano, carpeta, lupa } from './personajes.js';

/* ─────────────────── disposición ─────────────────── */

export function calcularDisposicion(grafo) {
  const { pasoColumna, columnas, separacionCarriles } = grafo.escala;
  const orden = grafo.ordenCarriles;
  const fondos = grafo.fondoCarril;

  const total = orden.reduce((a, id) => a + fondos[id], 0)
    + separacionCarriles * (orden.length - 1);

  const zCarril = {};
  let z = -total / 2;
  for (const id of orden) {
    zCarril[id] = z + fondos[id] / 2;
    z += fondos[id] + separacionCarriles;
  }

  const x = (t) => (t - (columnas - 1) / 2) * pasoColumna;

  const posicionNodo = (n) => new THREE.Vector3(
    x(n.t) + (n.tOffset || 0),
    0,
    zCarril[n.carril] + (n.zOffset || 0),
  );

  /* ── islas ──────────────────────────────────────────────────
     Una dependencia no ocupa los once momentos del proceso: la
     Procuraduría sólo interviene dos veces y la segunda instancia
     una. Dibujar siete losas completas de punta a punta llenaba la
     escena de suelo vacío y la volvía un gráfico de barras. En vez de
     eso, cada carril se parte en islas alrededor de las columnas que
     sí usa, y las rutas blancas hacen de corredor entre ellas.
     ────────────────────────────────────────────────────────── */
  const usadas = {};
  for (const id of orden) usadas[id] = new Set();
  for (const n of grafo.nodos) {
    usadas[n.carril]?.add(n.t);
    for (const s of n.satelites ?? []) usadas[s.carril]?.add(s.t);
  }

  const islas = {};
  for (const id of orden) {
    const cols = [...usadas[id]].sort((a, b) => a - b);
    const grupos = [];
    for (const t of cols) {
      const ult = grupos[grupos.length - 1];
      // dos columnas separadas por más de dos huecos son dos alas distintas
      if (ult && t - ult[ult.length - 1] <= 2) ult.push(t);
      else grupos.push([t]);
    }
    islas[id] = grupos.map((gp) => {
      const t0 = gp[0], t1 = gp[gp.length - 1];
      const xIni = x(t0) - pasoColumna * 0.72;
      const xFin = x(t1) + pasoColumna * 0.72;
      return { columnas: gp, t0, t1, xIni, xFin, centro: (xIni + xFin) / 2, ancho: xFin - xIni };
    });
  }

  return { zCarril, fondos, x, posicionNodo, total, islas, usadas };
}

/* ─────────────────── sombra de contacto ─────────────────── */

let texSombra = null;
function texturaSombra() {
  if (texSombra) return texSombra;
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  r.addColorStop(0, 'rgba(8,28,62,.52)');
  r.addColorStop(0.55, 'rgba(8,28,62,.26)');
  r.addColorStop(1, 'rgba(8,28,62,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, n, n);
  texSombra = new THREE.CanvasTexture(c);
  texSombra.colorSpace = THREE.SRGBColorSpace;
  return texSombra;
}

function sombraContacto(ancho, fondo, y) {
  const m = new THREE.Mesh(
    geoPlano(1, 1),
    new THREE.MeshBasicMaterial({
      map: texturaSombra(), transparent: true, depthWrite: false, opacity: 0.85,
    }),
  );
  m.scale.set(ancho * 1.22, 1, fondo * 1.9);
  m.position.y = y;
  m.renderOrder = -1;
  return m;
}

/* ─────────────────── plataformas de carril ─────────────────── */

export function construirCarriles(grafo, config, disp) {
  const g = new THREE.Group();
  g.name = 'carriles';
  const { altoPlataforma, pasoColumna } = grafo.escala;
  const porId = Object.fromEntries(config.carriles.map((c) => [c.id, c]));
  const fichas = {};

  for (const id of grafo.ordenCarriles) {
    const carril = porId[id];
    const fondo = disp.fondos[id];
    const z = disp.zCarril[id];
    const colorCarril = new THREE.Color(carril.color).getHex();
    const zMampara = -fondo / 2 + 1.6;
    const grupoCarril = new THREE.Group();
    grupoCarril.position.set(0, 0, z);

    for (const isla of disp.islas[id]) {
      const w = isla.ancho;
      const a = new THREE.Group();
      a.position.x = isla.centro;

      // sombra propia: cada ala flota sobre el campo
      a.add(sombraContacto(w, fondo, -altoPlataforma - 2.2));

      // losa: canto oscuro, suelo claro
      a.add(caja(w, altoPlataforma, fondo, COLOR.plataformaCanto, 0, -altoPlataforma / 2, 0, { sombra: false }));
      a.add(caja(w, 1.2, fondo, COLOR.plataforma, 0, -0.6, 0, { sombra: false }));

      // juntas del piso: es lo que hace que se lea como suelo de oficina
      for (let k = 1; k < isla.columnas.length + 1; k++) {
        const x = -w / 2 + k * pasoColumna;
        if (x > w / 2 - 4) break;
        a.add(caja(0.5, 0.2, fondo - 2, COLOR.plataformaCanto, x, 0.06, 0, { sombra: false, recibe: false }));
      }
      a.add(caja(w - 2, 0.2, 0.5, COLOR.plataformaCanto, 0, 0.06, 0, { sombra: false, recibe: false }));

      // mampara al fondo, con el remate del color de la dependencia
      a.add(caja(w, 13, 1.6, COLOR.mueble, 0, 6.5, zMampara));
      a.add(caja(w, 1.4, 2.2, colorCarril, 0, 13.7, zMampara));
      for (let x = -w / 2 + 1; x <= w / 2 - 1; x += pasoColumna) {
        a.add(caja(1.2, 14, 2.4, COLOR.muebleSombra, x, 7, zMampara));
      }

      // zócalo delantero
      a.add(caja(w, 2.4, 1.2, colorCarril, 0, -2.8, fondo / 2 + 0.2, { sombra: false }));

      // la dependencia sin confirmar lleva el zócalo a trazos rojos
      if (carril.verificacion === 'sin-verificar') {
        for (let x = -w / 2 + 5; x < w / 2 - 5; x += 20) {
          a.add(caja(11, 1.5, 1.5, COLOR.alerta, x + 5.5, -6.6, fondo / 2 + 0.35, { sombra: false }));
        }
      }

      grupoCarril.add(a);
    }

    g.add(grupoCarril);
    fichas[id] = {
      grupo: grupoCarril, carril, z, fondo, zMampara,
      islas: disp.islas[id],
      xIni: disp.islas[id][0].xIni,
    };
  }

  return { grupo: g, fichas };
}

/* ─────────────────── mobiliario de relleno ───────────────────
   Una oficina no es un escritorio solo en medio de una losa vacía. Las
   columnas sin estación se amueblan con lo que hay de verdad en una
   dependencia: archivadores, materas, el dispensador de agua, sillas
   sueltas y papeleras. Colocado con una secuencia determinista, no
   aleatoria, para que no baile entre recargas.
   ─────────────────────────────────────────────────────────── */

const PROPS = {
  planta() {
    const g = new THREE.Group();
    g.add(pieza(geoCilindro(2.0, 3.2, 10), mat(0xC98B6B), 0, 1.6, 0));
    g.add(pieza(geoCilindro(2.2, 0.5, 10), mat(0x7A4F3A), 0, 3.3, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(pieza(geoEsfera(1.9, 8), mat(0x3E8E63),
        Math.cos(a) * 1.5, 5.4 + (i % 2) * 1.4, Math.sin(a) * 1.5, { escala: [1, 0.8, 1] }));
    }
    return g;
  },
  archivador() {
    const g = new THREE.Group();
    g.add(caja(7, 12, 5.6, COLOR.metal, 0, 6, 0));
    for (let i = 0; i < 4; i++) {
      g.add(caja(6.4, 0.4, 5.8, COLOR.metalOscuro, 0, 2.2 + i * 2.7, 0, { sombra: false }));
      g.add(caja(2.2, 0.5, 0.4, COLOR.plataforma, 0, 3.1 + i * 2.7, 2.95));
    }
    return g;
  },
  dispensador() {
    const g = new THREE.Group();
    g.add(caja(4.4, 8, 4.4, COLOR.plataforma, 0, 4, 0));
    g.add(pieza(geoCilindro(2.2, 5.4, 12), mat(COLOR.pantalla, { transparent: true, opacity: 0.6 }), 0, 10.6, 0));
    g.add(pieza(geoCono(2.2, 1.6, 12), mat(COLOR.pantalla, { transparent: true, opacity: 0.6 }), 0, 8.6, 0, { rot: [Math.PI, 0, 0] }));
    return g;
  },
  papelera() {
    const g = new THREE.Group();
    g.add(pieza(geoCilindro(1.8, 3.4, 10), mat(COLOR.metalOscuro), 0, 1.7, 0));
    g.add(caja(1.4, 1.2, 1.4, COLOR.papel, 0.3, 3.6, 0.2, { rot: [0.3, 0.6, 0.2] }));
    return g;
  },
  sillaSuelta() { return silla(COLOR.muebleSombra); },
  mesaCafe() {
    const g = new THREE.Group();
    g.add(pieza(geoCilindro(3.4, 0.7, 14), mat(COLOR.mueble), 0, 5.4, 0));
    g.add(cilindro(0.5, 5.4, COLOR.metalOscuro, 0, 2.7, 0));
    g.add(pieza(geoCilindro(2.4, 0.3, 12), mat(COLOR.metal), 0, 5.9, 0));
    g.add(cilindro(0.8, 1.4, COLOR.papel, 1.2, 6.5, 0.6));
    return g;
  },
  cajasArchivo() {
    const g = new THREE.Group();
    g.add(caja(5.4, 3.4, 4.4, 0xC2A77E, 0, 1.7, 0));
    g.add(caja(5.4, 3.4, 4.4, 0xC2A77E, 0.4, 5.2, -0.3, { rot: [0, 0.2, 0] }));
    g.add(caja(4.0, 0.3, 3.2, COLOR.papel, 0.4, 7.0, -0.3));
    return g;
  },
};

const SECUENCIA_PROPS = ['archivador', 'planta', 'cajasArchivo', 'dispensador', 'papelera', 'mesaCafe'];

/**
 * Amuebla el fondo de cada ala. Poco y contra la mampara: lo justo para
 * que se lea «oficina» y no «maqueta». Un mueble por ala, y una persona
 * de fondo sólo en las alas anchas — llenar el suelo de objetos compite
 * con lo que de verdad importa, que son los puestos de trabajo.
 */
export function amoblarCarriles(grafo, disp, fichas, elenco) {
  const g = new THREE.Group();
  g.name = 'mobiliario';

  let k = 0, personal = 0;
  grafo.ordenCarriles.forEach((id, iCarril) => {
    const f = fichas[id];
    const zFondo = f.z + f.zMampara + 7;

    for (const isla of f.islas) {
      // sólo las alas con sitio de sobra llevan relleno
      const libres = isla.columnas.length;
      if (libres < 2) continue;

      const o = PROPS[SECUENCIA_PROPS[k++ % SECUENCIA_PROPS.length]]();
      o.position.set(isla.xIni + 14, 0, zFondo);
      o.rotation.y = 0.4;
      g.add(o);

      if (libres >= 3) {
        const o2 = PROPS[SECUENCIA_PROPS[k++ % SECUENCIA_PROPS.length]]();
        o2.position.set(isla.xFin - 14, 0, zFondo);
        o2.rotation.y = -0.3;
        g.add(o2);
      }

      if (libres >= 4 && personal < 4) {
        personal++;
        const p = crearPersonaje(iCarril % 2 ? 'secretaria' : 'ocdi', 40 + personal);
        p.position.set(isla.centro + 16, 0, zFondo - 3);
        p.rotation.y = Math.PI - 0.35;
        g.add(p);
        elenco.inscribir(p, 'idle', null);
      }
    }
  });

  return g;
}

/* ─────────────────── piezas reutilizables ─────────────────── */

const ALTO_MESA = 6.4;

function escritorio(an = 19, pr = 10, color = COLOR.mueble) {
  const g = new THREE.Group();
  g.add(caja(an, 1.1, pr, color, 0, ALTO_MESA, 0));
  g.add(caja(an - 2.4, ALTO_MESA - 0.6, pr - 2.2, COLOR.muebleSombra, 0, (ALTO_MESA - 0.6) / 2, -0.4));
  return g;
}

function hojas(n = 4, color = COLOR.papel, an = 4.4, pr = 5.6) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const h = caja(an, 0.22, pr, color, (Math.random() - 0.5) * 0.7, i * 0.26, (Math.random() - 0.5) * 0.7,
      { rot: [0, (Math.random() - 0.5) * 0.18, 0] });
    g.add(h);
  }
  return g;
}

function expedienteApilado(folios = 6) {
  const g = new THREE.Group();
  g.add(caja(5.4, 0.6, 6.6, COLOR.acento, 0, 0, 0));
  for (let i = 0; i < folios; i++) {
    g.add(caja(4.9, 0.2, 6.0, COLOR.papel, 0, 0.42 + i * 0.24, 0));
  }
  g.add(caja(5.4, 0.5, 6.6, COLOR.acentoHondo, 0, 0.42 + folios * 0.24 + 0.2, 0));
  return g;
}

function pantalla(an = 9, al = 6, color = COLOR.pantalla) {
  const g = new THREE.Group();
  g.add(caja(an + 1, al + 1, 0.7, COLOR.metalOscuro, 0, al / 2, 0));
  const vidrio = caja(an, al, 0.3, color, 0, al / 2, 0.42, { sombra: false });
  vidrio.material = matPropio(color, { emissive: color, emissiveIntensity: 0.75 });
  g.add(vidrio);
  g.add(cilindro(1.6, 0.6, COLOR.metal, 0, 0.3, 0));
  g.add(caja(0.9, 2.2, 0.9, COLOR.metal, 0, 1.3, 0));
  g.userData.vidrio = vidrio;
  return g;
}

function silla(color = COLOR.metal) {
  const g = new THREE.Group();
  g.add(caja(4.2, 0.7, 4.2, color, 0, 4.2, 0));
  g.add(caja(4.2, 5.0, 0.7, color, 0, 6.8, -1.8));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    g.add(cilindro(0.3, 4.2, COLOR.metalOscuro, x, 2.1, z));
  }
  return g;
}

function sobreMesh(conArroba = false) {
  const g = new THREE.Group();
  g.add(caja(4.2, 0.5, 3.0, COLOR.papel, 0, 0, 0));
  g.add(caja(4.2, 0.18, 1.7, COLOR.plataformaCanto, 0, 0.3, 0, { rot: [0, 0, 0] }));
  if (conArroba) g.add(cilindro(0.75, 0.2, COLOR.pantalla, 0, 0.42, 0));
  return g;
}

/* ─────────────────── los 22 modelos ─────────────────── */

export const MODELOS = {

  /* ── carril del quejoso ── */

  'mostrador-queja'() {
    const g = new THREE.Group();
    g.add(caja(16, 7.4, 8, COLOR.mueble, 0, 3.7, 0));
    g.add(caja(17.4, 0.9, 9.2, COLOR.plataforma, 0, 7.8, 0));
    g.add(hojas(3, COLOR.papel).translateY(8.3).translateX(3));
    g.userData.puesto = { x: 0, z: 8.5, rotY: Math.PI };
    return g;
  },

  'buzon-quejoso'() {
    const g = new THREE.Group();
    g.add(cilindro(0.8, 9, COLOR.metalOscuro, 0, 4.5, 0));
    const caja1 = caja(7.4, 5.4, 5.2, COLOR.ropaC, 0, 11.4, 0);
    g.add(caja1);
    g.add(caja(7.8, 0.6, 5.6, COLOR.papel, 0, 14.3, 0));
    g.add(caja(5.4, 0.5, 0.5, COLOR.tinta, 0, 11.8, 2.7));
    g.userData.puesto = { x: -9, z: 6, rotY: 0.5 };
    return g;
  },

  /* ── carril OCDI ── */

  ventanilla() {
    const g = new THREE.Group();
    g.add(caja(20, 7.0, 9, COLOR.mueble, 0, 3.5, 0));
    g.add(caja(21.4, 0.9, 10.2, COLOR.plataforma, 0, 7.4, 0));
    // mampara de vidrio con el hueco de atención
    const vidrio = matPropio(COLOR.pantalla, { transparent: true, opacity: 0.3 });
    g.add(pieza(geoCaja(21.4, 7.2, 0.4), vidrio, 0, 11.6, 4.2, { sombra: false }));
    g.add(caja(21.4, 0.6, 0.9, COLOR.metal, 0, 15.3, 4.2));
    // bandeja de reparto y sello
    g.add(caja(6.4, 0.8, 5.4, COLOR.metal, -6, 8.2, -0.5));
    g.add(hojas(4).translateY(8.6).translateX(-6).translateZ(-0.5));
    g.add(cilindro(1.5, 2.6, COLOR.alerta, 6.6, 9.1, -0.5));
    g.add(cilindro(0.6, 2.4, COLOR.tinta, 6.6, 11.6, -0.5));
    g.userData.puesto = { x: 0, z: -8.5, rotY: 0 };
    return g;
  },

  'tablero-indagacion'() {
    const g = new THREE.Group();
    // tablero vertical con fichas y una silueta sin identificar
    g.add(caja(1.2, 13, 1.2, COLOR.metalOscuro, -9, 6.5, 0));
    g.add(caja(1.2, 13, 1.2, COLOR.metalOscuro, 9, 6.5, 0));
    g.add(caja(20, 13, 0.7, COLOR.plataforma, 0, 9, 0));
    const fichasPos = [[-6, 10.6], [-1.4, 11.2], [3.2, 10.4], [6.4, 7.6], [-4.2, 6.8]];
    fichasPos.forEach(([x, y], i) => {
      g.add(caja(3.4, 2.6, 0.3, i === 2 ? COLOR.alerta : COLOR.papel, x, y, 0.55));
    });
    // interrogante: el autor todavía no está individualizado
    g.add(caja(1.0, 2.4, 0.3, COLOR.alerta, 3.2, 10.8, 0.8));
    g.add(caja(1.0, 0.8, 0.3, COLOR.alerta, 3.2, 9.2, 0.8));
    // reloj de arena de seis meses
    g.add(cilindro(2.0, 0.5, COLOR.metal, 11.5, 0.6, 6));
    g.add(pieza(geoCono(1.7, 2.4, 10), mat(COLOR.acento), 11.5, 2.0, 6, { rot: [Math.PI, 0, 0] }));
    g.add(pieza(geoCono(1.7, 2.4, 10), mat(COLOR.acento, { transparent: true, opacity: 0.45 }), 11.5, 4.5, 6));
    g.add(cilindro(2.0, 0.5, COLOR.metal, 11.5, 5.9, 6));
    g.userData.puesto = { x: -1, z: 11, rotY: Math.PI };
    g.userData.accesorio = { lado: 'der', objeto: lupa };
    return g;
  },

  'escritorio-firma'() {
    const g = escritorio(20, 10);
    g.add(hojas(5).translateY(ALTO_MESA + 0.6).translateX(-3.5));
    g.add(caja(5.2, 0.5, 6.2, COLOR.acento, 5, ALTO_MESA + 0.8, 0));   // el auto de apertura
    g.add(cilindro(1.2, 2.2, COLOR.metalOscuro, 8.4, ALTO_MESA + 1.6, -2.6));
    g.add(silla().translateZ(-9).translateX(0));
    g.userData.puesto = { x: 0, z: -7.6, rotY: 0 };
    return g;
  },

  'escritorio-version'() {
    const g = escritorio(22, 11);
    g.add(hojas(6).translateY(ALTO_MESA + 0.6).translateX(-5));
    // micrófono y grabadora: la versión libre queda registrada
    g.add(cilindro(0.5, 5.0, COLOR.metalOscuro, 4.5, ALTO_MESA + 3.0, 1.5));
    g.add(pieza(geoEsfera(1.1, 10), mat(COLOR.tinta), 4.5, ALTO_MESA + 5.6, 1.5));
    g.add(caja(5.4, 1.4, 3.6, COLOR.metalOscuro, 8.6, ALTO_MESA + 1.2, -1));
    g.add(cilindro(0.5, 0.4, COLOR.alerta, 10.4, ALTO_MESA + 2.1, -1));
    g.userData.puesto = { x: -3, z: -8.2, rotY: 0 };
    return g;
  },

  'escritorio-cierre'() {
    const g = escritorio(19, 10);
    const exp = expedienteApilado(9);
    exp.position.set(0, ALTO_MESA + 0.8, 0);
    g.add(exp);
    // la banda que cierra el expediente
    g.add(caja(6.0, 2.8, 0.7, COLOR.alerta, 0, ALTO_MESA + 2.2, 0));
    g.add(caja(0.7, 2.8, 7.2, COLOR.alerta, 0, ALTO_MESA + 2.2, 0));
    g.userData.puesto = { x: 0, z: -7.8, rotY: 0 };
    return g;
  },

  balanza() {
    const g = new THREE.Group();
    g.add(cilindro(4.4, 1.6, COLOR.plataformaCanto, 0, 0.8, 0));
    g.add(cilindro(0.8, 11, COLOR.metalOscuro, 0, 6.0, 0));
    // el brazo se inclina: lo anima estaciones.js por userData.brazo
    const brazo = new THREE.Group();
    brazo.position.y = 11.6;
    brazo.add(caja(16, 0.7, 0.7, COLOR.metalOscuro, 0, 0, 0));
    for (const s of [-1, 1]) {
      brazo.add(cilindro(0.16, 3.2, COLOR.metal, s * 7, -1.6, 0));
      const plato = pieza(geoCilindro(2.6, 0.4, 14), mat(s < 0 ? COLOR.acento : COLOR.pantalla), s * 7, -3.3, 0);
      brazo.add(plato);
    }
    g.add(brazo);
    g.userData.brazo = brazo;
    g.userData.puesto = { x: -11, z: 7.5, rotY: 0.6 };
    return g;
  },

  'escritorio-pliego'() {
    const g = escritorio(22, 11);
    // el pliego: documento grueso, el más alto de la escena
    g.add(caja(5.6, 2.6, 6.8, COLOR.acento, -4, ALTO_MESA + 1.9, 0));
    g.add(caja(5.1, 0.3, 6.3, COLOR.papel, -4, ALTO_MESA + 3.4, 0));
    // dos bandejas de salida: el físico y el electrónico salen juntos
    g.add(caja(5.4, 0.7, 4.6, COLOR.metal, 6.4, ALTO_MESA + 1.0, 2.4));
    g.add(sobreMesh(false).translateX(6.4).translateY(ALTO_MESA + 1.6).translateZ(2.4));
    g.add(caja(5.4, 0.7, 4.6, COLOR.metal, 6.4, ALTO_MESA + 1.0, -2.6));
    g.add(sobreMesh(true).translateX(6.4).translateY(ALTO_MESA + 1.6).translateZ(-2.6));
    g.userData.puesto = { x: -4, z: -8.4, rotY: 0 };
    return g;
  },

  /* ── carril de secretaría ── */

  'cartelera-edictos'() {
    const g = new THREE.Group();
    g.add(caja(1.3, 15, 1.3, COLOR.metalOscuro, -10, 7.5, 0));
    g.add(caja(1.3, 15, 1.3, COLOR.metalOscuro, 10, 7.5, 0));
    g.add(caja(22, 14, 0.8, 0xB58A5E, 0, 10, 0));          // corcho
    g.add(caja(20.4, 12.4, 0.3, 0xC79C70, 0, 10, 0.5));
    // edictos fijados; el del medio es el que se acaba de clavar
    const edictos = new THREE.Group();
    [[-6.4, 11.8, 0.06], [0, 11.2, -0.03], [6.2, 12.0, 0.05], [-3.4, 6.6, -0.04], [4.2, 6.2, 0.03]]
      .forEach(([x, y, r], i) => {
        const e = caja(5.2, 6.6, 0.3, COLOR.papel, x, y, 0.75, { rot: [0, 0, r] });
        e.userData.esEdicto = i === 1;
        edictos.add(e);
        edictos.add(cilindro(0.3, 0.5, COLOR.alerta, x, y + 2.8, 1.0, { rot: [Math.PI / 2, 0, 0] }));
      });
    g.add(edictos);
    g.userData.edictos = edictos;
    g.userData.puesto = { x: 0, z: 9.5, rotY: Math.PI };
    return g;
  },

  'pantalla-estado'() {
    const g = new THREE.Group();
    const p = pantalla(16, 10, COLOR.pantalla);
    p.position.y = 3.6;
    g.add(caja(8, 3.6, 5, COLOR.metal, 0, 1.8, 0));
    g.add(p);
    // renglones del estado electrónico
    for (let i = 0; i < 5; i++) {
      g.add(caja(11 - i * 0.6, 0.6, 0.2, COLOR.papel, -1.2, 11.4 - i * 1.5, 0.62, { sombra: false }));
    }
    g.userData.pantalla = p;
    g.userData.puesto = { x: -11, z: 7, rotY: 0.4 };
    return g;
  },

  'mostrador-notificacion'() {
    const g = new THREE.Group();
    g.add(caja(20, 7.0, 9, COLOR.mueble, 0, 3.5, 0));
    g.add(caja(21.4, 0.9, 10.2, COLOR.plataforma, 0, 7.4, 0));
    // casilleros de salida
    const cas = new THREE.Group();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      cas.add(caja(4.0, 3.0, 0.5, COLOR.metal, -6.6 + i * 4.4, 10.4 + j * 3.4, -4.2));
    }
    g.add(caja(19, 7.4, 4.6, COLOR.muebleSombra, 0, 11.6, -4.6));
    g.add(cas);
    g.add(sobreMesh().translateY(8.2).translateX(6));
    g.userData.puesto = { x: 0, z: 8, rotY: Math.PI };
    return g;
  },

  /* ── carril del disciplinable ── */

  'puerta-domicilio'() {
    const g = new THREE.Group();
    g.add(caja(13, 1.0, 10, COLOR.plataformaCanto, 0, 0.5, 0));
    g.add(caja(1.4, 15, 1.4, COLOR.mueble, -5.2, 7.5, -3.5));
    g.add(caja(1.4, 15, 1.4, COLOR.mueble, 5.2, 7.5, -3.5));
    g.add(caja(11.8, 1.3, 1.6, COLOR.mueble, 0, 14.6, -3.5));
    g.add(caja(8.6, 13.4, 0.8, 0x8C6B4F, 0, 6.9, -3.5));
    g.add(pieza(geoEsfera(0.6, 8), mat(COLOR.acento), 3.0, 7.0, -3.0));
    g.add(caja(6.4, 0.3, 3.6, COLOR.ropaB, 0, 1.2, 2.4));          // felpudo
    g.userData.puesto = { x: 0, z: 5.5, rotY: Math.PI };
    return g;
  },

  'silla-declarante'() {
    const g = new THREE.Group();
    g.add(silla(COLOR.mueble));
    g.add(caja(8, 0.8, 5, COLOR.mueble, 0, 5.6, 6.5));               // mesita
    g.add(cilindro(0.4, 5.6, COLOR.metalOscuro, 0, 2.8, 6.5));
    g.add(hojas(2).translateY(6.1).translateZ(6.5));
    g.userData.puesto = { x: 0, z: 2.6, rotY: 0 };
    return g;
  },

  'mesa-escrito'() {
    const g = new THREE.Group();
    g.add(caja(13, 0.9, 8, COLOR.mueble, 0, 5.8, 0));
    for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
      g.add(cilindro(0.35, 5.4, COLOR.metalOscuro, x, 2.7, z));
    }
    g.add(hojas(7, COLOR.papel, 5.0, 6.4).translateY(6.3));
    g.userData.puesto = { x: 0, z: 7.5, rotY: Math.PI };
    return g;
  },

  'banca-defensor'() {
    const g = new THREE.Group();
    g.add(caja(16, 1.0, 4.6, 0x8C6B4F, 0, 5.0, 0));
    g.add(caja(16, 5.4, 0.9, 0x8C6B4F, 0, 7.9, -1.9));
    for (const x of [-6.6, 6.6]) {
      g.add(caja(0.9, 4.6, 4.0, COLOR.metalOscuro, x, 2.3, 0));
    }
    // maletín del defensor público
    g.add(caja(5.0, 3.6, 1.8, COLOR.ropaToga, 6.0, 1.8, 3.4));
    g.add(caja(1.8, 0.6, 0.5, COLOR.metal, 6.0, 3.8, 3.4));
    g.userData.puesto = { x: -2, z: 5.5, rotY: Math.PI };
    return g;
  },

  /* ── carril de juzgamiento ── */

  'escritorio-dos-carpetas'() {
    const g = escritorio(22, 11);
    const ord = carpeta(COLOR.pantalla); ord.position.set(-5.5, ALTO_MESA + 0.9, 0); ord.scale.setScalar(1.5);
    const ver = carpeta(COLOR.acento);   ver.position.set(5.5, ALTO_MESA + 0.9, 0); ver.scale.setScalar(1.5);
    g.add(ord, ver);
    g.userData.carpetaOrdinario = ord;
    g.userData.carpetaVerbal = ver;
    g.userData.puesto = { x: 0, z: -8.4, rotY: 0 };
    return g;
  },

  'linea-montaje'(nodo) {
    const g = new THREE.Group();
    const subs = nodo?.subEstaciones ?? [];
    const paso = 16;
    const x0 = -((subs.length - 1) * paso) / 2;

    // banda transportadora: el expediente escrito avanza de puesto en puesto
    g.add(caja(subs.length * paso + 8, 1.4, 7.0, COLOR.metalOscuro, 0, 3.0, 0));
    g.add(caja(subs.length * paso + 8, 0.5, 6.2, COLOR.metal, 0, 3.9, 0));

    subs.forEach((s, i) => {
      const x = x0 + i * paso;
      const m = new THREE.Group();
      m.position.x = x;
      m.add(caja(14, 5.0, 8.4, COLOR.mueble, 0, 6.3, -7.6));
      m.add(caja(15, 0.8, 9.2, COLOR.plataforma, 0, 9.1, -7.6));
      if (i === 1) {                                  // laboratorio de pruebas
        m.add(cilindro(1.6, 4.4, COLOR.pantalla, -3.4, 11.7, -7.6));
        m.add(cilindro(1.6, 4.4, COLOR.ok, 0.4, 11.7, -7.6));
        m.add(cilindro(1.6, 4.4, COLOR.acento, 4.2, 11.7, -7.6));
      } else if (i === 3) {                           // el fallo
        m.add(caja(5.0, 2.0, 6.0, COLOR.acento, 0, 10.5, -7.6));
        m.add(caja(4.5, 0.3, 5.5, COLOR.papel, 0, 11.6, -7.6));
      } else {
        m.add(hojas(i === 0 ? 8 : 4).translateY(9.6).translateZ(-7.6));
      }
      m.add(caja(4.4, 0.6, 5.4, COLOR.papel, 0, 4.4, 0));
      g.add(m);
    });

    g.userData.puesto = { x: x0 + (subs.length - 1) * paso, z: 8.0, rotY: Math.PI };
    return g;
  },

  'sala-audiencias'() {
    const g = new THREE.Group();
    // estrado del juzgador
    g.add(caja(20, 2.2, 10, COLOR.plataformaCanto, 0, 1.1, -9));
    g.add(caja(18, 6.0, 8, 0x8C6B4F, 0, 5.2, -9));
    g.add(caja(19.4, 0.9, 9.2, COLOR.mueble, 0, 8.6, -9));
    // mesas de las partes
    g.add(caja(13, 0.9, 6.4, COLOR.mueble, -12, 6.2, 6));
    for (const x of [-16.5, -7.5]) g.add(cilindro(0.35, 5.8, COLOR.metalOscuro, x, 2.9, 6));
    g.add(caja(13, 0.9, 6.4, COLOR.mueble, 12, 6.2, 6));
    for (const x of [7.5, 16.5]) g.add(cilindro(0.35, 5.8, COLOR.metalOscuro, x, 2.9, 6));
    g.add(hojas(3).translateY(6.7).translateX(-12).translateZ(6));
    g.add(hojas(3).translateY(6.7).translateX(12).translateZ(6));
    // micrófonos: es audiencia, se habla
    for (const [x, z] of [[0, -5.6], [-12, 3.6], [12, 3.6]]) {
      g.add(cilindro(0.4, 3.6, COLOR.metalOscuro, x, z === -5.6 ? 10.8 : 8.4, z));
      g.add(pieza(geoEsfera(0.85, 8), mat(COLOR.tinta), x, z === -5.6 ? 12.8 : 10.4, z));
    }
    // cámara de grabación con testigo rojo — art. 226: la audiencia se graba
    const tripode = new THREE.Group();
    tripode.position.set(-21, 0, -6);
    for (const a of [0, 2.1, 4.2]) {
      tripode.add(cilindro(0.3, 12, COLOR.metalOscuro, Math.sin(a) * 2.2, 6, Math.cos(a) * 2.2,
        { rot: [Math.cos(a) * 0.14, 0, -Math.sin(a) * 0.14] }));
    }
    tripode.add(caja(5.4, 3.6, 3.2, COLOR.tinta, 0, 13.6, 0));
    tripode.add(cilindro(1.2, 1.6, COLOR.metalOscuro, 0, 13.6, 2.2, { rot: [Math.PI / 2, 0, 0] }));
    const testigo = pieza(geoEsfera(0.5, 8), matPropio(COLOR.alerta, { emissive: COLOR.alerta, emissiveIntensity: 1 }), 2.0, 15.0, 1.2);
    tripode.add(testigo);
    g.add(tripode);
    g.userData.testigo = testigo;
    g.userData.puesto = { x: 0, z: -4.5, rotY: 0 };
    g.userData.puestosExtra = [
      { rol: 'disciplinable', x: -12, z: 11.5, rotY: Math.PI, animacion: 'declarar' },
      { rol: 'defensa', x: -5.5, z: 11.5, rotY: Math.PI, animacion: 'idle' },
      { rol: 'ministerioPublico', x: 12, z: 11.5, rotY: Math.PI, animacion: 'idle' },
    ];
    return g;
  },

  estrado() {
    const g = new THREE.Group();
    // tarima en dos escalones: la segunda instancia está por encima
    g.add(caja(34, 2.4, 16, COLOR.plataformaCanto, 0, 1.2, 2));
    g.add(caja(30, 2.4, 12, COLOR.plataformaCanto, 0, 3.6, 0));
    g.add(caja(28, 6.4, 9, 0x8C6B4F, 0, 8.0, -1));
    g.add(caja(29.4, 1.0, 10.2, COLOR.mueble, 0, 11.7, -1));
    // tres puestos
    for (const x of [-9, 0, 9]) {
      g.add(caja(5.4, 6.0, 0.9, COLOR.ropaToga, x, 15.2, -5.4));
      g.add(hojas(2, COLOR.papel, 3.6, 4.4).translateX(x).translateY(12.2).translateZ(-1));
    }
    // rampa por donde sube el expediente
    g.add(caja(8, 0.7, 14, COLOR.metal, -22, 2.4, 2, { rot: [-0.17, 0, 0] }));
    g.userData.puesto = { x: 0, z: -7.5, rotY: 0 };
    g.userData.puestosExtra = [
      { rol: 'segunda', x: -9, z: -7.5, rotY: 0, animacion: 'idle' },
      { rol: 'segunda', x: 9, z: -7.5, rotY: 0, animacion: 'idle' },
    ];
    return g;
  },

  'sello-ejecutoria'() {
    const g = new THREE.Group();
    g.add(caja(20, 2.0, 14, COLOR.plataformaCanto, 0, 1.0, 0));
    // prensa de sellar
    g.add(caja(2.4, 16, 2.4, COLOR.metalOscuro, -7.5, 10, -4));
    g.add(caja(16, 2.4, 2.4, COLOR.metalOscuro, 0, 17.6, -4));
    const sello = new THREE.Group();
    sello.position.set(2, 13.4, 0);
    sello.add(cilindro(1.0, 6.0, COLOR.metalOscuro, 0, 3.4, 0));
    sello.add(cilindro(3.4, 2.4, COLOR.alerta, 0, -0.6, 0));
    sello.add(pieza(geoCilindro(3.4, 0.4, 16), mat(COLOR.papel), 0, -1.9, 0));
    g.add(sello);
    g.userData.sello = sello;
    // el expediente que recibe el sello
    const exp = expedienteApilado(14);
    exp.position.set(2, 2.0, 0);
    g.add(exp);
    g.userData.expediente = exp;
    g.userData.puesto = { x: -11, z: 8, rotY: 0.5 };
    return g;
  },

  /* ── etapas añadidas a petición del autor ── */

  'ventanilla-inhibitoria'() {
    const g = new THREE.Group();
    g.add(caja(18, 7.0, 9, COLOR.mueble, 0, 3.5, 0));
    g.add(caja(19.4, 0.9, 10.2, COLOR.plataforma, 0, 7.4, 0));
    // la reja bajada: aquí la actuación no se abre
    const reja = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      reja.add(caja(0.7, 8.6, 0.7, COLOR.metalOscuro, -8 + i * 2, 12.2, 4.0));
    }
    reja.add(caja(19.4, 0.9, 1.4, COLOR.metalOscuro, 0, 16.6, 4.0));
    g.add(reja);
    // el sello rojo y la queja detenida
    g.add(cilindro(2.0, 3.0, COLOR.alerta, 5.6, 9.4, -0.6));
    g.add(cilindro(0.7, 2.6, COLOR.tinta, 5.6, 12.2, -0.6));
    const detenida = caja(5.0, 0.5, 6.0, COLOR.papel, -4.5, 8.1, 0);
    g.add(detenida);
    g.add(pieza(geoCilindro(1.5, 0.3, 12), mat(COLOR.alerta), -4.5, 8.4, 0, { sombra: false }));
    // bandeja de salida: sale por donde entró
    g.add(caja(6.0, 0.8, 5.0, COLOR.metalOscuro, 0, 1.4, 7.5));
    g.userData.puesto = { x: 0, z: -7.6, rotY: 0 };
    return g;
  },

  'mesa-preferente'() {
    const g = new THREE.Group();
    g.add(caja(14, 2.0, 12, COLOR.plataformaCanto, 0, 1.0, 0));
    g.add(escritorio(20, 11).translateY(2.0));
    // dos expedientes: el que ya tiene y el que puede atraer
    const propio = expedienteApilado(5);
    propio.position.set(-5, ALTO_MESA + 2.8, 0);
    g.add(propio);
    const atraido = expedienteApilado(7);
    atraido.position.set(5.5, ALTO_MESA + 2.8, 0);
    g.add(atraido);
    g.userData.atraido = atraido;
    g.userData.yAtraido = ALTO_MESA + 2.8;
    // el sello de la entidad que puede desplazar a la otra
    g.add(cilindro(2.6, 0.6, COLOR.plataforma, 0, ALTO_MESA + 2.4, -4.5));
    g.add(pieza(geoCilindro(2.0, 0.5, 14), mat(COLOR.pantalla), 0, ALTO_MESA + 2.8, -4.5, { sombra: false }));
    g.userData.puesto = { x: 0, z: -9.0, rotY: 0 };
    return g;
  },

  /* ── carril de la PGN ── */

  'servidor-pgn'() {
    const g = new THREE.Group();
    g.add(caja(13, 1.4, 11, COLOR.plataformaCanto, 0, 0.7, 0));
    const rack = caja(11, 18, 9, COLOR.metalOscuro, 0, 9.4, 0);
    g.add(rack);
    const luces = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      g.add(caja(10.2, 0.4, 0.3, COLOR.metal, 0, 3.4 + i * 2.8, 4.6, { sombra: false }));
      for (let j = 0; j < 3; j++) {
        const l = pieza(geoCaja(0.7, 0.7, 0.3),
          matPropio(j === 0 ? COLOR.ok : COLOR.pantalla,
            { emissive: j === 0 ? COLOR.ok : COLOR.pantalla, emissiveIntensity: 0.9 }),
          -3.4 + j * 1.6, 4.4 + i * 2.8, 4.65, { sombra: false });
        luces.add(l);
      }
    }
    g.add(luces);
    g.userData.luces = luces;
    return g;
  },
};

/* ─────────────────── montaje ─────────────────── */

/* Los puestos de trabajo se dibujan grandes respecto a la losa: la masa
   visual tiene que estar en la gente y los muebles, no en el suelo. Los
   tres escenarios amplios (línea del ordinario, sala de audiencias y
   estrado) van más contenidos porque ya ocupan toda su columna. */
const ESCALA_MODELO = 1.45;
const ESCALA_POR_MODELO = {
  'linea-montaje': 0.82,
  'sala-audiencias': 0.95,
  'estrado': 1.05,
};

/**
 * Construye las estaciones, sus personajes y sus satélites.
 * Devuelve un mapa idNodo → { grupo, posicion, personajes[], satelites[] }.
 */
export function construirEstaciones(grafo, config, disp, elenco, escena) {
  const raiz = new THREE.Group();
  raiz.name = 'estaciones';
  const nodos = {};
  let semilla = 0;

  const colocarPersonaje = (destino, rol, puesto, animacion, idNodo) => {
    const p = crearPersonaje(rol, semilla++);
    p.position.set(puesto.x, 0, puesto.z);
    p.rotation.y = puesto.rotY ?? 0;
    destino.add(p);
    elenco.inscribir(p, animacion, idNodo);
    return p;
  };

  const montarModelo = (nombre, nodo) => {
    const fab = MODELOS[nombre];
    if (!fab) return new THREE.Group();
    const m = fab(nodo);
    m.scale.setScalar(ESCALA_POR_MODELO[nombre] ?? ESCALA_MODELO);
    return m;
  };

  for (const nodo of grafo.nodos) {
    if (nodo.tipo !== 'etapa') continue;

    const g = new THREE.Group();
    g.name = 'nodo:' + nodo.id;
    const pos = disp.posicionNodo(nodo);
    g.position.copy(pos);
    g.userData.idNodo = nodo.id;

    const modelo = montarModelo(nodo.modelo, nodo);
    g.add(modelo);

    // personaje principal
    if (nodo.personaje) {
      const puesto = modelo.userData.puesto ?? { x: 0, z: 9, rotY: Math.PI };
      const per = colocarPersonaje(g, nodo.personaje.rol, puesto, nodo.personaje.animacion, nodo.id);
      const acc = modelo.userData.accesorio;
      if (acc) ponerEnMano(per, acc.lado, acc.objeto());
    }
    // acompañantes que declara el propio modelo (audiencia, estrado)
    for (const extra of modelo.userData.puestosExtra ?? []) {
      colocarPersonaje(g, extra.rol, extra, extra.animacion, nodo.id);
    }

    raiz.add(g);

    // satélites: lo que esta etapa hace en OTROS carriles
    const satelites = [];
    for (const sat of nodo.satelites ?? []) {
      const sg = new THREE.Group();
      sg.name = `sat:${nodo.id}:${sat.carril}`;
      sg.position.set(disp.x(sat.t), 0, disp.zCarril[sat.carril]);
      sg.userData.idNodo = nodo.id;
      const sm = montarModelo(sat.modelo, sat);
      sg.add(sm);
      if (sat.personaje) {
        const puesto = sm.userData.puesto ?? { x: 0, z: 9, rotY: Math.PI };
        colocarPersonaje(sg, sat.personaje.rol, puesto, sat.personaje.animacion, nodo.id);
      }
      raiz.add(sg);
      satelites.push({ grupo: sg, modelo: sm, dato: sat });
    }

    nodos[nodo.id] = {
      dato: nodo, grupo: g, modelo, posicion: pos, satelites,
      centroCamara: pos.clone().add(new THREE.Vector3(0, 7, 0)),
    };

    escena.registrarClicable(g);
    for (const s of satelites) escena.registrarClicable(s.grupo);
  }

  return { grupo: raiz, nodos };
}

/* ─────────────────── vida ambiente ─────────────────── */

/** Pequeños movimientos que no dependen de la etapa enfocada: la balanza
 *  que oscila, el testigo de grabación que parpadea, las luces del rack. */
export function vidaAmbiente(nodos) {
  const piezas = [];
  for (const id in nodos) {
    const u = nodos[id].modelo.userData;
    if (u.brazo)   piezas.push({ t: 'balanza', o: u.brazo });
    if (u.testigo) piezas.push({ t: 'testigo', o: u.testigo });
    if (u.sello)   piezas.push({ t: 'sello', o: u.sello, y: u.sello.position.y });
    if (u.pantalla) piezas.push({ t: 'pantalla', o: u.pantalla.userData.vidrio });
    if (u.atraido)  piezas.push({ t: 'atraido', o: u.atraido, y: u.yAtraido });
    for (const s of nodos[id].satelites) {
      if (s.modelo.userData.luces) piezas.push({ t: 'luces', o: s.modelo.userData.luces });
      if (s.modelo.userData.pantalla) piezas.push({ t: 'pantalla', o: s.modelo.userData.pantalla.userData.vidrio });
    }
  }

  return (dt, t) => {
    for (const p of piezas) {
      switch (p.t) {
        case 'balanza':
          p.o.rotation.z = Math.sin(t * 0.85) * 0.1;
          break;
        case 'testigo':
          p.o.material.emissiveIntensity = 0.3 + (Math.sin(t * 3.4) > 0.3 ? 0.9 : 0);
          break;
        case 'sello': {
          const f = (t / 3.2) % 1;
          const golpe = f < 0.18 ? Math.sin((f / 0.18) * Math.PI) : 0;
          p.o.position.y = p.y - golpe * 7.2;
          break;
        }
        case 'pantalla':
          p.o.material.emissiveIntensity = 0.62 + Math.sin(t * 1.7) * 0.12;
          break;
        case 'atraido': {
          // «iniciar, proseguir o remitir»: el expediente se levanta y vuelve
          const f = (t / 5.5) % 1;
          const alza = f < 0.5 ? Math.sin(f * 2 * Math.PI) : 0;
          p.o.position.y = p.y + Math.max(0, alza) * 5.5;
          p.o.rotation.y = Math.max(0, alza) * 0.5;
          break;
        }
        case 'luces':
          p.o.children.forEach((l, i) => {
            l.material.emissiveIntensity = 0.35 + (Math.sin(t * 2.2 + i * 1.7) > 0.2 ? 0.8 : 0);
          });
          break;
      }
    }
  };
}
