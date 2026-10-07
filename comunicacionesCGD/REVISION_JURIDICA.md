# Revisión jurídica — observaciones

**No se modificó ni un carácter del contenido de la sección 5 del encargo.** Todo
lo que sigue son observaciones para que el autor decida; ninguna se aplicó.

El contenido vive en [`data/etapas-cgd.json`](data/etapas-cgd.json) y está sellado
con un SHA-256 en [`pruebas/sello-contenido.json`](pruebas/sello-contenido.json).
Cualquier edición posterior hace fallar `node pruebas/verificar-contenido.mjs`.

---

## 1. Lo que el sello SÍ garantiza y lo que NO

Conviene decirlo con claridad porque el criterio de aceptación n.º 4 pedía una
prueba que comparara el JSON «carácter por carácter» con un *snapshot* de la
sección 5.

| | |
|---|---|
| **Garantizado** | Que el JSON no cambie desde que se selló. El hash se verifica en cada corrida. |
| **Garantizado** | Que ninguno de los doce errores del manual original reaparezca, ni en los datos ni en el código (se buscan por patrón, incluido el código fuente). |
| **NO garantizado** | Que la transcripción inicial sea fiel a la Ley 1952. |

El motivo de lo último: un *snapshot* escrito por mí a partir del mismo encargo
sería una segunda transcripción de la misma mano. Si me equivoqué al copiar,
me equivocaría igual al copiar el snapshot, y la prueba pasaría en verde dando
una falsa sensación de verificación. Preferí un sello honesto que diga «esto no
ha cambiado» antes que una prueba circular que diga «esto está bien».

**Queda pendiente para el autor:** cotejar una vez `data/etapas-cgd.json` contra
la fuente. Son doce etapas y cinco reglas; es un rato de lectura y después el
sello lo protege para siempre.

---

## 2. Un campo que el encargo pedía mostrar y la sección 5 no trae

El punto 4.4 pide que la pestaña **«Términos y notificación»** tenga cuatro
tarjetas: *plazo*, *forma de notificación/comunicación*, *recurso procedente* y
**«efecto de no comparecer»**.

La sección 5 define el esquema con `plazos`, `notificacion` y `recursos`, pero
**no tiene un campo para el efecto de no comparecer**. En varias etapas ese
efecto está dentro de la prosa de otro campo —en E02 dentro de `plazos` («…se
fija edicto en la secretaría por tres (3) días»), en E06 dentro de `norma` (la
designación de defensor público)— y en otras simplemente no existe.

**Decisión:** se muestran **tres** tarjetas. No inventé la cuarta y tampoco
extraje el efecto con una expresión regular sobre el texto legal, porque
recortar una frase de su contexto es una forma de alterarla.

**Si lo quieres como cuarta tarjeta**, hay que añadir un campo
`efectoNoComparecer` a las etapas que lo tengan, redactado por ti. Avísame y lo
cableo; el código ya está preparado para una tarjeta más.

---

## 3. Dos tensiones internas del propio contenido verificado

Ninguna es un error: son puntos donde el texto remite a sí mismo y conviene
que el autor sepa cómo se resolvieron en pantalla.

### 3.1 E05 y E07 remiten a su nota interpretativa desde otro campo

- En **E05**, el campo `plazos` dice literalmente «Ver nota interpretativa».
- En **E07**, el campo `notificacion` dice literalmente «Ver nota interpretativa».

Si la nota sólo apareciera en la pestaña *Norma*, el lector que abra *Términos y
notificación* vería «Ver nota interpretativa» sin nota a la vista. Por eso **la
nota interpretativa se repite en las tres pestañas** de la etapa que la tenga.
Es deliberado: la advertencia tiene que estar donde está el dato que califica.

### 3.2 Son cuatro notas por etapa, más una global: cinco

El criterio n.º 5 habla de «las 5 notas interpretativas». En la sección 5 hay
**cuatro** marcadas como `notaInterpretativa` (E02, E05, E07, E08A) y **una
global**, la del cómputo en días hábiles del art. 62 de la Ley 4 de 1913, que el
encargo manda mostrar en el pie. Las cinco llevan el mismo distintivo visual
—recuadro gris, filete rojo y el rótulo «Nota interpretativa — no es texto
legal»— para que ninguna se confunda con la norma. La prueba automatizada
cuenta 4 + 1.

---

## 4. Lo que quedó marcado como sin verificar en la propia interfaz

Siguiendo el punto 2 del encargo:

- El **carril 6** se rotula `[Autoridad de segunda instancia según acto interno
  de la Aerocivil — por confirmar]`, su plataforma lleva el zócalo a trazos
  rojos, y el panel de **E09** abre con un aviso en recuadro punteado que
  recuerda el art. 93 (si la entidad no puede garantizarla, corresponde a la
  PGN).
- El **carril 5** queda marcado en los datos como `verificado-con-salvedad` por
  la Resolución 00456 de 2024, consultada en reproducción de vLex y **pendiente
  de cotejo con el Diario Oficial**. La salvedad está en
  [`data/config-entidad.json`](data/config-entidad.json); si quieres que también
  se vea en pantalla, dilo y le pongo distintivo propio.

Todos los nombres de dependencias viven en `config-entidad.json`. **No hay un
solo nombre de dependencia escrito en el código**, así que puedes corregirlos sin
tocar JavaScript.

---

## 5. Enlaces a la fuente: por qué no son profundos

Cada artículo del panel enlaza a la página principal de la compilación del
Senado, no a la subpágina que lo contiene.

La sección 5 cita cuatro páginas (`ley_1952_2019.html` y las `_pr002`, `_pr003`,
`_pr005`) pero **no dice qué artículo está en cuál**. Repartirlos habría sido
adivinar, y un enlace que lleva al artículo equivocado es peor que uno genérico.
Las cuatro páginas están listadas en el pie del sitio.

Si me pasas el reparto, son cinco minutos de cableado.

---

## 6. Cálculo de términos: lo que hace y lo que no

La calculadora es **ilustrativa** y lo dice junto al resultado, no en letra chica.

- Cuenta **días hábiles**, excluyendo sábados, domingos y festivos de Colombia.
- Los festivos **se calculan, no se tabulan**: regla de la Ley 51 de 1983 (que
  traslada siete festivos al lunes siguiente y respeta los seis fijos) más los
  de origen pascual, con la Pascua por el algoritmo gregoriano anónimo. Sirve
  para cualquier año, no sólo 2026–2027. El detalle y las fuentes están
  comentados en [`ui/terminos.js`](ui/terminos.js).
- Los términos en **meses** se cuentan por calendario, conforme a la nota
  interpretativa global.
- **No** aplica suspensiones, prórrogas, interrupciones ni vacancias judiciales,
  y **no** sabe si el término corre desde la notificación o desde el día
  siguiente en cada caso concreto. Toma la fecha que le des y suma.

Dicho de otro modo: sirve para hacerse una idea en una ponencia, no para contar
un término en un expediente real.

---

## 7. Dos decisiones que me salí a tomar y conviene que sepas

**7.1 La ilustración de referencia no entró al repositorio.** El encargo pedía
guardarla en `referencia/modelo-isometrico.jpg`. `disciplinaria-app` es un
repositorio **público** y la imagen es una ilustración isométrica de banco con
licencia que no pude establecer. Subirla habría sido publicar material ajeno sin
título. La usé únicamente como referencia de estilo mirándola, y la dejé fuera
del árbol de git. Si tienes la licencia, la añado.

**7.2 Toda la geometría es original y construida por código.** No hay texturas,
ni modelos `.glb`, ni calco de la imagen: los veintidós escenarios se arman con
cajas, cilindros, cápsulas y conos en `scene/estaciones.js`, y los personajes en
`scene/personajes.js`. Por eso no hay `CREDITOS.md` de terceros más allá de las
librerías; están en [`CREDITOS.md`](CREDITOS.md).

---

## 8. Resumen de lo que necesito de ti

1. Cotejar una vez `data/etapas-cgd.json` contra la fuente (§1).
2. Decidir si quieres la cuarta tarjeta «efecto de no comparecer» y, en su caso,
   redactarla (§2).
3. Confirmar la autoridad de segunda instancia del carril 6 (§4).
4. Si lo tienes, el reparto artículo → página del Senado (§5).
