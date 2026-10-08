/* ═══════════════════════════════════════════════════════════════
   personajes.js — figuras genéricas construidas por código y sus
   animaciones por fotogramas clave.

   Sin rasgos faciales y sin nombres: son roles, no personas
   («Instructor/a OCDI», «Secretaría», «Disciplinable»…). Ningún
   modelo externo, ninguna licencia que rastrear.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import {
  COLOR, mat, geoEsfera, geoCapsula, geoCaja, geoCilindro, pieza, caja,
} from './materiales.js';

const ROPA = {
  ocdi:            COLOR.ropaA,
  secretaria:      COLOR.pantalla,
  disciplinable:   COLOR.ropaB,
  defensa:         COLOR.ropaToga,
  defensorPublico: COLOR.ropaToga,
  quejoso:         COLOR.ropaC,
  juzgamiento:     COLOR.ropaToga,
  segunda:         COLOR.ropaToga,
  ministerioPublico: COLOR.ok,
  nominador:       COLOR.ropaA,
};

const PIEL = [COLOR.piel, COLOR.pielB];

/* ─────────────────── construcción ─────────────────── */

/**
 * Figura de ~13,5 unidades de alto. El origen está a los pies.
 * Devuelve el grupo con referencias a las partes articuladas.
 */
export function crearPersonaje(rol = 'ocdi', semilla = 0) {
  const g = new THREE.Group();
  g.name = 'personaje:' + rol;

  const colorRopa = ROPA[rol] ?? COLOR.ropaB;
  const colorPiel = PIEL[semilla % PIEL.length];
  const mRopa = mat(colorRopa);
  const mPiel = mat(colorPiel);

  // piernas
  const piernas = new THREE.Group();
  piernas.add(pieza(geoCapsula(0.85, 2.6), mat(COLOR.tinta), -1.0, 2.1, 0));
  piernas.add(pieza(geoCapsula(0.85, 2.6), mat(COLOR.tinta),  1.0, 2.1, 0));
  g.add(piernas);

  // torso: tronco articulado del que cuelga todo lo demás
  const tronco = new THREE.Group();
  tronco.position.y = 4.1;
  g.add(tronco);

  tronco.add(pieza(geoCapsula(1.85, 2.9), mRopa, 0, 2.3, 0));

  // brazos — pivotan desde el hombro
  const hombroIzq = new THREE.Group(); hombroIzq.position.set(-2.1, 3.5, 0);
  const hombroDer = new THREE.Group(); hombroDer.position.set( 2.1, 3.5, 0);
  tronco.add(hombroIzq, hombroDer);

  const brazoGeo = geoCapsula(0.62, 2.3);
  const brazoIzq = pieza(brazoGeo, mRopa, 0, -1.5, 0);
  const brazoDer = pieza(brazoGeo, mRopa, 0, -1.5, 0);
  hombroIzq.add(brazoIzq);
  hombroDer.add(brazoDer);

  const manoIzq = pieza(geoEsfera(0.66, 8), mPiel, 0, -2.9, 0);
  const manoDer = pieza(geoEsfera(0.66, 8), mPiel, 0, -2.9, 0);
  hombroIzq.add(manoIzq);
  hombroDer.add(manoDer);

  // cuello y cabeza — la cabeza pivota desde el cuello
  const cuello = new THREE.Group();
  cuello.position.y = 4.4;
  tronco.add(cuello);
  cuello.add(pieza(geoEsfera(1.85, 12), mPiel, 0, 1.6, 0));
  // tapa de pelo: media esfera aplastada, sin rasgos
  const pelo = pieza(geoEsfera(1.88, 12), mat(COLOR.pelo), 0, 1.78, -0.12, { escala: [1, 0.72, 1] });
  cuello.add(pelo);

  g.userData.partes = { piernas, tronco, hombroIzq, hombroDer, manoIzq, manoDer, cuello, pelo };
  g.userData.semilla = (semilla % 7) * 0.9;
  return g;
}

/** Accesorio en la mano: carpeta, lupa, sobre, mazo… */
export function ponerEnMano(personaje, lado, objeto) {
  const h = lado === 'izq' ? personaje.userData.partes.hombroIzq : personaje.userData.partes.hombroDer;
  objeto.position.set(0, -3.3, 0.5);
  h.add(objeto);
  return objeto;
}

export function carpeta(color = COLOR.acento) {
  const g = new THREE.Group();
  g.add(caja(2.6, 0.45, 3.2, color, 0, 0, 0));
  g.add(caja(2.3, 0.2, 2.9, COLOR.papel, 0, 0.3, 0));
  return g;
}

export function lupa() {
  const g = new THREE.Group();
  g.add(pieza(geoCilindro(0.9, 0.18, 12), mat(COLOR.pantalla, { transparent: true, opacity: 0.55 }), 0, 0, 0, { rot: [Math.PI / 2, 0, 0] }));
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 6, 14), mat(COLOR.metalOscuro));
  g.add(aro);
  g.add(caja(0.22, 1.5, 0.22, COLOR.metalOscuro, 0, -1.2, 0));
  return g;
}

/* ─────────────────── animaciones ───────────────────
   Cada receta recibe (p = partes, t = tiempo, s = semilla) y escribe
   rotaciones. Son bucles lentos (2–4 s) y en seno: son ambiente, no
   interfaz. La interfaz se mueve en milisegundos; el ambiente, no.
   ─────────────────────────────────────────────────── */

const sin = (t, periodo, fase = 0) => Math.sin((t / periodo + fase) * Math.PI * 2);
/** 0→1→0 con reposo: para gestos con golpe (sellar, radicar). */
function golpe(t, periodo, anchoGolpe = 0.26) {
  const f = (t / periodo) % 1;
  if (f > anchoGolpe) return 0;
  const u = f / anchoGolpe;
  return Math.sin(u * Math.PI);
}

export const ANIMACIONES = {
  idle(p, t, s) {
    p.tronco.position.y = 4.1 + sin(t, 3.4, s) * 0.13;
    p.cuello.rotation.y = sin(t, 7.0, s) * 0.16;
    p.hombroIzq.rotation.x = sin(t, 3.4, s) * 0.05;
    p.hombroDer.rotation.x = sin(t, 3.4, s + 0.5) * 0.05;
  },

  radicar(p, t, s) {
    const k = golpe(t + s, 2.2);
    p.tronco.rotation.x = 0.1 + k * 0.14;
    p.hombroDer.rotation.x = -0.5 - k * 1.1;
    p.hombroIzq.rotation.x = -0.35;
    p.cuello.rotation.x = 0.22;
  },

  entregar(p, t, s) {
    const f = (Math.sin((t + s) * 1.5) + 1) / 2;
    p.hombroDer.rotation.x = -0.3 - f * 1.15;
    p.hombroIzq.rotation.x = -0.2;
    p.tronco.rotation.x = f * 0.12;
    p.cuello.rotation.x = 0.1;
  },

  recibir(p, t, s) {
    const f = (Math.sin((t + s) * 1.3) + 1) / 2;
    p.hombroIzq.rotation.x = -0.25 - f * 1.0;
    p.hombroDer.rotation.x = -0.25 - f * 0.9;
    p.cuello.rotation.x = 0.14;
  },

  examinar(p, t, s) {
    p.cuello.rotation.y = sin(t, 4.6, s) * 0.5;
    p.tronco.rotation.y = sin(t, 4.6, s) * 0.14;
    p.hombroDer.rotation.x = -1.35 + sin(t, 4.6, s) * 0.1;   // sostiene la lupa en alto
    p.hombroIzq.rotation.x = -0.12;
  },

  firmar(p, t, s) {
    p.tronco.rotation.x = 0.2;
    p.cuello.rotation.x = 0.3;
    p.hombroDer.rotation.x = -1.1;
    p.hombroDer.rotation.z = sin(t, 1.1, s) * 0.3;            // el trazo
    p.hombroIzq.rotation.x = -0.75;
  },

  redactar(p, t, s) {
    ANIMACIONES.firmar(p, t, s);
    p.cuello.rotation.y = sin(t, 6.0, s) * 0.12;
  },

  tomarVersion(p, t, s) {
    p.tronco.rotation.x = 0.14;
    p.cuello.rotation.x = 0.2 + sin(t, 2.6, s) * 0.14;        // asiente
    p.hombroDer.rotation.x = -1.0;
    p.hombroDer.rotation.z = sin(t, 1.3, s) * 0.22;
    p.hombroIzq.rotation.x = -0.6;
  },

  declarar(p, t, s) {
    p.cuello.rotation.y = sin(t, 3.2, s) * 0.18;
    p.hombroDer.rotation.x = -0.55 + sin(t, 1.7, s) * 0.28;   // gesticula al hablar
    p.hombroIzq.rotation.x = -0.4 + sin(t, 1.7, s + 0.4) * 0.2;
    p.tronco.position.y = 4.1 + sin(t, 3.0, s) * 0.08;
  },

  cerrarExpediente(p, t, s) {
    const k = golpe(t + s, 2.8, 0.34);
    p.tronco.rotation.x = 0.16 + k * 0.1;
    p.hombroDer.rotation.x = -0.9 - k * 0.55;
    p.hombroIzq.rotation.x = -0.9 - k * 0.55;
    p.cuello.rotation.x = 0.26;
  },

  pesar(p, t, s) {
    const b = sin(t, 3.6, s);
    p.hombroIzq.rotation.x = -1.25 + b * 0.3;
    p.hombroDer.rotation.x = -1.25 - b * 0.3;
    p.cuello.rotation.y = b * 0.3;
    p.tronco.rotation.z = b * 0.05;
  },

  elegir(p, t, s) {
    const b = sin(t, 4.2, s);
    p.hombroDer.rotation.x = -1.15;
    p.hombroDer.rotation.z = b * 0.55;                        // alcanza una u otra carpeta
    p.tronco.rotation.y = b * 0.2;
    p.cuello.rotation.y = b * 0.3;
  },

  presidir(p, t, s) {
    p.tronco.position.y = 4.1 + sin(t, 4.0, s) * 0.1;
    p.hombroDer.rotation.x = -0.75 + sin(t, 2.1, s) * 0.3;
    p.hombroIzq.rotation.x = -0.7;
    p.cuello.rotation.y = sin(t, 5.4, s) * 0.34;              // se dirige a cada parte
  },

  revisar(p, t, s) {
    p.tronco.rotation.x = 0.18;
    p.cuello.rotation.x = 0.34;
    p.cuello.rotation.y = sin(t, 3.0, s) * 0.22;              // recorre el renglón
    p.hombroIzq.rotation.x = -0.95;
    p.hombroDer.rotation.x = -0.95 + Math.max(0, golpe(t + s, 5.0, 0.12)) * 0.8; // pasa la hoja
  },

  sellar(p, t, s) {
    const k = golpe(t + s, 2.6, 0.22);
    p.hombroDer.rotation.x = -0.45 - k * 1.25;
    p.tronco.rotation.x = 0.08 + k * 0.16;
    p.hombroIzq.rotation.x = -0.5;
    p.cuello.rotation.x = 0.2;
  },

  fijarEdicto(p, t, s) {
    const f = (Math.sin((t + s) * 1.1) + 1) / 2;
    p.hombroDer.rotation.x = -2.1 - f * 0.35;                 // clava arriba
    p.hombroIzq.rotation.x = -1.5;
    p.tronco.position.y = 4.1 + f * 0.4;                      // se estira
    p.cuello.rotation.x = -0.3;
  },

  publicarEstado(p, t, s) {
    p.hombroDer.rotation.x = -1.5 + sin(t, 2.4, s) * 0.18;
    p.hombroDer.rotation.z = -0.25;
    p.hombroIzq.rotation.x = -0.9;
    p.cuello.rotation.x = -0.1;
    p.tronco.rotation.y = -0.18;
  },

  despachar(p, t, s) {
    const f = (Math.sin((t + s) * 1.8) + 1) / 2;
    p.hombroDer.rotation.x = -0.4 - f * 1.2;
    p.hombroIzq.rotation.x = -0.9;
    p.cuello.rotation.y = -0.2;
  },

  comparecer(p, t, s) {
    p.tronco.position.y = 4.1 + Math.abs(sin(t, 1.0, s)) * 0.22;   // paso en el sitio
    p.hombroIzq.rotation.x = sin(t, 1.0, s) * 0.5;
    p.hombroDer.rotation.x = -sin(t, 1.0, s) * 0.5;
    p.piernas.rotation.x = sin(t, 1.0, s) * 0.1;
  },
};

const ALIAS = {
  'tomar-version': 'tomarVersion',
  'cerrar-expediente': 'cerrarExpediente',
  'fijar-edicto': 'fijarEdicto',
  'publicar-estado': 'publicarEstado',
};

export function resolverAnimacion(nombre) {
  if (!nombre) return ANIMACIONES.idle;
  return ANIMACIONES[ALIAS[nombre] || nombre] || ANIMACIONES.idle;
}

/**
 * Registro de personajes animados. Sólo se actualizan los que están
 * «despiertos»: en vista general todos respiran en idle barato; al
 * acercarse, el de la estación enfocada ejecuta su labor.
 */
export class Elenco {
  constructor() { this.fichas = []; }

  inscribir(personaje, animacion, idNodo) {
    const f = {
      personaje,
      partes: personaje.userData.partes,
      semilla: personaje.userData.semilla,
      labor: resolverAnimacion(animacion),
      idNodo,
      intensidad: 1,
    };
    this.fichas.push(f);
    return f;
  }

  /**
   * Todos trabajan siempre. Antes sólo se movía el personaje de la estación
   * enfocada y el resto respiraba: la oficina parecía detenida salvo en un
   * punto. Ahora cada quien hace su labor de continuo y el enfoque sólo sube
   * la amplitud del que miras, que es como se ve una oficina de verdad.
   */
  enfocar(idNodo) {
    for (const f of this.fichas) {
      f.intensidad = idNodo == null ? 0.82 : (f.idNodo === idNodo ? 1 : 0.6);
    }
  }

  actualizar(t) {
    for (const f of this.fichas) {
      if (!f.personaje.visible) continue;
      const p = f.partes;
      f.labor(p, t, f.semilla);
      // la amplitud se aplica después, escalando lo que la receta escribió
      const k = f.intensidad;
      if (k !== 1) {
        p.hombroIzq.rotation.x *= k; p.hombroIzq.rotation.z *= k;
        p.hombroDer.rotation.x *= k; p.hombroDer.rotation.z *= k;
        p.cuello.rotation.x *= k;    p.cuello.rotation.y *= k;
        p.tronco.rotation.x *= k;
      }
      // respiración de fondo: nunca hay una figura completamente quieta
      p.tronco.position.y += Math.sin((t * 0.55 + f.semilla) * Math.PI * 2) * 0.09;
    }
  }

  /** Congela todo en una pose neutra (movimiento reducido). */
  congelar() {
    for (const f of this.fichas) {
      ANIMACIONES.idle(f.partes, 0, 0);
      f.intensidad = 0;
    }
    this.actualizar = () => {};
  }
}

/* ─────────────────── personal en tránsito ───────────────────
   En una oficina la gente camina. Estos van y vienen por su carril
   llevando carpetas, y son lo que convierte una maqueta con figuras
   plantadas en un sitio donde se trabaja.
   ─────────────────────────────────────────────────────────── */

export class Mensajeros {
  constructor() {
    this.grupo = new THREE.Group();
    this.grupo.name = 'mensajeros';
    this.lista = [];
  }

  agregar({ x0, x1, z, rol = 'secretaria', velocidad = 11, fase = 0, conCarpeta = true }) {
    const p = crearPersonaje(rol, 90 + this.lista.length);
    p.position.set(x0, 0, z);
    if (conCarpeta) {
      const c = carpeta(this.lista.length % 3 === 0 ? COLOR.acento : COLOR.papel);
      c.scale.setScalar(0.85);
      ponerEnMano(p, 'der', c);
    }
    this.grupo.add(p);
    this.lista.push({ p, x0, x1, z, velocidad, fase, partes: p.userData.partes });
    return p;
  }

  actualizar(t) {
    for (const m of this.lista) {
      const largo = Math.abs(m.x1 - m.x0);
      if (largo < 1) continue;
      const periodo = (largo / m.velocidad) * 2;
      const u = ((t / periodo) + m.fase) % 1;
      // ida y vuelta, con una pausa corta en cada extremo
      const v = u < 0.5 ? u * 2 : (1 - u) * 2;
      const suave = v < 0.08 ? 0 : v > 0.92 ? 1 : (v - 0.08) / 0.84;
      m.p.position.x = m.x0 + (m.x1 - m.x0) * suave;
      const parado = v < 0.08 || v > 0.92;
      m.p.rotation.y = (u < 0.5 ? 1 : -1) * Math.PI / 2 * Math.sign(m.x1 - m.x0 || 1);

      const q = m.partes;
      if (parado) {
        // en el extremo entrega la carpeta: se inclina y estira el brazo
        q.hombroDer.rotation.x = -1.4;
        q.hombroIzq.rotation.x = -0.3;
        q.tronco.rotation.x = 0.12;
        q.piernas.rotation.x = 0;
        q.tronco.position.y = 4.1;
      } else {
        const paso = Math.sin(t * 7.5 + m.fase * 9);
        q.piernas.rotation.x = paso * 0.42;
        q.hombroIzq.rotation.x = -paso * 0.55;
        q.hombroDer.rotation.x = paso * 0.3 - 0.55;   // el brazo de la carpeta va recogido
        q.tronco.rotation.x = 0.07;
        q.tronco.position.y = 4.1 + Math.abs(paso) * 0.3;
        q.cuello.rotation.y = Math.sin(t * 1.1 + m.fase * 5) * 0.2;
      }
    }
  }

  congelar() { this.actualizar = () => {}; }
}
