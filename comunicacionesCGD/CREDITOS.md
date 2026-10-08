# Créditos y procedencia

## Geometría, personajes y escenografía

**Todo original, construido por código.** No se usó ningún modelo 3D externo,
ninguna textura descargada y ningún calco de imagen alguna.

Los veintidós escenarios (ventanilla de radicación, cartelera de edictos,
pantalla de estado electrónico, sala de audiencias, estrado de segunda
instancia, archivador, servidor de la PGN…) se arman con primitivas de
Three.js —`BoxGeometry`, `CylinderGeometry`, `CapsuleGeometry`, `SphereGeometry`,
`ConeGeometry`, `TorusGeometry`— en [`scene/estaciones.js`](scene/estaciones.js).

Los personajes se construyen en [`scene/personajes.js`](scene/personajes.js) y
son **genéricos y sin rasgos faciales**: representan roles («Instructor/a OCDI»,
«Secretaría», «Disciplinable», «Defensa», «Ministerio Público»…), nunca
personas. No se usan nombres reales de servidores ni datos personales.

La única imagen generada en tiempo de ejecución es la mancha de sombra bajo
cada plataforma, dibujada con un degradado radial en un `<canvas>`.

## Librerías

| Librería | Versión | Licencia | Uso |
|---|---|---|---|
| [Three.js](https://threejs.org) | 0.186.1 | MIT | Render WebGL, cámara ortográfica isométrica |
| [GSAP](https://gsap.com) | 3.13.0 | [Licencia estándar «No Charge»](https://gsap.com/community/standard-license/) | Vuelos de cámara |

Ambas se cargan desde `cdn.jsdelivr.net` mediante un *import map*; no hay
`node_modules` ni paso de compilación.

> **Nota sobre GSAP:** aquí sólo se usa el núcleo, cubierto por la licencia
> estándar sin coste para un sitio accesible al público. No se usan plugins de
> club (SplitText, MorphSVG, etc.).

## Tipografías

Las tres se sirven desde Google Fonts y son de licencia libre:

| Fuente | Autoría | Licencia | Papel en el diseño |
|---|---|---|---|
| [Archivo](https://fonts.google.com/specimen/Archivo) | Omnibus-Type | SIL OFL 1.1 | La interfaz — lo que dice el sitio |
| [Spectral](https://fonts.google.com/specimen/Spectral) | Production Type | SIL OFL 1.1 | La ley — lo que dice la norma |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | IBM / Bold Monday | SIL OFL 1.1 | Lo contado y lo codificado — artículos, días, radicados |

La convención es deliberada y constante: **si está en serif, es texto legal; si
está en mono, es un número que la ley fijó.** Ese reparto es lo que permite que
un lector distinga de un vistazo la norma de la glosa.

## Contenido jurídico

Ley 1952 de 2019, texto vigente con las modificaciones de la Ley 2094 de 2021,
compilación de la **Secretaría del Senado** (`secretariasenado.gov.co`),
consultada el **7 de octubre de 2026**. Los cuatro enlaces concretos están en el
pie del sitio y en `data/etapas-cgd.json`.

## Lo que este sitio no es

No usa el logo, el escudo, los colores institucionales ni la tipografía oficial
de la Unidad Administrativa Especial de Aeronáutica Civil, ni de ninguna otra
entidad. Es una **simulación pedagógica** y lo declara de forma permanente en la
barra superior.
