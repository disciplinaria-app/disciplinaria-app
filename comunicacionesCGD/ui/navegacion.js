/* ═══════════════════════════════════════════════════════════════
   navegacion.js — índice, teclado, recorrido guiado y conmutador
   de vía.

   Sobre el teclado: las flechas mueven la cámara MÁS RÁPIDO que el
   clic (0,55 s frente a 1,2 s). Una acción de teclado se repite
   decenas de veces y una animación larga la vuelve pesada; el clic,
   en cambio, es exploratorio y aguanta el vuelo. No es incoherencia:
   es que la prisa del usuario es distinta en cada caso.
   ═══════════════════════════════════════════════════════════════ */

const ESPERA_RECORRIDO = 8000;

export class Navegacion {
  constructor({ etapas, grafo, elementos, acciones }) {
    this.etapas = etapas;
    this.grafo = grafo;
    this.el = elementos;
    this.acciones = acciones;

    this.actual = null;
    this.via = 'ambas';
    this.recorriendo = false;
    this._temporizador = null;

    this._construirIndice();
    this._cablearMandos();
    this._cablearTeclado();
  }

  /* ─────────────────── índice ─────────────────── */

  _construirIndice() {
    const cont = this.el.indiceCuerpo;
    cont.textContent = '';
    this.botones = new Map();

    for (const fase of this.grafo.fases) {
      const grupo = document.createElement('section');
      grupo.className = 'fase-grupo';

      const et = document.createElement('h2');
      et.className = 'fase-grupo__et';
      et.textContent = fase.id;
      grupo.appendChild(et);

      for (const id of fase.etapas) {
        const e = this.etapas.find((x) => x.id === id);
        if (!e) continue;
        const nodo = this.grafo.nodos.find((n) => n.id === id);

        const b = document.createElement('button');
        b.className = 'indice-item';
        b.type = 'button';
        b.dataset.id = id;
        b.setAttribute('aria-current', 'false');

        const sid = document.createElement('span');
        sid.className = 'indice-item__id mono';
        sid.textContent = id;

        const stx = document.createElement('span');
        stx.className = 'indice-item__tx';
        stx.textContent = e.titulo;

        if (nodo?.via) {
          const v = document.createElement('span');
          v.className = 'indice-item__via';
          v.textContent = nodo.via;
          stx.appendChild(v);
        }

        b.append(sid, stx);
        b.addEventListener('click', () => {
          this.detenerRecorrido();
          this.seleccionar(id);
        });
        grupo.appendChild(b);
        this.botones.set(id, b);
      }
      cont.appendChild(grupo);
    }
  }

  /* ─────────────────── selección ─────────────────── */

  seleccionar(id, opciones = {}) {
    if (!this.etapas.some((e) => e.id === id)) return;
    this.actual = id;

    for (const [k, b] of this.botones) {
      b.setAttribute('aria-current', k === id ? 'true' : 'false');
    }
    const b = this.botones.get(id);
    if (b && !opciones.sinDesplazar) {
      b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    this.acciones.alSeleccionar(id, opciones);
    this._anunciar(id);
    this._actualizarMandos();
  }

  _anunciar(id) {
    const e = this.etapas.find((x) => x.id === id);
    if (!e || !this.el.anuncio) return;
    this.el.anuncio.textContent = `${e.id}. ${e.titulo}. Fase: ${e.fase}.`;
  }

  deseleccionar() {
    this.actual = null;
    for (const b of this.botones.values()) b.setAttribute('aria-current', 'false');
    this._actualizarMandos();
  }

  /* ─────────────────── orden de recorrido ─────────────────── */

  get orden() {
    const base = this.grafo.recorridoGuiado;
    if (this.via === 'ambas') return base;
    const fuera = this.via === 'ordinario' ? 'E08B' : 'E08A';
    return base.filter((id) => id !== fuera);
  }

  avanzar(paso, opciones = {}) {
    const o = this.orden;
    if (!o.length) return;
    const i = this.actual ? o.indexOf(this.actual) : -1;
    const j = i < 0 ? (paso > 0 ? 0 : o.length - 1)
                    : (i + paso + o.length) % o.length;
    this.seleccionar(o[j], opciones);
  }

  /* ─────────────────── recorrido guiado ─────────────────── */

  alternarRecorrido() {
    this.recorriendo ? this.detenerRecorrido() : this.iniciarRecorrido();
  }

  iniciarRecorrido() {
    this.recorriendo = true;
    this.el.btnRecorrido.setAttribute('aria-pressed', 'true');
    if (!this.actual) this.seleccionar(this.orden[0]);
    this._programar();
  }

  detenerRecorrido() {
    if (!this.recorriendo) return;
    this.recorriendo = false;
    this.el.btnRecorrido.setAttribute('aria-pressed', 'false');
    clearTimeout(this._temporizador);
  }

  _programar() {
    clearTimeout(this._temporizador);
    if (!this.recorriendo) return;
    this._temporizador = setTimeout(() => {
      if (!this.recorriendo) return;
      const o = this.orden;
      const i = o.indexOf(this.actual);
      if (i >= o.length - 1) { this.detenerRecorrido(); return; }  // no da vueltas sin fin
      this.seleccionar(o[i + 1]);
      this._programar();
    }, ESPERA_RECORRIDO);
  }

  /* ─────────────────── mandos ─────────────────── */

  _cablearMandos() {
    const e = this.el;

    e.btnRecorrido.addEventListener('click', () => this.alternarRecorrido());
    e.btnAnterior.addEventListener('click', () => { this.detenerRecorrido(); this.avanzar(-1); });
    e.btnSiguiente.addEventListener('click', () => { this.detenerRecorrido(); this.avanzar(1); });
    e.btnAlejar.addEventListener('click', () => { this.detenerRecorrido(); this.acciones.alAlejar(); });

    e.btnIndice.addEventListener('click', () => {
      const oculto = e.indice.hasAttribute('data-oculto');
      e.indice.toggleAttribute('data-oculto', !oculto);
      e.btnIndice.setAttribute('aria-expanded', oculto ? 'true' : 'false');
      this.acciones.alCambiarInsets?.();
    });

    for (const b of e.conmutadorVia) {
      b.addEventListener('click', () => {
        this.via = b.dataset.via;
        for (const o of e.conmutadorVia) {
          o.setAttribute('aria-checked', o === b ? 'true' : 'false');
        }
        this._atenuarIndice();
        this.acciones.alCambiarVia(this.via);
        // si la etapa visible queda fuera de la vía, salta a la otra
        const fuera = this.via === 'ordinario' ? 'E08B' : this.via === 'verbal' ? 'E08A' : null;
        if (fuera && this.actual === fuera) {
          this.seleccionar(fuera === 'E08A' ? 'E08B' : 'E08A');
        }
      });
    }

    e.chkReglas.addEventListener('change', () => this.acciones.alAlternarReglas(e.chkReglas.checked));
    e.chkTerminos.addEventListener('change', () => this.acciones.alAlternarCalculadora(e.chkTerminos.checked));
  }

  _atenuarIndice() {
    for (const [id, b] of this.botones) {
      const nodo = this.grafo.nodos.find((n) => n.id === id);
      const fuera = nodo?.via && this.via !== 'ambas' && nodo.via !== this.via;
      b.toggleAttribute('data-atenuado', !!fuera);
    }
  }

  _actualizarMandos() {
    this.el.btnAlejar.hidden = !this.actual;
  }

  /* ─────────────────── teclado ─────────────────── */

  _cablearTeclado() {
    window.addEventListener('keydown', (ev) => {
      // no robar teclas a un campo de texto ni a un modificador
      const t = ev.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      // dentro del índice, Enter y Espacio los maneja el propio botón
      switch (ev.key) {
        case 'ArrowRight':
          ev.preventDefault();
          this.detenerRecorrido();
          this.avanzar(1, { duracion: 0.55 });
          break;
        case 'ArrowLeft':
          ev.preventDefault();
          this.detenerRecorrido();
          this.avanzar(-1, { duracion: 0.55 });
          break;
        case 'Escape':
          ev.preventDefault();
          this.detenerRecorrido();
          this.acciones.alAlejar();
          break;
        case ' ':
          if (t === document.body) { ev.preventDefault(); this.alternarRecorrido(); }
          break;
        case 'Home':
          ev.preventDefault();
          this.detenerRecorrido();
          this.seleccionar(this.orden[0], { duracion: 0.55 });
          break;
        case 'End':
          ev.preventDefault();
          this.detenerRecorrido();
          this.seleccionar(this.orden[this.orden.length - 1], { duracion: 0.55 });
          break;
      }
    });
  }
}
