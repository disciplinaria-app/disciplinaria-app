/* ═══════════════════════════════════════════════════════════════
   escena.js — renderer, cámara isométrica, luces, cuadrícula,
   capa de rótulos, raycasting y bucle.

   La cámara es ortográfica en ángulo isométrico verdadero:
   45° en Y y atan(1/√2) = 35,264° en X. Eso se consigue poniendo
   la cámara en la dirección (1,1,1) mirando al objetivo.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { gsap } from 'gsap';

export const MOV_REDUCIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DIR_ISO = new THREE.Vector3(1, 1, 1).normalize();
const DISTANCIA = 2200;          // lejos: con ortográfica sólo fija el orden de profundidad
const ZOOM_GENERAL = 288;        // semialtura del frustum en la vista general
const ZOOM_CERCA   = 86;        // semialtura al acercarse a una estación

export class Escena {
  constructor(contenedor, capaRotulos) {
    this.contenedor = contenedor;
    this.capaRotulos = capaRotulos;
    this.movil = window.matchMedia('(max-width: 860px)').matches;

    // ── renderer ───────────────────────────────────────────────
    // alpha: el degradado del cielo lo pone el CSS, que lo hace mejor
    // y más barato que un shader de fondo.
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.movil,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearAlpha(0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.movil;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    contenedor.appendChild(this.renderer.domElement);

    this.escena = new THREE.Scene();

    // ── cámara ─────────────────────────────────────────────────
    this.zoom = ZOOM_GENERAL;
    this.objetivo = new THREE.Vector3(0, 0, 0);
    this.camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
    this.insets = { izq: 0, der: 0, arr: 0, aba: 0 };
    this._colocarCamara();

    // ── luces ──────────────────────────────────────────────────
    // menos luz ambiental y más clave: el relleno alto aplanaba las formas
    // y era la razón de que todo se viera lavado
    this.escena.add(new THREE.HemisphereLight(0xcfe2ff, 0x1a4484, 0.72));

    const clave = new THREE.DirectionalLight(0xfff6e8, 2.5);
    clave.position.set(-300, 520, 280);
    if (!this.movil) {
      clave.castShadow = true;
      const s = clave.shadow;
      // 4096 sobre un frustum ajustado al campo real (±420 × ±300) deja el
      // texel en ~0,2 unidades: la sombra de una silla se ve como una silla.
      // Con 2048 sobre ±700 el texel era 0,68 y todo salía empastado.
      s.mapSize.set(4096, 4096);
      s.camera.near = 150; s.camera.far = 1500;
      s.camera.left = -430; s.camera.right = 430;
      s.camera.top = 310; s.camera.bottom = -310;
      s.bias = -0.0004;
      s.normalBias = 0.5;
      s.radius = 1.4;
    }
    this.escena.add(clave);
    this.luzClave = clave;

    const relleno = new THREE.DirectionalLight(0x9dc0ff, 0.42);
    relleno.position.set(420, 240, -360);
    this.escena.add(relleno);

    // luz de contra, rasante: dibuja el canto de las losas contra el campo
    const contra = new THREE.DirectionalLight(0xbcd8ff, 0.55);
    contra.position.set(260, 90, 440);
    this.escena.add(contra);

    // ── cuadrícula ─────────────────────────────────────────────
    this.escena.add(this._crearCuadricula());

    // ── interacción ────────────────────────────────────────────
    this.raycaster = new THREE.Raycaster();
    this.puntero = new THREE.Vector2();
    this.clicables = [];
    this.rotulos = [];
    this._bajoPuntero = null;

    this.reloj = new THREE.Clock();
    this._tareas = [];
    this._activa = true;

    this._redimensionar();
    window.addEventListener('resize', () => this._redimensionar());
    document.addEventListener('visibilitychange', () => {
      this._activa = !document.hidden;
      if (this._activa) this.reloj.getDelta();   // descarta el salto
    });
  }

  /* ─────────────────── cámara ─────────────────── */

  _colocarCamara() {
    this.camara.position.copy(this.objetivo).addScaledVector(DIR_ISO, DISTANCIA);
    this.camara.lookAt(this.objetivo);
    this.camara.updateMatrixWorld();
  }

  /** Reencuadra para que el contenido quede centrado en la zona visible,
   *  no en el lienzo completo: el índice y el panel tapan los costados. */
  _aplicarEncuadre() {
    const an = this.contenedor.clientWidth || 1;
    const al = this.contenedor.clientHeight || 1;
    const aspecto = an / al;

    this.camara.top = this.zoom;
    this.camara.bottom = -this.zoom;
    this.camara.left = -this.zoom * aspecto;
    this.camara.right = this.zoom * aspecto;

    this._colocarCamara();

    const unidadPorPixel = (this.zoom * 2) / al;
    const { izq, der, arr, aba } = this.insets;
    const dx = ((izq - der) / 2) * unidadPorPixel;
    const dy = ((aba - arr) / 2) * unidadPorPixel;

    const derecha = new THREE.Vector3().setFromMatrixColumn(this.camara.matrixWorld, 0);
    const arriba  = new THREE.Vector3().setFromMatrixColumn(this.camara.matrixWorld, 1);

    this.camara.position.addScaledVector(derecha, -dx).addScaledVector(arriba, -dy);
    this.camara.updateProjectionMatrix();
    this.camara.updateMatrixWorld();
  }

  fijarInsets(insets) {
    Object.assign(this.insets, insets);
    this._aplicarEncuadre();
  }

  /** Vuela el objetivo y el zoom. `duracion: 0` corta en seco. */
  encuadrar(objetivo, zoom, duracion = 1.2) {
    const dur = MOV_REDUCIDO ? 0 : duracion;
    gsap.killTweensOf(this._tweenCam);
    if (dur === 0) {
      this.objetivo.copy(objetivo);
      this.zoom = zoom;
      this._aplicarEncuadre();
      return Promise.resolve();
    }
    return new Promise((listo) => {
      this._tweenCam = { x: this.objetivo.x, y: this.objetivo.y, z: this.objetivo.z, z0: this.zoom };
      gsap.to(this._tweenCam, {
        x: objetivo.x, y: objetivo.y, z: objetivo.z, z0: zoom,
        duration: dur,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.objetivo.set(this._tweenCam.x, this._tweenCam.y, this._tweenCam.z);
          this.zoom = this._tweenCam.z0;
          this._aplicarEncuadre();
        },
        onComplete: listo,
      });
    });
  }

  verGeneral(duracion = 1.0) {
    return this.encuadrar(new THREE.Vector3(0, 0, 0), ZOOM_GENERAL, duracion);
  }

  acercarA(punto, duracion = 1.2) {
    return this.encuadrar(punto.clone(), ZOOM_CERCA, duracion);
  }

  get estaCerca() { return this.zoom < ZOOM_GENERAL * 0.7; }

  /* ─────────────────── cuadrícula ─────────────────── */

  _crearCuadricula() {
    const geo = new THREE.PlaneGeometry(4200, 4200);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPaso:   { value: 52.0 },
        uGrueso: { value: 1.25 },
        uColor:  { value: new THREE.Color(0xffffff) },
        uAlfa:   { value: 0.085 },
        uRadio:  { value: 1500.0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vMundo;
        void main() {
          vec4 m = modelMatrix * vec4(position, 1.0);
          vMundo = m.xyz;
          gl_Position = projectionMatrix * viewMatrix * m;
        }`,
      fragmentShader: /* glsl */`
        uniform float uPaso, uGrueso, uAlfa, uRadio;
        uniform vec3  uColor;
        varying vec3  vMundo;

        float linea(vec2 p, float paso) {
          vec2 r = abs(fract(p / paso - 0.5) - 0.5) / fwidth(p / paso);
          return 1.0 - min(min(r.x, r.y), 1.0);
        }

        void main() {
          vec2 p = vMundo.xz;
          float fina   = linea(p, uPaso)       * 0.55;
          float gruesa = linea(p, uPaso * 5.0) * 1.0;
          float g = max(fina, gruesa) * uGrueso;

          // se apaga con la distancia para que el plano no tenga borde
          float caida = 1.0 - smoothstep(uRadio * 0.25, uRadio, length(p));
          float a = g * uAlfa * caida;
          if (a < 0.002) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const malla = new THREE.Mesh(geo, mat);
    malla.position.y = -0.4;
    malla.renderOrder = -1;
    malla.name = 'cuadricula';
    return malla;
  }

  /* ─────────────────── rótulos ─────────────────── */

  /** Rótulo HTML anclado a un punto del mundo. No usamos CSS2DRenderer
   *  porque queremos rotarlos en el eje isométrico y clasificarlos por CSS. */
  agregarRotulo(texto, punto, clases = []) {
    const el = document.createElement('span');
    el.className = ['rotulo', ...clases].join(' ');
    el.textContent = texto;
    this.capaRotulos.appendChild(el);
    const r = { el, punto: punto.clone(), visible: true, _x: 0, _y: 0 };
    this.rotulos.push(r);
    return r;
  }

  _proyectarRotulos() {
    const an = this.contenedor.clientWidth;
    const al = this.contenedor.clientHeight;
    const v = new THREE.Vector3();
    for (const r of this.rotulos) {
      if (!r.visible) { if (r.el.style.display !== 'none') r.el.style.display = 'none'; continue; }
      v.copy(r.punto).project(this.camara);
      const x = (v.x * 0.5 + 0.5) * an;
      const y = (-v.y * 0.5 + 0.5) * al;
      // fuera de pantalla con margen: se oculta, no se dibuja
      if (x < -220 || x > an + 220 || y < -120 || y > al + 120) {
        if (r.el.style.display !== 'none') r.el.style.display = 'none';
        continue;
      }
      if (r.el.style.display === 'none') r.el.style.display = '';
      if (Math.abs(x - r._x) > 0.3 || Math.abs(y - r._y) > 0.3) {
        r._x = x; r._y = y;
        r.el.style.left = x.toFixed(1) + 'px';
        r.el.style.top  = y.toFixed(1) + 'px';
      }
    }
  }

  /* ─────────────────── raycasting ─────────────────── */

  registrarClicable(objeto) { this.clicables.push(objeto); }

  _actualizarPuntero(ev) {
    const c = this.renderer.domElement.getBoundingClientRect();
    this.puntero.x = ((ev.clientX - c.left) / c.width) * 2 - 1;
    this.puntero.y = -((ev.clientY - c.top) / c.height) * 2 + 1;
  }

  interseccion(ev) {
    this._actualizarPuntero(ev);
    this.raycaster.setFromCamera(this.puntero, this.camara);
    const hits = this.raycaster.intersectObjects(this.clicables, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.idNodo) o = o.parent;
    return o || null;
  }

  /* ─────────────────── bucle ─────────────────── */

  cadaCuadro(fn) { this._tareas.push(fn); }

  arrancar() {
    this.renderer.setAnimationLoop(() => {
      if (!this._activa) return;
      const dt = Math.min(this.reloj.getDelta(), 0.05);
      const t = this.reloj.getElapsedTime();
      for (const fn of this._tareas) fn(dt, t);
      this._proyectarRotulos();
      this.renderer.render(this.escena, this.camara);
    });
  }

  _redimensionar() {
    const an = this.contenedor.clientWidth;
    const al = this.contenedor.clientHeight;
    this.movil = window.matchMedia('(max-width: 860px)').matches;
    this.renderer.setSize(an, al, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._aplicarEncuadre();
  }

  liberar() {
    this.renderer.setAnimationLoop(null);
    this.escena.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}

/** ¿Hay WebGL utilizable? */
export function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}
