/* ═══════════════════════════════════════════════════════════════
   materiales.js — paleta, materiales y caché de geometrías.

   Decisión de diseño: las siete plataformas comparten UN material de
   pizarra fría. El carril se identifica por una franja de color en el
   canto y por el color del rótulo, no por el color de toda la isla.
   Siete tonos de plataforma sobre azul convierten el diagrama en un
   juguete; una sola pizarra lo deja leer como un plano.

   El ámbar queda reservado para el expediente y para lo activo. Si
   algo es ámbar, es porque se mueve o porque es el foco.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export const COLOR = {
  plataforma:     0xEDF3FA,
  plataformaCanto:0x8AA4C6,
  plataformaBajo: 0x6B86A8,

  mueble:         0xFBFDFF,
  muebleSombra:   0xB7C7DC,
  metal:          0x8699B4,
  metalOscuro:    0x5A6D87,

  acento:         0xF2C94C,
  acentoHondo:    0xD9A520,
  alerta:         0xEB5757,
  ok:             0x27AE60,
  pantalla:       0x56CCF2,
  papel:          0xFFFFFF,
  tinta:          0x1B2A41,

  ropaA:          0x3F6499,
  ropaB:          0x6E7E96,
  ropaToga:       0x2A3550,
  ropaC:          0xB4707F,
  piel:           0xE8C9A8,
  pielB:          0xB9835A,
  pelo:           0x3A3340,
  casco:          0xF2C94C,
};

/* ─────────────────── materiales compartidos ─────────────────── */

const cacheMat = new Map();

/** Material lambert cacheado por color. Lambert y no standard: el acabado
 *  es plano a propósito, sin reflejo especular, y cuesta la mitad. */
export function mat(color, extra) {
  const clave = color + '|' + (extra ? JSON.stringify(extra) : '');
  let m = cacheMat.get(clave);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...extra });
    cacheMat.set(clave, m);
  }
  return m;
}

/** Material propio (no cacheado): para lo que necesita opacidad individual. */
export function matPropio(color, extra) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

export const matEmisivo = (color, intensidad = 0.9) =>
  mat(color, { emissive: color, emissiveIntensity: intensidad });

/* ─────────────────── caché de geometrías ─────────────────── */

const cacheGeo = new Map();

function cachear(clave, crear) {
  let g = cacheGeo.get(clave);
  if (!g) { g = crear(); cacheGeo.set(clave, g); }
  return g;
}

export const geoCaja = (x, y, z) =>
  cachear(`c${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z));

export const geoCilindro = (r, h, s = 12) =>
  cachear(`y${r},${h},${s}`, () => new THREE.CylinderGeometry(r, r, h, s));

export const geoEsfera = (r, s = 12) =>
  cachear(`e${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s - 2)));

export const geoCapsula = (r, h, s = 8) =>
  cachear(`k${r},${h},${s}`, () => new THREE.CapsuleGeometry(r, h, 3, s));

export const geoCono = (r, h, s = 10) =>
  cachear(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));

export const geoPlano = (x, z) =>
  cachear(`p${x},${z}`, () => {
    const g = new THREE.PlaneGeometry(x, z);
    g.rotateX(-Math.PI / 2);
    return g;
  });

/* ─────────────────── ayudas de composición ─────────────────── */

/** Malla posicionada en un paso, con sombras ya configuradas. */
export function pieza(geo, material, x = 0, y = 0, z = 0, opciones = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (opciones.rot) m.rotation.set(opciones.rot[0] || 0, opciones.rot[1] || 0, opciones.rot[2] || 0);
  if (opciones.escala) {
    if (Array.isArray(opciones.escala)) m.scale.set(...opciones.escala);
    else m.scale.setScalar(opciones.escala);
  }
  m.castShadow = opciones.sombra !== false;
  m.receiveShadow = opciones.recibe !== false;
  return m;
}

/** Caja rápida: el 80 % de la escenografía son cajas. */
export const caja = (an, al, pr, color, x, y, z, op) =>
  pieza(geoCaja(an, al, pr), typeof color === 'number' ? mat(color) : color, x, y, z, op);

export const cilindro = (r, h, color, x, y, z, op) =>
  pieza(geoCilindro(r, h), typeof color === 'number' ? mat(color) : color, x, y, z, op);

/** Recorre un grupo y le aplica una opacidad, clonando materiales la
 *  primera vez para no afectar a los demás objetos que los comparten. */
export function fijarOpacidad(raiz, valor) {
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData._matPropio) {
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      o.userData._matPropio = true;
    }
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      m.transparent = valor < 1;
      m.opacity = valor;
      m.depthWrite = valor > 0.92;
    }
  });
}

export function liberarCaches() {
  for (const g of cacheGeo.values()) g.dispose();
  for (const m of cacheMat.values()) m.dispose();
  cacheGeo.clear();
  cacheMat.clear();
}
