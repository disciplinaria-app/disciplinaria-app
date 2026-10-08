/* ═══════════════════════════════════════════════════════════════
   rutas.js — rutas ortogonales con flechas y nodos, compuertas en
   rombo, objetos que viajan, y el expediente.

   El expediente es el elemento firma de esta presentación: una
   carpeta ámbar que recorre físicamente la planta y ENGORDA en cada
   estación. No es adorno. El art. 225 convierte la remisión material
   del expediente en un acto procesal con término propio («dentro del
   término improrrogable de tres días»), así que lo que se mueve por
   estas rutas es exactamente lo que la ley manda mover.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import {
  COLOR, mat, matPropio, geoCaja, geoCilindro, geoCono, geoEsfera,
  pieza, caja, cilindro,
} from './materiales.js';

const Y_RUTA = 1.4;          // las rutas vuelan justo sobre la tapa de las islas
const Y_VIAJE = 7.5;         // altura de crucero de los objetos

const ESTILO = {
  principal:    { ancho: 2.7, color: 0xFFFFFF, opacidad: 0.92, trazos: false },
  comunicacion: { ancho: 1.8, color: 0xBFD9F5, opacidad: 0.72, trazos: false },
  rama:         { ancho: 1.9, color: 0xFFFFFF, opacidad: 0.55, trazos: false },
  retorno:      { ancho: 1.7, color: 0xFFFFFF, opacidad: 0.5,  trazos: true  },
};
const COLOR_DESTACADA = COLOR.acento;

/* ─────────────────── trazado ─────────────────── */

/** Ruta en ángulos rectos, como el diagrama de referencia: nada de
 *  diagonales sueltas, que en isométrico se leen mal. */
function trazar(a, b) {
  const mismoZ = Math.abs(a.z - b.z) < 1.5;
  const mismoX = Math.abs(a.x - b.x) < 1.5;
  if (mismoZ || mismoX) return [a.clone(), b.clone()];
  const mx = (a.x + b.x) / 2;
  return [
    a.clone(),
    new THREE.Vector3(mx, a.y, a.z),
    new THREE.Vector3(mx, b.y, b.z),
    b.clone(),
  ];
}

/** Muestreador: convierte una polilínea en una función u∈[0,1] → punto. */
function muestreador(puntos) {
  const acum = [0];
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    total += puntos[i].distanceTo(puntos[i - 1]);
    acum.push(total);
  }
  const salida = new THREE.Vector3();
  const dir = new THREE.Vector3();
  return {
    largo: total,
    en(u, destino = salida) {
      const d = THREE.MathUtils.clamp(u, 0, 1) * total;
      let i = 1;
      while (i < acum.length - 1 && acum[i] < d) i++;
      const t0 = acum[i - 1], t1 = acum[i];
      const f = t1 === t0 ? 0 : (d - t0) / (t1 - t0);
      return destino.lerpVectors(puntos[i - 1], puntos[i], f);
    },
    direccionEn(u) {
      const d = THREE.MathUtils.clamp(u, 0, 1) * total;
      let i = 1;
      while (i < acum.length - 1 && acum[i] < d) i++;
      return dir.subVectors(puntos[i], puntos[i - 1]).normalize();
    },
  };
}

/* ─────────────────── geometría de la ruta ─────────────────── */

function construirRuta(puntos, estilo, destacada) {
  const g = new THREE.Group();
  const color = destacada ? COLOR_DESTACADA : estilo.color;
  const m = matPropio(color, {
    transparent: true,
    opacity: destacada ? 1 : estilo.opacidad,
    depthWrite: false,
  });
  const an = destacada ? estilo.ancho * 1.25 : estilo.ancho;

  // nodo circular en el arranque — la referencia los usa en los extremos
  const nodo = pieza(geoCilindro(an * 1.5, 0.7, 14), m, 0, 0, 0, { sombra: false, recibe: false });
  nodo.position.copy(puntos[0]);
  g.add(nodo);

  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    const largo = a.distanceTo(b);
    if (largo < 0.5) continue;
    const esUltimo = i === puntos.length - 1;
    const util = esUltimo ? Math.max(largo - 6.5, 0.5) : largo;   // deja sitio a la punta
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const rotY = Math.atan2(dir.x, dir.z);

    if (estilo.trazos) {
      const paso = 7.5, trazo = 4.2;
      for (let d = 0; d < util - 1; d += paso) {
        const l = Math.min(trazo, util - d);
        const c = new THREE.Vector3().copy(a).addScaledVector(dir, d + l / 2);
        const seg = pieza(geoCaja(an, 0.7, 1), m, 0, 0, 0, { sombra: false, recibe: false });
        seg.scale.z = l;
        seg.position.copy(c);
        seg.rotation.y = rotY;
        g.add(seg);
      }
    } else {
      const c = new THREE.Vector3().copy(a).addScaledVector(dir, util / 2);
      const seg = pieza(geoCaja(an, 0.7, 1), m, 0, 0, 0, { sombra: false, recibe: false });
      seg.scale.z = util;
      seg.position.copy(c);
      seg.rotation.y = rotY;
      g.add(seg);
    }

    // codo redondeado en el quiebre
    if (!esUltimo) {
      const codo = pieza(geoCilindro(an / 2, 0.7, 10), m, 0, 0, 0, { sombra: false, recibe: false });
      codo.position.copy(b);
      g.add(codo);
    } else {
      // punta de flecha
      const punta = pieza(geoCono(an * 1.7, 7.0, 4), m, 0, 0, 0, { sombra: false, recibe: false });
      punta.position.copy(b).addScaledVector(dir, -3.2);
      punta.rotation.set(Math.PI / 2, 0, 0);
      punta.rotation.y = 0;
      punta.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      punta.rotateY(Math.PI / 4);
      g.add(punta);
    }
  }

  g.userData.material = m;
  g.userData.opacidadBase = m.opacity;
  return g;
}

/* ─────────────────── compuertas ─────────────────── */

function construirCompuerta(nodo) {
  const g = new THREE.Group();
  g.userData.idNodo = nodo.id;

  // rombo isométrico: un cubo girado 45°, achatado
  const rombo = pieza(geoCaja(9, 2.2, 9), matPropio(0xFFFFFF, { transparent: true, opacity: 0.95 }),
    0, 2.4, 0, { rot: [0, Math.PI / 4, 0], sombra: false });
  g.add(rombo);
  const borde = pieza(geoCaja(10.6, 1.2, 10.6), matPropio(COLOR.tinta, { transparent: true, opacity: 0.35 }),
    0, 1.9, 0, { rot: [0, Math.PI / 4, 0], sombra: false });
  g.add(borde);

  g.userData.rombo = rombo;
  return g;
}

/* ─────────────────── terminales (archivo, inhibitoria) ─────────────────── */

function construirTerminal() {
  const g = new THREE.Group();
  g.add(caja(15, 1.6, 11, COLOR.plataformaCanto, 0, 0.8, 0));
  // archivador: cajones cerrados
  g.add(caja(12, 11, 8.6, COLOR.metal, 0, 7.1, 0));
  for (let i = 0; i < 3; i++) {
    g.add(caja(11, 0.5, 8.8, COLOR.metalOscuro, 0, 3.4 + i * 3.1, 0, { sombra: false }));
    g.add(caja(3.2, 0.7, 0.6, COLOR.plataforma, 0, 4.6 + i * 3.1, 4.4));
  }
  g.add(caja(12.6, 0.7, 9.2, COLOR.plataforma, 0, 12.9, 0));
  return g;
}

/* ─────────────────── el expediente ─────────────────── */

export class Expediente {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'expediente';
    this.folios = 0;

    this.tapa = caja(6.4, 0.7, 7.8, COLOR.acento, 0, 0, 0, { sombra: true, recibe: false });
    this.contra = caja(6.4, 0.6, 7.8, COLOR.acentoHondo, 0, 0.4, 0, { sombra: false, recibe: false });
    this.pila = new THREE.Group();
    this.sellos = new THREE.Group();
    this.grupo.add(this.tapa, this.pila, this.contra, this.sellos);
    this.grupo.visible = false;

    this._mat = null;
    this.reiniciar();
  }

  reiniciar() {
    this.folios = 0;
    this.pila.clear();
    this.sellos.clear();
    this._reacomodar();
  }

  /** Cada etapa deja folios dentro. Es la única métrica de avance que
   *  la presentación muestra, y es la que un abogado reconoce. */
  sumarFolios(n) {
    this.folios += n;
    const laminas = Math.min(Math.round(this.folios / 9), 16);
    this.pila.clear();
    for (let i = 0; i < laminas; i++) {
      this.pila.add(caja(5.8, 0.22, 7.2, COLOR.papel, 0, 0.5 + i * 0.26, 0, { sombra: false, recibe: false }));
    }
    this._reacomodar();
  }

  /** Marca visible en la cubierta: notificado, ejecutoriado… */
  sellar(color = COLOR.alerta) {
    const n = this.sellos.children.length;
    if (n >= 5) return;
    const s = pieza(geoCilindro(1.0, 0.18, 10), matPropio(color, { transparent: true, opacity: 0.85 }),
      -2.0 + (n % 3) * 1.9, 0, -2.4 + Math.floor(n / 3) * 2.2, { sombra: false, recibe: false });
    this.sellos.add(s);
    this._reacomodar();
  }

  _reacomodar() {
    const alto = 0.5 + this.pila.children.length * 0.26;
    this.contra.position.y = alto;
    this.sellos.position.y = alto + 0.35;
  }

  mostrar(v) { this.grupo.visible = v; }
  get visible() { return this.grupo.visible; }
}

/* ─────────────────── objetos viajeros ─────────────────── */

function crearViajero(tipo) {
  const g = new THREE.Group();
  switch (tipo) {
    case 'sobre':
      g.add(caja(5.0, 0.6, 3.4, COLOR.papel, 0, 0, 0, { recibe: false }));
      g.add(pieza(geoCono(2.0, 1.4, 4), mat(COLOR.plataformaCanto), 0, 0.5, 0,
        { rot: [Math.PI, 0, Math.PI / 4], sombra: false, recibe: false }));
      break;
    case 'correo':
      g.add(caja(4.6, 0.6, 3.2, COLOR.papel, 0, 0, 0, { recibe: false }));
      g.add(pieza(new THREE.TorusGeometry(1.0, 0.26, 6, 14),
        matPropio(COLOR.pantalla, { emissive: COLOR.pantalla, emissiveIntensity: 0.8 }),
        0, 0.6, 0, { rot: [Math.PI / 2, 0, 0], sombra: false, recibe: false }));
      break;
    case 'edicto':
      g.add(caja(4.2, 0.4, 5.4, COLOR.papel, 0, 0, 0, { recibe: false }));
      g.add(cilindro(0.3, 0.9, COLOR.alerta, 0, 0.6, -2.0, { sombra: false }));
      break;
    case 'datos': {
      const m = matPropio(COLOR.pantalla, { emissive: COLOR.pantalla, emissiveIntensity: 1 });
      for (let i = 0; i < 3; i++) {
        g.add(pieza(geoEsfera(0.7, 8), m, 0, 0, -2.6 + i * 2.6, { sombra: false, recibe: false }));
      }
      break;
    }
    default:
      g.add(caja(4.0, 0.6, 4.0, COLOR.acento, 0, 0, 0, { recibe: false }));
  }
  g.visible = false;
  return g;
}

/** Fondo común de viajeros: se reutilizan, no se crean y destruyen.
 *  Crear una malla cada vez que sale un sobre es exactamente el error
 *  que hace que la escena se trabe a los dos minutos. */
class Almacen {
  constructor(padre) {
    this.padre = padre;
    this.libres = new Map();
    this.activos = [];
  }

  tomar(tipo) {
    let cola = this.libres.get(tipo);
    if (!cola) { cola = []; this.libres.set(tipo, cola); }
    let o = cola.pop();
    if (!o) { o = crearViajero(tipo); o.userData.tipo = tipo; this.padre.add(o); }
    o.visible = true;
    return o;
  }

  soltar(o) {
    o.visible = false;
    this.libres.get(o.userData.tipo).push(o);
  }

  lanzar(objeto, ruta, duracion, alAcabar) {
    const o = this.tomar(objeto);
    this.activos.push({ o, ruta, dur: duracion, t: 0, alAcabar });
    return o;
  }

  actualizar(dt) {
    for (let i = this.activos.length - 1; i >= 0; i--) {
      const a = this.activos[i];
      a.t += dt;
      const u = Math.min(a.t / a.dur, 1);
      const p = a.ruta.muestras.en(u);
      // arco: sale de la mesa, cruza por el aire y aterriza
      const arco = Math.sin(u * Math.PI) * 9;
      a.o.position.set(p.x, p.y + arco + 4, p.z);
      const d = a.ruta.muestras.direccionEn(u);
      a.o.rotation.y = Math.atan2(d.x, d.z);
      a.o.rotation.z = Math.cos(u * Math.PI) * 0.22;
      if (u >= 1) {
        this.soltar(a.o);
        this.activos.splice(i, 1);
        a.alAcabar?.();
      }
    }
  }

  vaciar() {
    for (const a of this.activos) this.soltar(a.o);
    this.activos.length = 0;
  }
}

/* ─────────────────── montaje ─────────────────── */

export function construirRutas(grafo, disp, nodosEstacion, escena) {
  const raiz = new THREE.Group();
  raiz.name = 'rutas';

  const compuertas = {};
  const terminales = {};
  const rutas = [];

  /* compuertas y terminales son nodos propios del grafo */
  for (const n of grafo.nodos) {
    if (n.tipo === 'compuerta') {
      const g = construirCompuerta(n);
      g.position.copy(disp.posicionNodo(n));
      raiz.add(g);
      compuertas[n.id] = { dato: n, grupo: g, posicion: g.position.clone() };
      escena.registrarClicable(g);
    } else if (n.tipo === 'terminal') {
      const g = construirTerminal();
      g.position.copy(disp.posicionNodo(n));
      g.userData.idNodo = n.id;
      raiz.add(g);
      terminales[n.id] = { dato: n, grupo: g, posicion: g.position.clone() };
    }
  }

  /* resuelve «E02#secretaria» → posición del satélite */
  const posicionDe = (clave) => {
    if (clave.includes('#')) {
      const [id, carril] = clave.split('#');
      const est = nodosEstacion[id];
      const sat = est?.satelites.find((s) => s.dato.carril === carril);
      if (sat) return sat.grupo.position.clone().setY(Y_RUTA);
      return est ? est.posicion.clone().setY(Y_RUTA) : null;
    }
    if (nodosEstacion[clave]) return nodosEstacion[clave].posicion.clone().setY(Y_RUTA);
    if (compuertas[clave]) return compuertas[clave].posicion.clone().setY(Y_RUTA);
    if (terminales[clave]) return terminales[clave].posicion.clone().setY(Y_RUTA);
    return null;
  };

  for (const r of grafo.rutas) {
    const a = posicionDe(r.de);
    const b = posicionDe(r.a);
    if (!a || !b) { console.warn('[rutas] extremo sin resolver:', r.de, '→', r.a); continue; }

    // retira el trazo de los centros para que no se meta bajo los muebles
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const a2 = a.clone().addScaledVector(dir, 9);
    const b2 = b.clone().addScaledVector(dir, -9);

    const puntos = trazar(a2, b2);
    const estilo = ESTILO[r.tipo] ?? ESTILO.principal;
    const g = construirRuta(puntos, estilo, !!r.destacada);
    g.userData.ruta = r;
    raiz.add(g);

    rutas.push({
      dato: r, grupo: g, puntos,
      muestras: muestreador(puntos),
      material: g.userData.material,
      opacidadBase: g.userData.opacidadBase,
    });
  }

  /* el expediente y el almacén de viajeros */
  const expediente = new Expediente();
  raiz.add(expediente.grupo);
  const almacen = new Almacen(raiz);

  const porOrigen = (id) => rutas.filter((x) => x.dato.de === id || x.dato.de.startsWith(id + '#'));
  const buscar = (de, a) => rutas.find((x) => x.dato.de === de && x.dato.a === a);

  return {
    grupo: raiz, rutas, compuertas, terminales, expediente, almacen,
    porOrigen, buscar,
    actualizar: (dt) => almacen.actualizar(dt),

    /** Lanza por sus rutas salientes los objetos que esta etapa despacha. */
    despachar(idNodo, { incluirPrincipal = false } = {}) {
      for (const r of porOrigen(idNodo)) {
        if (!r.dato.objeto) continue;
        if (!incluirPrincipal && r.dato.tipo === 'principal') continue;
        almacen.lanzar(r.dato.objeto, r, 1.5 + r.muestras.largo / 320);
      }
    },

    /** Mueve el expediente por una ruta concreta. */
    moverExpediente(ruta, duracion = 1.6) {
      return new Promise((listo) => {
        expediente.mostrar(true);
        const inicio = performance.now();
        const paso = () => {
          const u = Math.min((performance.now() - inicio) / (duracion * 1000), 1);
          const p = ruta.muestras.en(u);
          expediente.grupo.position.set(p.x, p.y + Math.sin(u * Math.PI) * 7 + 3, p.z);
          const d = ruta.muestras.direccionEn(u);
          expediente.grupo.rotation.y = Math.atan2(d.x, d.z);
          if (u < 1) requestAnimationFrame(paso); else listo();
        };
        paso();
      });
    },

    /** Coloca el expediente en reposo sobre una estación. */
    posarExpediente(punto) {
      expediente.mostrar(true);
      expediente.grupo.position.set(punto.x, punto.y + 10.5, punto.z + 11);
      expediente.grupo.rotation.y = 0;
    },

    /** Atenúa todo lo que no sea la ruta activa. */
    enfocarRutas(idNodo) {
      for (const r of rutas) {
        const suya = idNodo != null &&
          (r.dato.de === idNodo || r.dato.de.startsWith(idNodo + '#') ||
           r.dato.a === idNodo || r.dato.a.startsWith(idNodo + '#'));
        const o = idNodo == null ? r.opacidadBase : (suya ? Math.min(1, r.opacidadBase + 0.3) : r.opacidadBase * 0.25);
        r.material.opacity = o;
      }
    },

    /** Muestra sólo la vía elegida en el conmutador ordinario/verbal. */
    filtrarVia(via) {
      for (const r of rutas) {
        const v = r.dato.via;
        r.grupo.visible = !v || via === 'ambas' || v === via;
      }
    },

    liberar() { almacen.vaciar(); },
  };
}

export { Y_RUTA, Y_VIAJE };
