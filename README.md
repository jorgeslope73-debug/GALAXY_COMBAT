
## V16.4.19 - explosiones tras reiniciar/reconectar

- Corrige la deduplicacion de FX cuando la secuencia del servidor vuelve a 0 al repetir partida.
- El cliente resetea el historial de impactos en `restarted`.
- Si detecta una regresion real de `seq`, limpia automaticamente IDs antiguos para aceptar inmediatamente los nuevos efectos.
- No cambia fisicas, dano, red ni duracion de las explosiones.

# Galaxy Combat Web

Repositorio preparado para separar el juego web del servidor de partidas.

## Carpetas

- `docs/` — cliente web para GitHub Pages.
- `server/` — servidor Node.js + WebSocket de las partidas.
- `render.yaml` — despliegue opcional del backend en Render.
- `.github/workflows/pages.yml` — despliegue automático de `docs/` en GitHub Pages.

## Configuración necesaria

Antes de publicar, edita `docs/config.js` y pon la URL HTTPS del backend:

```js
window.GALAXY_CONFIG = {
  serverUrl: 'https://TU-SERVIDOR.example.com'
};
```

El juego convertirá automáticamente `https://` en `wss://` y usará `/ws`.


SERVIDOR GRATUITO EN REPOSO
- Si Render ha dormido el servicio, la web muestra "Despertando servidor".
- El navegador reintenta la conexión automáticamente cada pocos segundos.
- Los botones de jugar permanecen desactivados hasta que el servidor responde.
- Cuando aparece "Servidor conectado · listo para jugar", ya se puede crear o unir a una sala.
- No hace falta recargar la página manualmente.


## CONTROL MÓVIL

Al abrir el juego desde móvil se muestra **ACTIVAR CONTROL MÓVIL**.
En iPhone/iPad hay que aceptar el permiso de movimiento/orientación.

Durante la partida:
- inclinar el móvil a izquierda/derecha = giro de la nave;
- mantener pulsada la mitad izquierda = disparar;
- mantener pulsada la mitad derecha = acelerar;
- se admiten dos dedos a la vez para acelerar y disparar simultáneamente;
- el botón **RECALIBRAR GIRO** toma la posición actual como centro.

Se recomienda jugar con el teléfono en horizontal.


## Corrección de orientación
Se ha corregido el sentido visual de las naves en navegador: la rotación del sprite usa el signo equivalente a Pygame, de modo que al acelerar la nave avanza hacia su morro.

- Corregida la orientación visual de los PNG de las naves: ahora el morro coincide con la dirección real de avance.


## V15 - reconexion de partida

Si se corta el WebSocket durante una partida iniciada, el servidor conserva al jugador durante 30 segundos. El cliente usa un playerToken privado para recuperar automaticamente la misma nave, puntuacion, municion y mejoras. La sesion temporal tambien se guarda en sessionStorage para sobrevivir a una recarga breve de Safari.


## V16.4.7 - TURN opcional para voz

La voz mantiene los STUN de Google y puede usar un servidor TURN de respaldo.
El backend expone `/rtc-config` y solo incluye TURN cuando las tres variables
de entorno estan configuradas en Render:

- `TURN_URLS` (o `TURN_URL`) - una o varias URLs TURN separadas por comas.
- `TURN_USERNAME` - usuario TURN.
- `TURN_CREDENTIAL` - credencial TURN.

No se guardan credenciales TURN en el repositorio. Si faltan estas variables o
la peticion de configuracion falla, el cliente continua usando STUN de Google.

Ejemplo de `TURN_URLS`:

```text
turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
```



## V16.4.12

- Correccion visual de las mejoras flotantes: permanecen al 100% durante su vida normal.
- Solo parpadean durante los ultimos 2 segundos antes de ser sustituidas.
- El parpadeo oscila exclusivamente entre 50% y 100% de opacidad, sin aceleracion final.

## V16.4.10
- Las mejoras flotantes parpadean durante los ultimos ~2 s antes de ser sustituidas por una nueva cuando ya hay 5 en pantalla.
- El parpadeo se acelera en los ultimos 0,7 s.
- No cambia la duracion, frecuencia ni logica de recogida de las mejoras.


## V16.4.12
- Corrige el parpadeo continuo de las mejoras flotantes: `expiresIn: null` ya no se convierte accidentalmente en 0.
- Solo la mejora realmente pendiente de desaparecer parpadea durante sus ultimos 2 segundos, entre 50% y 100% de opacidad.

## V16.4.14 - limpieza de assets
- Eliminados 30 recursos gráficos obsoletos/no referenciados.
- Ahorro aproximado: 6.28 MB en `docs/assets`.
- Sin cambios de jugabilidad, servidor, controles, audio o render.

## V16.4.18 - Intervalos de lluvia de meteoritos

- Primera lluvia: retraso aleatorio entre 2 y 5 minutos desde el inicio.
- Lluvias siguientes: nuevo intervalo aleatorio independiente entre 2 y 5 minutos tras terminar cada lluvia.
- La duracion de cada lluvia se mantiene en 7 segundos.


## V16.4.20 - Lobby movil horizontal
- Jugadores en una unica fila superior, centrados y en pastillas.
- Chat compacto para que lobby completo quepa en movil horizontal sin scroll vertical.
- Campo + ENVIAR y controles de sala compactos en la zona inferior.
- EMPEZAR sigue visible solo para el anfitrion; SALIR DE SALA para todos.
- El escritorio no cambia.


## V16.4.21 - Lluvia de meteoritos cada 2-3 min
- Primera lluvia: intervalo aleatorio de 120 a 180 segundos desde el inicio.
- Siguientes lluvias: nuevo intervalo aleatorio independiente de 120 a 180 segundos.
- La duracion de cada lluvia no cambia.


## V16.4.22 - Estado FANTASMA visible

- Mientras un jugador tenga camuflaje/fantasma activo, todos los clientes muestran una pastilla superior con su nombre y los segundos reales restantes.
- El contador reutiliza directamente el campo `camo` autoritativo enviado por el servidor; no existe un temporizador paralelo en cliente.
- No cambia la duracion ni el funcionamiento del modo fantasma.


## V16.4.23
- Indicador fantasma simplificado: pastilla del color del jugador con solo el texto FANTASMA.
- La pastilla parpadea suavemente mientras la nave esta oculta.
- Los rivales camuflados se revelan brevemente cada 4 s mediante fundido encadenado; durante la revelacion la pastilla se oculta.

## V16.4.24
- La pastilla FANTASMA permanece visible durante todo el modo fantasma, incluso durante las revelaciones periodicas de la nave.
- Se coloca centrada en la parte superior con un margen minimo.
- Conserva su color de jugador y transparencia/pulso suave.


## V16.4.27
- La pastilla FANTASMA se dibuja en la capa baja del canvas, por detras de naves, meteoritos, balas y otros objetos.
- La pastilla y su texto son mas semitransparentes, manteniendo un pulso suave.
- Sigue visible durante todo el modo fantasma.


## V16.4.27
- La pastilla FANTASMA usa alpha real RGBA por elemento (relleno, borde y texto).
- Eliminada la sombra de la pastilla para evitar apariencia opaca en Safari/iOS.
- Sigue dibujandose en la capa baja, por detras de naves y objetos.


## V16.4.27
- Indicador FANTASMA con texto negro.
- Pastilla colocada junto al HUD del jugador correspondiente, hacia el interior, sin solapar el HUD.


## V16.4.33
- Mantiene el giro movil natural/corregido de V16.4.29.
- Elimina el boton ACTIVAR/RECALIBRAR MOVIMIENTO.
- En movil, el permiso del sensor se solicita desde una accion del usuario (JUGAR/CREAR/UNIRSE/EMPEZAR) y la orientacion horizontal actual se toma automaticamente como centro al comenzar la partida.
- El boton VOZ queda a la derecha con tipografia Arial/Helvetica en negrita y legible.


## V16.4.33
- Corrige el signo del giro por inclinacion tras la calibracion automatica en movil.
- Izquierda gira a izquierda y derecha gira a derecha.


## V16.4.33 - suavidad iOS
- En iPhone/iPad el canvas usa composicion sincronizada de Safari en vez de `desynchronized:true`.
- El sensor de orientacion se limita a un maximo aproximado de 60 muestras/s para reducir picos en el hilo principal.
- No cambia la fisica, red, sensibilidad ni frecuencia de render.


## V16.4.34 - PWA

- Anade `manifest.webmanifest` e iconos 192/512/Apple Touch para instalar Galaxy Combat en iPhone/Android.
- Modo de visualizacion `fullscreen`/`standalone` y orientacion landscape.
- Service worker versionado `V16.4.34`.
- HTML, JS, CSS y manifest usan **network-first** para evitar codigo antiguo en cache.
- Imagenes, audio y fuentes usan **cache-first** como assets pesados.
- Al activar una nueva version del service worker se eliminan caches `galaxy-combat-*` anteriores.
- En iOS, la pantalla `GIRA EL MOVIL` sigue siendo el respaldo si el sistema no respeta el bloqueo landscape del manifest.
## V16.4.35 - Suavidad movil / frame pacing

- Los snapshots `state` del WebSocket se conservan como texto y se procesan al inicio de `requestAnimationFrame`, evitando que `JSON.parse` y la reconstruccion del estado interrumpan un frame en mitad del pintado.
- Si llegan varios snapshots juntos por una pausa breve de Safari, solo se procesa el mas reciente; los estados del juego son reemplazables y los FX siguen presentes durante 0,8 s.
- El envio de controles deja de usar un `setInterval` independiente y se sincroniza con RAF a 30 Hz.
- El pintado se limita a 60 Hz en pantallas de 120 Hz/ProMotion; simulacion y red no cambian.
- Se reducen asignaciones temporales en el sistema de impactos y modo fantasma.
- El resplandor radial de impactos/explosiones se precalcula una vez en un canvas auxiliar en vez de crear un gradiente nuevo por explosion y por frame.
- PWA actualizada a cache `V16.4.35`; codigo sigue usando network-first.
- No cambia fisica, sensibilidad, HUD, audio, temporizadores ni protocolo del servidor.



## V16.4.36 - optimizacion movil profunda
- En movil se parsea como maximo el snapshot mas reciente a 20 Hz; controles siguen a 30 Hz y render a 60 Hz.
- Fondo del canvas reemplaza el frame anterior en una sola pasada (`copy`) en lugar de `clearRect` + repintado.
- Fast-path para sprites sin rotacion/alpha y menos strings temporales en HUD/naves.
- Las zonas tactiles HTML ya no mantienen gradientes grandes sobre el canvas en iOS.
- Controles de movimiento cuantizados suavemente y enviados solo cuando cambian, con heartbeat cada 100 ms (por debajo del timeout de 300 ms).
- Resplandor de impactos precalentado antes de la partida para evitar el pico de la primera explosion.
- Modo opcional `?debug=1`: muestra FPS, frame time, picos >25 ms y coste medio de JSON.


## V16.4.37 - IA CPU sin municion

- La CPU sin balas y sin escudo ya no persigue al jugador: prioriza municion.
- Si no hay municion flotante, huye y mantiene distancia hasta que aparezca.
- Mientras busca municion, sesga su ruta para evitar al jugador si se acerca demasiado.
- Si la CPU tiene escudo pero no balas y el rival no tiene escudo/proteccion, puede elegir una embestida.
- La probabilidad practica de embestida depende de distancia y dificultad; en dificil es mas agresiva.
- No se modifican fisicas, pickups, HUD, audio ni controles.
## V16.4.38 - fluidez movil recuperada
- Mantiene las optimizaciones anti-tirones de V16.4.35/V16.4.36.
- En movil vuelve a procesar estados a 30 Hz (cadencia real del servidor), en vez de 20 Hz.
- Los estados siguen aplicandose al inicio del `requestAnimationFrame` y solo se conserva el snapshot mas reciente, evitando picos asincronos.
- Ajuste fino de la ventana de interpolacion para reducir la sensacion de movimiento a saltos.
- No cambia servidor, fisica, controles, audio ni jugabilidad.

## V16.4.39 - optimizacion interna sin perder fluidez

- Se mantienen 60 FPS de render y 30 Hz de estados de red.
- Las explosiones/impactos reutilizan un pool fijo de bursts y particulas para reducir pausas de GC en Safari/iOS.
- El HUD reutiliza las cadenas de municion, velocidad y marcador mientras sus valores no cambian.
- Los estilos semitransparentes de FANTASMA se precalculan y se reutilizan durante la partida.
- La distancia de BRUTAL y el texto de LIDER se calculan solo cuando cambia el evento, no cada frame.
- Se elimina una asignacion de array por meteorito y frame y el callback temporal del HUD.
- No cambia fisica, red, controles, calidad grafica, IA, audio, voz ni jugabilidad.



## V16.4.40 - IA CPU verificada + invisibilidad con ojo tachado

- Se conserva y verifica la IA introducida previamente: sin balas ni escudo la CPU prioriza municion y, si no existe, huye y evita al jugador; con escudo y sin balas puede embestir solo a un rival sin escudo/proteccion.
- La mejora de invisibilidad/camuflaje deja de mostrar la letra C y ahora se representa con un ojo tachado vectorial.
- El icono se dibuja por Canvas, sin añadir assets ni peso al proyecto.
- No se modifican fisicas, dificultad, red, HUD, audio ni mecanica de invisibilidad.


## V16.4.41 - suavidad PC / prediccion visual local

- La nave local usa una pose visual continua con prediccion de aceleracion, drag y giro equivalente a la fisica del servidor.
- Los snapshots de 30 Hz ya no reanclan visualmente la nave de golpe: se reconcilian suavemente, eliminando microtirones que aumentaban con la velocidad y con el jitter de red.
- El intervalo de interpolacion usa una media suavizada en lugar del ultimo intervalo bruto de llegada.
- Canvas 2D usa composicion sincronizada tambien en PC para evitar pacing irregular asociado a `desynchronized`.
- La fisica autoritativa, colisiones, controles, red, IA y reglas de juego no cambian.
- `?debug=1` muestra tambien `ERR`, el maximo error de reconciliacion local de los ultimos 5 s.

## V16.4.42 - Espanol / English

- Selector `ESPANOL / ENGLISH` arriba a la derecha del menu principal.
- El idioma elegido se guarda en `localStorage` y se recupera al volver a abrir el juego.
- Traduce menu principal, dialogos de salas, lobby/chat, voz, avisos de partida y controles moviles.
- Nombres escritos por jugadores y mensajes de chat no se modifican.
- No cambia fisica, red, IA ni rendimiento.


## V16.4.43 - Testigo de version solo en portada
- El indicador de version se muestra unicamente dentro del menu principal.
- Al entrar en lobby, chat o partida desaparece automaticamente.
- Al volver al menu principal reaparece.
- Sin cambios de jugabilidad, red, audio, idiomas o servidor.

## V16.4.45 - Selector de idioma desplegable

- Selector compacto en la esquina superior derecha de la portada con bandera + codigo: ES, EN, IT, FR y DE.
- Idiomas disponibles: espanol, ingles, italiano, frances y aleman.
- La eleccion se guarda en `localStorage` y se restaura al volver a abrir el juego.
- Se traducen menu, lobby/chat, voz, controles moviles y avisos de partida; nombres de jugadores y mensajes escritos en chat no se modifican.
- El selector sigue apareciendo solo en la portada principal.



## V16.4.45
- Selector de idioma propio con banderas CSS (visible de forma consistente en Safari/Chrome).
- El testigo de version queda arriba a la derecha y el selector de idioma justo debajo.


## V16.4.46 - Idioma visible en partidas publicas

- Cada sala publica guarda el idioma seleccionado por su creador (ES/EN/IT/FR/DE).
- La lista de partidas muestra la bandera de ese idioma junto al anfitrion.
- La bandera no cambia aunque se unan jugadores que tengan otro idioma seleccionado.
- Clientes antiguos o salas sin idioma explicito usan ES como valor seguro.


## V16.4.47 - Manual multilingüe integrado

- Nueva pestaña **MANUAL** junto al selector de idioma en la portada.
- Manual integrado en un panel responsive, sin recargar la página.
- Traducción automática del manual a ES / EN / IT / FR / DE según el idioma seleccionado.
- Incluye objetivo, controles PC/móvil, HUD, puntuación, armas, BRUTAL, mejoras, invisibilidad, peligros, CPU, online/chat/voz, reconexión, revancha, PWA y consejos.
- Las fichas de mejoras reutilizan los assets existentes del juego; no se añaden imágenes pesadas.
- El manual está oculto fuera de la portada y no añade trabajo al render de la partida.
- Caché PWA actualizada a V16.4.47 y `manual.js` incluido en el shell.


## V16.4.49 - IA CPU desarmada mas prudente

- Sin balas ni escudo, la CPU no persigue ni ataca al jugador.
- Prioriza municion y ahora elige la opcion mas segura, penalizando pickups demasiado cercanos al rival.
- Si el jugador se acerca mientras busca municion, la CPU curva su ruta para mantener distancia.
- Si no hay municion disponible, huye hasta que aparezca.
- Con escudo pero sin balas puede embestir solo a un rival sin escudo ni proteccion activa.
- Con balas conserva su comportamiento ofensivo normal.
- Sin cambios en fisica, dificultad, HUD, manual, idiomas, audio o controles.


## V16.4.49 - manual ampliado
- El manual incluye capturas reales de la portada y de una partida.
- La seccion Online explica paso a paso como crear una sala publica/privada y como unirse desde la lista o mediante codigo.
- Las nuevas imagenes y explicaciones estan disponibles en ES, EN, IT, FR y DE.


## V16.4.51 - manual HUD e inercia
- El manual muestra una imagen real del HUD y explica balas, cadencia, velocidad y bajas.
- Se destaca que la nave solo avanza al acelerar y que conserva inercia/deslizamiento, por lo que hay que corregir la trayectoria girando.
- Los textos del manual renderizados con Flashback se muestran sin tildes para evitar problemas de glifos.

## V16.4.51 - correccion de doble giro en PC
- La nave local ya no hace el efecto visual gira -> vuelve -> gira otra vez tras una pulsacion corta de A/D o flechas.
- En PC, la rotacion local se mantiene continua mientras la tecla esta pulsada.
- Al soltar, se da un breve margen para que el snapshot autoritativo alcance la pose antes de reconciliar.
- La fisica y el servidor no cambian.


## V16.4.52 - boton SALIR movil
- Boton SALIR mas grande en partida movil.
- Fondo y borde menos transparentes para mejorar visibilidad.
- Zona tactil ampliada sin cambiar su posicion ni la jugabilidad.

## V16.4.54 - SALIR movil: pastilla transparente y texto opaco
- Pastilla SALIR con fondo semitransparente (~46%).
- Texto SALIR blanco 100% opaco.
- Control visual desplazado un poco hacia abajo para que no quede pegado al borde.
- Zona tactil desplazada en consonancia; mantiene el tamano grande de V16.4.52.


## V16.4.55 - Lobby PC/web compacto
- La ventana de la sala de espera en escritorio es mas estrecha.
- J1 y J2 se muestran en la columna izquierda, uno debajo del otro.
- J3 y J4 se muestran en la columna derecha, uno debajo del otro.
- El layout movil no cambia.


V16.4.56
- Lobby movil horizontal mas estrecho.
- J1/J2 en columna izquierda y J3/J4 en columna derecha, igual que en PC.


V16.4.57
- Boton de microfono movil mas grande y situado ligeramente mas arriba durante la partida.
- Zona tactil ampliada y desplazada para coincidir con el nuevo control visual.


V16.4.58
- Manual: comparativa visual del estado del arma con coete1.png y coete1f.png.
- Cupula apagada = arma no cargada; cupula verde = arma cargada y lista para disparar.
- Explicacion disponible en ES/EN/IT/FR/DE.


V16.4.59
- Sistema opcional de cuentas registradas: NOMBRE + CORREO + CLAVE.
- Portada: botones INICIO y REGISTRO junto a MANUAL/idioma.
- REGISTRO exige repetir la clave en el cliente antes de crear la cuenta.
- Al iniciar sesion, el nombre registrado rellena y bloquea TU NOMBRE durante la sesion.
- Los nombres registrados quedan reservados: un invitado no puede usarlos sin iniciar sesion.
- Las claves se guardan con scrypt + salt; nunca se almacenan en texto plano.
- Sesiones opacas de 30 dias almacenadas por hash SHA-256.
- Correo asociado a la cuenta para permitir implementar recuperacion de clave por email.
- Se guarda historial interno de partidas rankeadas sin mostrar rivales al jugador.
- Solo cuentan partidas online donde TODOS los participantes humanos estan registrados. CPU e invitados no cuentan.
- Cada partida rankeada tiene match_id unico para evitar contabilizarla dos veces.
- El backend ya expone /api/ranking/me: solo devuelve la posicion y estadisticas del propio usuario, nunca la clasificacion completa ni los nombres de rivales.
- Desempate preparado usando la fuerza de los rivales derrotados (victorias acumuladas de esos rivales), sin mostrar sus identidades.
- Persistencia PostgreSQL mediante DATABASE_URL. render.yaml incluye la base galaxy-combat-db y enlaza DATABASE_URL.
- El servidor crea automaticamente las tablas al arrancar.
- Esta version requiere redeploy de Render y una base PostgreSQL activa.


V16.4.61
- Nuevo boton RANKING situado en la parte superior izquierda de la portada.
- Al pulsarlo se abre una pantalla de clasificacion con puesto, jugador, victorias, derrotas y partidas.
- Nuevo endpoint publico GET /api/ranking con los primeros 100 jugadores, sin exponer correos ni credenciales.
- El orden usa el mismo criterio que /api/ranking/me: victorias, fuerza de rivales derrotados, menos derrotas e id como desempate final.
- Si hay una sesion iniciada, la fila del jugador actual queda resaltada.
