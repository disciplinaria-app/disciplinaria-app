# Comunicaciones CGD

Simulación pedagógica, en isométrico navegable, del flujo de comunicaciones,
notificaciones, términos y recursos del proceso disciplinario de la **Ley 1952
de 2019** (con las modificaciones de la Ley 2094 de 2021), de la queja a la
ejecutoria.

> **No es un sitio oficial** de la Unidad Administrativa Especial de Aeronáutica
> Civil. La leyenda está impresa de forma permanente en la barra superior.

Ruta: `/comunicacionesCGD` · sin framework, sin compilación, sin `node_modules`.

---

## Antes de tocar nada

**`data/etapas-cgd.json` es contenido jurídico verificado y está sellado.**
No se edita sin aprobación del autor. Las observaciones van a
[`REVISION_JURIDICA.md`](REVISION_JURIDICA.md), nunca al archivo de datos.

```bash
node pruebas/verificar-contenido.mjs
```

Comprueba el sello SHA-256, la estructura de las doce etapas, las cinco notas
interpretativas y que ninguno de los doce errores del manual original haya
vuelto a aparecer —ni en los datos ni en el código—. Si cambias el contenido a
propósito y con aprobación, resella con `--sellar`.

## Estructura

```
data/etapas-cgd.json      contenido jurídico verbatim · SELLADO
data/config-entidad.json  nombres de dependencias — edítalo aquí, no en el código
data/grafo-flujo.json     geometría y topología del diagrama (sin texto legal)

scene/escena.js           renderer, cámara ortográfica isométrica, rótulos, raycast
scene/materiales.js       paleta, materiales y caché de geometrías
scene/estaciones.js       losas de oficina y los 22 escenarios
scene/personajes.js       figuras genéricas y sus animaciones
scene/rutas.js            rutas, compuertas, objetos viajeros y el expediente

ui/estilos.css            sistema de diseño
ui/panel.js               panel lateral (Norma / Concepto / Términos)
ui/navegacion.js          índice, teclado, recorrido guiado
ui/terminos.js            días hábiles y festivos de Colombia
ui/fallback-2d.js         el mismo flujo en SVG si no hay WebGL

pruebas/                  prueba de integridad y sello
```

## Cómo se separa el contenido del código

Los tres JSON cumplen papeles distintos a propósito:

- **`etapas-cgd.json`** sólo tiene texto legal. Nada derivado, nada de posiciones,
  nada de colores. Así el sello protege exactamente el contenido y no otra cosa.
- **`grafo-flujo.json`** sólo tiene geometría y topología. Ni una palabra de la ley.
- **`config-entidad.json`** sólo tiene nombres de dependencias y las fuentes
  institucionales. **No hay un solo nombre de dependencia escrito en el código.**

## Atajos

| | |
|---|---|
| `?e=E06` o `#E06` | abre directo una etapa |
| `?2d=1` | fuerza el diagrama plano (para revisar la versión sin WebGL) |
| `←` `→` | etapa anterior / siguiente |
| `Inicio` `Fin` | primera / última |
| `Esc` | ver flujo completo |
| `Espacio` | iniciar o pausar el recorrido guiado |

## Desarrollo

Es estático: cualquier servidor de archivos sirve.

```bash
python -m http.server 4178
```

y abre `http://127.0.0.1:4178/comunicacionesCGD/`. Hace falta un servidor —no
vale `file://`— porque la página usa módulos ES y `fetch` para los datos.

Three.js y GSAP llegan por *import map* desde jsDelivr. Para fijar otra versión,
se cambia en el `<script type="importmap">` de `index.html`.

## Rutas en Vercel

`vercel.json` añade redirecciones 308 desde `/comunicacionescgd` y
`/comunicaciones-cgd` hacia `/comunicacionesCGD`, porque las rutas distinguen
mayúsculas. No se tocó la reescritura de `/api/*` hacia Railway.
