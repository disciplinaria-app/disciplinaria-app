/* ═══════════════════════════════════════════════════════════════
   panel.js — panel lateral con el contenido jurídico.

   Regla de oro de este archivo: NADA de lo que sale aquí se compone,
   se resume ni se completa. Cada campo se escribe tal como viene de
   etapas-cgd.json, con textContent (no innerHTML), para que sea
   imposible que una plantilla altere el texto por accidente.
   ═══════════════════════════════════════════════════════════════ */

const URL_FUENTE = 'https://www.secretariasenado.gov.co/senado/basedoc/ley_1952_2019.html';

const ICONO_AVISO =
  '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">' +
  '<path d="M8 1.6 15 13.8H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M8 6.1v3.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<circle cx="8" cy="11.3" r=".95" fill="currentColor"/></svg>';

export class Panel {
  constructor(raiz, { etapas, config, alCerrar }) {
    this.el = raiz;
    this.etapas = etapas;
    this.config = config;
    this.alCerrar = alCerrar;
    this.etapaActual = null;
    this.pestanaActual = 'norma';

    this.refs = {
      id:        raiz.querySelector('#panel-id'),
      fase:      raiz.querySelector('#panel-fase'),
      titulo:    raiz.querySelector('#panel-titulo'),
      carril:    raiz.querySelector('#panel-carril'),
      articulos: raiz.querySelector('#panel-articulos'),
      norma:     raiz.querySelector('#tp-norma'),
      concepto:  raiz.querySelector('#tp-concepto'),
      terminos:  raiz.querySelector('#tp-terminos'),
      cuerpo:    raiz.querySelector('#panel-cuerpo'),
      indicador: raiz.querySelector('.pestanas__indicador'),
    };

    this.botones = [...raiz.querySelectorAll('[role="tab"]')];
    for (const b of this.botones) {
      b.addEventListener('click', () => this.verPestana(b.dataset.tab));
      b.addEventListener('keydown', (ev) => this._tecladoPestanas(ev));
    }

    raiz.querySelector('#btn-cerrar-panel').addEventListener('click', () => this.cerrar());
    window.addEventListener('resize', () => this._moverIndicador());
  }

  /* ─────────────────── apertura y cierre ─────────────────── */

  mostrar(idEtapa) {
    const e = this.etapas.find((x) => x.id === idEtapa);
    if (!e) return;
    const primeraVez = this.el.hidden;
    this.etapaActual = e;

    this._pintarCabecera(e);
    this._pintarNorma(e);
    this._pintarConcepto(e);
    this._pintarTerminos(e);

    if (primeraVez) {
      this.el.hidden = false;
      this.el.setAttribute('data-entrando', '');
      // un cuadro para que el navegador registre el estado inicial
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.el.removeAttribute('data-entrando');
        this._moverIndicador();
      }));
    } else {
      this._moverIndicador();
    }
    this.refs.cuerpo.scrollTop = 0;
    this.verPestana(this.pestanaActual, { silencioso: true });
  }

  cerrar() {
    if (this.el.hidden) return;
    this.el.setAttribute('data-saliendo', '');
    const fin = () => {
      this.el.hidden = true;
      this.el.removeAttribute('data-saliendo');
      this.etapaActual = null;
      this.alCerrar?.();
    };
    // la salida es más rápida que la entrada
    setTimeout(fin, 170);
  }

  get abierto() { return !this.el.hidden; }

  /* ─────────────────── pestañas ─────────────────── */

  verPestana(nombre, { silencioso = false } = {}) {
    this.pestanaActual = nombre;
    for (const b of this.botones) {
      const activa = b.dataset.tab === nombre;
      b.setAttribute('aria-selected', activa ? 'true' : 'false');
      b.tabIndex = activa ? 0 : -1;
      document.getElementById(b.getAttribute('aria-controls')).hidden = !activa;
    }
    this._moverIndicador();
    if (!silencioso) this.refs.cuerpo.scrollTop = 0;
  }

  _moverIndicador() {
    const activa = this.botones.find((b) => b.getAttribute('aria-selected') === 'true');
    if (!activa || this.el.hidden) return;
    const c = activa.parentElement.getBoundingClientRect();
    const r = activa.getBoundingClientRect();
    this.refs.indicador.style.width = r.width + 'px';
    this.refs.indicador.style.transform = `translateX(${r.left - c.left}px)`;
  }

  _tecladoPestanas(ev) {
    const i = this.botones.indexOf(ev.currentTarget);
    let j = null;
    if (ev.key === 'ArrowRight') j = (i + 1) % this.botones.length;
    else if (ev.key === 'ArrowLeft') j = (i - 1 + this.botones.length) % this.botones.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = this.botones.length - 1;
    if (j === null) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.botones[j].focus();
    this.verPestana(this.botones[j].dataset.tab);
  }

  /* ─────────────────── pintado ─────────────────── */

  _pintarCabecera(e) {
    this.refs.id.textContent = e.id;
    this.refs.fase.textContent = e.fase;
    this.refs.titulo.textContent = e.titulo;
    this.refs.carril.textContent = e.carril;

    const carril = this._carrilDe(e);
    this.el.style.setProperty('--carril-color', carril?.color ?? 'var(--acento)');

    this.refs.articulos.textContent = '';
    for (const a of e.articulos) {
      const li = document.createElement('li');
      const el = document.createElement('a');
      el.href = URL_FUENTE;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.textContent = 'art. ' + a;
      el.title = 'Ley 1952 de 2019 — compilación de la Secretaría del Senado';
      li.appendChild(el);
      this.refs.articulos.appendChild(li);
    }
  }

  _carrilDe(e) {
    // El campo `carril` del dato jurídico es prosa («OCDI → Secretaría →
    // Disciplinable»); el color se toma del primer carril que aparezca.
    return this.config.carriles.find((c) =>
      e.carril.toLowerCase().includes(c.id) ||
      e.carril.toLowerCase().includes(c.nombre.toLowerCase().split(' ')[0]));
  }

  _pintarNorma(e) {
    const s = this.refs.norma;
    s.textContent = '';
    const proc = this._avisoProcedencia(e);
    if (proc) s.appendChild(proc);
    if (this._avisoSinVerificar(e)) s.appendChild(this._avisoSinVerificar(e));
    s.appendChild(this._parrafoLey(e.norma));
    const n = this._nota(e);
    if (n) s.appendChild(n);
  }

  /** Las etapas añadidas después del encargo no salieron de la sección 5
   *  verificada. Decirlo en el propio panel —y no sólo en un archivo
   *  markdown que nadie abre en una ponencia— es la única forma de que el
   *  lector sepa qué está leyendo. */
  _avisoProcedencia(e) {
    if (e.verificacion !== 'anadida-fuente-alterna' || !e._procedencia) return null;
    const d = document.createElement('div');
    d.className = 'aviso-procedencia';

    const et = document.createElement('p');
    et.className = 'aviso-procedencia__et';
    et.innerHTML = ICONO_AVISO;
    et.appendChild(document.createTextNode('Etapa añadida — otra fuente'));

    const tx = document.createElement('p');
    tx.className = 'aviso-procedencia__tx';
    tx.textContent = 'No forma parte del contenido verificado del encargo original. '
      + e._procedencia.notaFuente;

    const ul = document.createElement('ul');
    ul.className = 'aviso-procedencia__fuentes';
    for (const id of e.fuentes ?? []) {
      const f = e._procedencia.fuentes.find((x) => x.id === id);
      if (!f) continue;
      const li = document.createElement('li');
      if (f.url) {
        const a = document.createElement('a');
        a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = f.titulo;
        li.appendChild(a);
      } else {
        li.textContent = f.titulo;
      }
      li.appendChild(document.createTextNode(' — ' + f.usadaPara));
      ul.appendChild(li);
    }

    d.append(et, tx, ul);
    return d;
  }

  _pintarConcepto(e) {
    const s = this.refs.concepto;
    s.textContent = '';
    const p = document.createElement('p');
    p.className = 'concepto-tx';
    p.textContent = e.concepto;
    s.appendChild(p);
    const n = this._nota(e);
    if (n) s.appendChild(n);
  }

  _pintarTerminos(e) {
    const s = this.refs.terminos;
    s.textContent = '';
    const cont = document.createElement('div');
    cont.className = 'tarjetas';
    cont.appendChild(this._tarjeta('Plazos', e.plazos, 'tarjeta--plazo'));
    cont.appendChild(this._tarjeta('Forma de notificación o comunicación', e.notificacion));
    cont.appendChild(this._tarjeta('Recursos procedentes', e.recursos));
    s.appendChild(cont);
    const n = this._nota(e);
    if (n) s.appendChild(n);
  }

  _parrafoLey(texto) {
    const p = document.createElement('p');
    p.className = 'ley-tx';
    p.textContent = texto;
    return p;
  }

  _tarjeta(etiqueta, texto, clase = '') {
    const d = document.createElement('div');
    d.className = 'tarjeta ' + clase;
    const et = document.createElement('p');
    et.className = 'tarjeta__et';
    et.appendChild(document.createTextNode(etiqueta));
    const tx = document.createElement('p');
    tx.className = 'tarjeta__tx';
    tx.textContent = texto;
    d.append(et, tx);
    return d;
  }

  /** La nota interpretativa se repite en las tres pestañas a propósito:
   *  en E05 el campo `plazos` dice «Ver nota interpretativa» y en E07 lo
   *  dice `notificacion`. Esconderla en otra pestaña dejaría el dato
   *  legal colgando sin su advertencia. */
  _nota(e) {
    if (!e.notaInterpretativa) return null;
    const d = document.createElement('div');
    d.className = 'nota-interp';
    const et = document.createElement('p');
    et.className = 'nota-interp__et';
    et.innerHTML = ICONO_AVISO;
    et.appendChild(document.createTextNode('Nota interpretativa — no es texto legal'));
    const tx = document.createElement('p');
    tx.className = 'nota-interp__tx';
    tx.textContent = e.notaInterpretativa;
    d.append(et, tx);
    return d;
  }

  _avisoSinVerificar(e) {
    const carril = this.config.carriles.find((c) => c.verificacion === 'sin-verificar');
    if (!carril || e.id !== 'E09') return null;
    const d = document.createElement('p');
    d.className = 'aviso-sin-verificar';
    d.innerHTML = ICONO_AVISO;
    const sp = document.createElement('span');
    sp.append(
      Object.assign(document.createElement('b'), { textContent: 'Parámetro sin verificar. ' }),
      document.createTextNode(
        'La autoridad que resuelve la apelación en esta entidad figura como ' +
        carril.nombre + '. ' + (carril.nota ?? '')),
    );
    d.appendChild(sp);
    return d;
  }
}

/* ─────────────────── capa transversal de reglas generales ─────────────────── */

export function pintarReglas(contenedor, reglas) {
  contenedor.textContent = '';
  reglas.forEach((r, i) => {
    const d = document.createElement('article');
    d.className = 'regla';
    d.style.animationDelay = (i * 55) + 'ms';

    const art = document.createElement('p');
    art.className = 'regla__art mono';
    art.textContent = 'Art. ' + r.articulos.join(', ');

    const tit = document.createElement('h3');
    tit.className = 'regla__tit';
    tit.textContent = r.titulo;

    const tx = document.createElement('p');
    tx.className = 'regla__tx';
    tx.textContent = r.texto;

    d.append(art, tit, tx);
    contenedor.appendChild(d);
  });
}

/* ─────────────────── pie con las fuentes ─────────────────── */

export function pintarPie(pie, meta, config) {
  pie.textContent = '';

  const fila = document.createElement('div');
  fila.className = 'pie__fila';

  const f = document.createElement('span');
  f.textContent = 'Fuente: Ley 1952 de 2019 (mod. Ley 2094 de 2021), compilación de la Secretaría del Senado. Consultada el 7-oct-2026.';
  fila.appendChild(f);

  for (const e of meta.enlaces) {
    const a = document.createElement('a');
    a.href = e.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = e.titulo;
    fila.appendChild(a);
  }
  pie.appendChild(fila);

  const nota = document.createElement('p');
  nota.className = 'pie__nota';
  nota.appendChild(Object.assign(document.createElement('b'),
    { textContent: 'Nota interpretativa. ' }));
  nota.appendChild(document.createTextNode(meta.notaInterpretativaGlobal));
  pie.appendChild(nota);

  const leg = document.createElement('p');
  leg.className = 'pie__nota';
  leg.style.borderLeftColor = 'rgba(255,255,255,.3)';
  leg.textContent = config.entidad.descargoOficial + ' ' + config.entidad.notaUsoNombres;
  pie.appendChild(leg);
}
