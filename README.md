# Galaxy Combat Web

**Versión actual: V20.15**

Galaxy Combat es un juego de combate espacial para navegador, gratuito y sin instalación obligatoria. Permite jugar contra CPU o en partidas online de hasta 4 jugadores.

## Estructura actual

- `docs/` — cliente web publicado con GitHub Pages.
- `server/` — backend Node.js.
- `server/p2p-server.js` — servidor activo de señalización P2P, cuentas, ranking y servicios auxiliares.
- `server/package.json` — inicia `p2p-server.js`.
- `render.yaml` — despliegue del backend en Render.
- `.github/workflows/pages.yml` — publicación automática de `docs/` en GitHub Pages.

No se conservan copias antiguas del HTML principal ni el servidor de físicas centralizado anterior.

## Arquitectura online

La física de las partidas online se ejecuta en el navegador del anfitrión. El backend coordina salas, señalización WebRTC, cuentas, ranking y reconexión.

- Salas públicas y privadas.
- Hasta 4 jugadores.
- CPU de relleno opcional. En la lista de partidas publicas se muestran los jugadores/CPU y cada plaza CPU libre permite UNIRTE directamente. Si la partida aun esta esperando, ocupas esa plaza y esperas al anfitrion; si ya esta jugando, entras directamente sustituyendo a la CPU.
- Una partida ya iniciada con CPU de relleno puede aceptar nuevos jugadores mientras haya una plaza CPU disponible.
- El nuevo jugador sustituye una CPU sin reiniciar la partida y entra con 0 bajas, 5 balas y mejoras a cero.
- Si un humano ocupa una plaza CPU entre rondas, el roster convierte esa plaza en humana antes de reiniciar; nunca se mezclan controles CPU y humanos.
- Al incorporarse un jugador a una partida ya en curso, aparece durante 3 segundos un aviso inferior transparente con su nombre grande en el color de su plaza.
- Partida online sin CPU: si un jugador no anfitrión abandona o agota los 30 segundos de reconexión, desaparece inmediatamente también de la física y del HUD (nave, panel, proyectiles y referencias asociadas), y se muestra durante 3 segundos el aviso `ABANDONA`. Si tras su salida solo queda el anfitrión, la partida se cierra automáticamente después de mostrar el aviso. Con tres o cuatro humanos, la partida continúa mientras queden al menos dos jugadores.
- Si un jugador no anfitrión pierde el WebSocket, su plaza se reserva durante 30 segundos.
- Si no vuelve y hay CPU de relleno, su plaza vuelve a CPU y la partida continúa.
- Cuando un jugador no anfitrion abandona una partida con CPU de relleno, su misma plaza pasa a CPU sin detener la partida. El aviso de salida usa el mismo estilo visual que el de entrada: nombre grande en el color de su plaza, la palabra ABANDONA destacada en rojo y más grande, y debajo el aviso discreto de la CPU que ocupa su puesto.
- Avisos de entrada/abandono: se mantienen en la misma capa visual actual. La pastilla se ajusta al ancho real del contenido en vez de mantener un ancho mínimo fijo; `ENTRA EN PARTIDA` y `ABANDONA` aumentan de tamaño para ganar legibilidad sin ocupar más espacio del necesario.
- Si se pierde definitivamente el anfitrión, la partida termina porque la física vive en su navegador.
- Las partidas que usan CPU de relleno no cuentan para el ranking.
- IA difícil: la MIRA es un recurso ofensivo prioritario (especialmente con poca o ninguna munición). Al tener misil guiado preparado puede disparar con una aproximación de hasta unos 30°, mientras que las balas normales mantienen su precisión estricta.
- Misiles personalizados por jugador: el misil disparado usa `coeteA.png`, `coeteB.png`, `coeteC.png` o `coeteD.png`; el misil preparado sobre la nave usa `navemiraA.png`, `navemiraB.png`, `navemiraC.png` o `navemiraD.png`. Si falta uno de los nuevos `navemira`, se usa temporalmente `navemira.png` como respaldo.
- Penalización por muerte: cuando una bala o misil destruye una nave sin escudo/protección, la víctima pierde 1 baja de su marcador, igual que al estrellarse. La puntuación no baja de 0 y el jugador ve el mismo aviso `PENALIZACION -1`; el atacante sigue sumando su baja con normalidad.
- ROBO DE ARMAMENTO: solo se activa por embestida directa. Un jugador con escudo activo debe chocar físicamente con un rival sin escudo y destruirlo; las bajas por bala o misil no roban armamento aunque el tirador lleve escudo. En una embestida válida suma las balas que conservaba la víctima y adopta sus mejoras si son superiores (cadencia, velocidad, camuflaje y mira). El aviso visual `ROBO DE ARMAMENTO` es local y solo aparece en la pantalla del jugador que realiza el robo.
- Manual: se documenta la MIRA / misil dirigido en español, inglés, italiano, francés y alemán, incluida su cápsula y la regla de 1 bala cuando se recoge sin munición.
- Manual · HUD: se conserva la imagen completa del HUD y las casillas de munición, cadencia y velocidad muestran ahora sus iconos de `municion1.png`, `cadencia.png` y `velocidad.png`.
- Móvil · modo BOTONES: se elimina el control de audio de la partida. Si la voz está activada, el botón PTT del micrófono se coloca entre las flechas izquierda/derecha, ligeramente más abajo, para tener acceso rápido sin invadir la zona de acelerar.
- Móvil · modo BOTONES V19.16: las flechas quedan más juntas (10 px) y centradas dentro de la mitad izquierda. Toda la mitad izquierda funciona como control de giro: el cuarto izquierdo gira a la izquierda y el cuarto siguiente gira a la derecha, permitiendo tocar zonas amplias sin acertar exactamente en la flecha. La mitad derecha queda reservada para toque corto = disparo y mantener = acelerar. El PTT de voz permanece centrado debajo de las dos flechas.

- BRUTAL: el rótulo se dibuja en una capa baja, por detrás de meteoritos, asteroides, naves, balas y mejoras, para no ocultar la acción ni la posición del jugador.

- Salas online V20.0: un usuario normal solo puede estar en 1 participación activa a la vez. La protección usa la cuenta registrada y un identificador persistente de la instalación/navegador, no la IP pública. Por eso dos ordenadores o móviles distintos conectados a la misma Wi-Fi pueden jugar entre ellos y, si cumplen las reglas normales, puntuar en ranking. La misma cuenta no puede participar dos veces simultáneamente y una misma instalación/navegador tampoco puede abrir otra cuenta o invitado a la vez. Los clientes antiguos que no envíen identificador conservan temporalmente la IP como respaldo seguro. El MODO TEST activado desde la página privada de entrenamiento mantiene su permiso especial para probar varias participaciones desde el entorno del administrador y queda excluido siempre del ranking. El enlace COMPARTIR SALA también envía el identificador correctamente.

- Voz móvil V19.15: además del PTT táctil nativo, iPhone/iPad usan una ruta WebAudio dedicada: el micrófono permanece negociado y el PTT abre/cierra una ganancia de audio en vez de activar/desactivar la pista WebRTC. El audio remoto se reproduce por WebAudio en móvil y por HTMLAudio como respaldo. La voz usa ahora la configuración ICE del backend (`/rtc-config`), incluido TURN si está configurado en Render, y reintenta automáticamente un peer de voz si falla.

- Móvil V19.17: los botones ROTACIÓN, BOTONES, AUDIO y MICRO comparten el mismo tamaño, forma de pastilla, borde y estado activo. `ACTIVAR VOZ` pasa a `ACTIVAR MICRO`. En partida, el control de micrófono se mantiene centrado bajo las dos flechas, ahora con el mismo diámetro y lenguaje visual que ellas; si el micro aún no está habilitado, el primer toque sirve para activarlo y después el mismo control funciona como PTT.

- Móvil V19.18: los botones de giro izquierda/derecha se reducen a 64 px (58 px en pantallas horizontales bajas) sin reducir sus zonas táctiles amplias. En reposo son más transparentes y, al pulsarlos, solo ganan algo de opacidad y brillo sin volverse opacos. El botón MICRO conserva el mismo tamaño/estilo y pasa a situarse abajo y a la derecha, próximo al botón de giro derecho pero con separación para no solaparse.

- Móvil V19.19: los controles de giro bajan prácticamente al borde inferior de la pantalla. En reposo son mucho más transparentes y al pulsarlos solo aumentan ligeramente su opacidad, manteniendo el aspecto ligero en lugar de volverse opacos. El botón MICRO permanece en la misma franja inferior, a la derecha de los controles de giro y respetando la zona segura del dispositivo.

- Móvil V19.20: se elimina el modo ROTACIÓN/giroscopio. El juego móvil usa exclusivamente los controles táctiles por botones, por lo que desaparecen del menú los botones ROTACIÓN y BOTONES y ya no se solicita permiso del sensor de orientación.

- Móvil V19.21: el texto del ganador reduce mucho el glow, añade una sombra oscura mínima para separar las letras del fondo y suaviza la animación de escala/espaciado para que el nombre del jugador se lea con claridad durante la celebración.

- Móvil online V19.22: corregido el rebote visual de la nave al girar. La predicción local ya no se reconcilia inmediatamente contra un snapshot atrasado del anfitrión mientras se mantiene o acaba de soltar el giro. Se deja un margen de 260 ms para que llegue el estado autoritativo y después la corrección de ángulo es más suave, evitando el efecto de girar, volver atrás y volver a colocarse.

- Móvil V19.23: el giro táctil deja de entrar al 100% de forma instantánea. Al tocar izquierda o derecha empieza aproximadamente al 22% de la velocidad máxima y acelera de forma suave durante 0,5 s hasta alcanzar exactamente la velocidad de giro anterior. Al soltar se detiene inmediatamente; el teclado físico conserva la respuesta instantánea.

- Móvil V19.24: corregido el bloqueo ocasional del giro al acelerar con dos dedos, especialmente en iPhone/iPad. Cada contacto táctil conserva ahora un rol independiente (giro o acción), de modo que mantener un dedo acelerando en la mitad derecha no puede cancelar ni bloquear el segundo dedo usado para girar en la mitad izquierda. También se enruta `touchmove` de forma unificada y se limpian todos los roles en cancelaciones/cambios de foco.

- Móvil V19.25: el giro progresivo gana un punto de aceleración sin aumentar su velocidad máxima. Arranca al 28% en lugar del 22% y alcanza el 100% en unos 420 ms en vez de 500 ms; el límite máximo sigue siendo exactamente el mismo que antes.

- Móvil V19.26: corregido un fallo introducido con el multitáctil de iPhone/iPad por el que tocar directamente las flechas ←/→ podía descartarse como si fuese un botón de interfaz. Las flechas vuelven a iniciar el giro y se mantiene el uso simultáneo de giro + acelerar/disparar.

- Móvil V19.27: el botón de MICRO/PTT se reduce y pasa a la esquina inferior derecha, con mayor transparencia en reposo y margen de seguridad respecto al HUD amarillo. Su zona táctil acompaña al icono visible y conserva la función de activar micro/hablar.

- Rendimiento V19.28: BRUTAL conserva su animación, escala, rotación y glow, pero el título se prerenderiza una sola vez en un canvas auxiliar. Durante la partida se reutiliza como imagen, evitando recalcular en cada frame el costoso shadowBlur del texto y reduciendo tirones en PC sin modificar físicas, red, controles ni velocidades.

- Móvil V19.29: el botón MICRO/PTT se desplaza hasta la esquina inferior derecha, pegado al borde seguro del dispositivo para no cubrir el HUD amarillo. Mantiene su tamaño y transparencia.\n\n- Interfaz V19.30: primera separación visual entre partidas públicas y privadas en la ventana UNIRSE.\n\n- Interfaz V19.31: PARTIDAS PUBLICAS y PARTIDA PRIVADA pasan a ser dos paneles independientes separados por espacio. La zona privada es compacta, con CODIGO y el botón UNIRSE pequeño en la misma línea; ambos títulos usan la tipografía Flashback y el mismo tamaño visual. La lista pública gana altura útil. No cambia la lógica de conexión.\n\n- Móvil V19.32: al abrir UNIRSE se ocultan VERSION, RANKING, MANUAL, COMPARTIR JUEGO, INICIO, REGISTRO/CUENTA e idioma de la interfaz principal. El navegador de partidas usa un fondo opaco para que no se vea el menú principal por detrás. Al cerrar UNIRSE reaparece todo automáticamente.\n\n- Interfaz V19.33: el campo de entrada de una partida privada muestra ESCRIBE CODIGO en lugar de CODIGO.\n\n- PC V19.34: el navegador UNIRSE puede crecer hasta aproximadamente un 30% más de altura. El bloque de PARTIDA PRIVADA conserva su tamaño compacto y el espacio adicional se destina a PARTIDAS PUBLICAS, limitado automáticamente por la altura disponible de la pantalla.\n\n- Móvil V19.35: al abrir UNIRSE, las pastillas superiores del menú principal ya no se ocultan; permanecen detrás de la ventana de PARTIDAS PUBLICAS con menor presencia visual y sin interacción hasta cerrar UNIRSE.\n\n- PC V19.36: se corrige la ampliación de UNIRSE. PARTIDA PRIVADA recupera exactamente la altura y posición anteriores. Solo PARTIDAS PUBLICAS puede crecer hacia arriba, hasta unos 180 px adicionales (aprox. 30% de su zona útil) cuando la altura de pantalla lo permite, sin empujar la sección privada fuera de pantalla.\n\n- PC V19.37: al abrir UNIRSE, las pastillas superiores del menú principal conservan el mismo comportamiento visual y de interacción que en V19.29: visibles, opacas y por delante. El comportamiento de quedar detrás de la ventana UNIRSE sigue limitado exclusivamente a móvil.\n\n- PC V19.38: se compactan únicamente las tarjetas de partidas dentro de PARTIDAS PUBLICAS para mostrar más partidas simultáneamente: menos separación vertical y filas/jugadores algo más bajos. Las pastillas de título PARTIDAS PUBLICAS y PARTIDA PRIVADA mantienen exactamente su posición y tamaño.\n\n- PC V19.39: se reduce ligeramente el espacio entre los paneles de PARTIDAS PUBLICAS y PARTIDA PRIVADA, subiendo la ventana privada unos 8 px sin cambiar su tamaño ni su contenido.\n\n- PC V19.40: PARTIDA PRIVADA se desplaza hacia arriba aproximadamente un 20% de su propia altura. Se reserva espacio en la rejilla para conservar una separación limpia respecto a PARTIDAS PUBLICAS y no se modifica la versión móvil.

## Control móvil

Se juega en horizontal y desde V19.20 el único control móvil es por botones/tacto; se elimina el modo de giro por inclinación y su selector del menú.

- Mitad izquierda: giro. El cuarto izquierdo gira a la izquierda y el cuarto siguiente gira a la derecha.
- Mitad derecha: toque rápido para disparar y mantener pulsado para acelerar.
- Si hay teclado físico conectado, conserva los controles habituales de teclado.
- El control de voz y los botones de interfaz quedan fuera de estos gestos.

## Configuración del backend

El cliente usa `docs/config.js` para conocer la URL HTTPS del backend. El juego convierte automáticamente esa URL a WebSocket seguro y usa `/ws`.

Variables de entorno que puede usar el backend:

- `DATABASE_URL` — cuentas, sesiones, ranking y datos persistentes.
- `TURN_URLS` o `TURN_URL` — servidor TURN opcional.
- `TURN_USERNAME` — usuario TURN.
- `TURN_CREDENTIAL` — credencial TURN.
- `TRAINING_ADMIN_KEY` — acceso administrativo a funciones de entrenamiento CPU.
- `PORT` — puerto del servicio.

## PWA

El juego puede instalarse como aplicación desde el navegador. El service worker mantiene una caché versionada y elimina automáticamente las cachés antiguas de Galaxy Combat al activarse una versión nueva.

## Fuente de verdad

La versión publicada es la que aparece en `docs/index.html` y en `docs/sw.js`. El manual integrado del juego se mantiene en `docs/manual.js`.


- PC V19.41: PARTIDA PRIVADA se desplaza otro 20% adicional hacia arriba dentro de UNIRSE, quedando en un 40% total respecto a su propia altura. No cambia su tamaño ni la versión móvil.


- Móvil V19.42: al abrir UNIRSE, el contexto de capas completo de la ventana de partidas se eleva por encima de todo el menú principal. RANKING, MANUAL, COMPARTIR JUEGO, INICIO, REGISTRO/CUENTA, idioma y versión quedan detrás y sin interacción hasta cerrar UNIRSE. PC no cambia.


- PC V19.43: PARTIDA PRIVADA se desplaza un poco más hacia arriba dentro de UNIRSE, pasando del 40% al 50% de su propia altura. No cambia su tamaño ni la versión móvil.


- PC V19.44: se corrige la subida de PARTIDA PRIVADA dentro de UNIRSE. Se elimina el margen superior que compensaba el desplazamiento y se aplica una subida fija de 90 px, claramente visible. No cambia móvil ni el tamaño del panel.


- PC V19.45: el hueco entre PARTIDAS PUBLICAS y PARTIDA PRIVADA dentro de UNIRSE se reduce de 6 px a 4 px. No cambian tamaños, posiciones ni móvil.


- PC V19.46: se desplaza todo el bloque UNIRSE 2 px hacia arriba. No cambian tamaños, huecos internos ni móvil.


- Móvil V19.47: al abrir UNIRSE / PARTIDAS PUBLICAS, la ventana queda por encima de todo el menú principal con fondo opaco. INICIO, RANKING, MANUAL, REGISTRO/CUENTA, idioma y versión quedan completamente ocultos mientras la ventana está abierta. PC no cambia.


- Móvil V19.48: al abrir UNIRSE / PARTIDAS PUBLICAS, todo el menú principal permanece visible detrás pero desenfocado, incluidos INICIO, RANKING, MANUAL, REGISTRO/CUENTA, idioma y versión. Esos controles quedan por debajo de la ventana y sin interacción mientras UNIRSE está abierto. PC no cambia.


- Móvil V19.49: se fuerza RANKING, MANUAL, COMPARTIR JUEGO, INICIO, REGISTRO/CUENTA, idioma y versión a una capa inferior y con desenfoque directo mientras UNIRSE está abierto. PARTIDAS PUBLICAS queda en la capa máxima. PC no cambia.


- Móvil V19.50: corrección estructural de UNIRSE. Al abrir PARTIDAS PUBLICAS en móvil, el modal se mueve fuera de launch-console (que crea un stacking context por transform) y pasa a la raíz del menú. Se usa la clase real submenu-open. RANKING, MANUAL, COMPARTIR JUEGO, INICIO, REGISTRO/CUENTA, idioma y versión quedan realmente detrás del modal y bajo el mismo desenfoque que CONTRA LA MAQUINA / ONLINE. PC no cambia.


- Jugabilidad V19.51: inicio más progresivo. La partida comienza con 1 de los 6 asteroides medianos actuales; los otros 5 entran desde fuera de pantalla, uno cada 18-24 s aproximadamente, hasta recuperar el máximo actual. La primera lluvia de meteoritos pequeños se retrasa de 120-180 s a 150-210 s y las siguientes pasan a 140-200 s. Se aplica tanto a CPU/local como a partidas online P2P.


- Móvil V19.52: el botón MICRO/PTT se desplaza 16 px hacia la izquierda respecto a su posición anterior junto al borde derecho. El icono visible y su zona táctil se mueven juntos. PC no cambia.


- Jugabilidad V19.53: los asteroides medianos tienen un máximo de 5. El inicio mantiene la entrada progresiva desde 1 hasta 5; después la población cambia aleatoriamente entre 1 y 5. Cuando toca bajar, varios asteroides salen de pantalla de forma escalonada y no se reponen inmediatamente; cuando toca subir, nuevas unidades entran desde bordes aleatorios con pausas de 4-12 s. Cada nuevo objetivo de población se decide tras periodos aleatorios de 22-48 s. Se aplica a CPU/local y online P2P.


- Jugabilidad V19.54: el primer asteroide mediano ya no aparece en un punto fijo. Entra desde fuera de pantalla por uno de los cuatro bordes elegido al azar, con punto de entrada, objetivo interior, tipo y trayectoria variables. Se aplica igual a CPU/local y online P2P.

- Online V19.55 OPT1: los snapshots P2P incluyen `round + seq` y se descartan estados atrasados o fuera de orden antes de aplicarlos. Evita micro-saltos hacia atrás propios de un DataChannel `ordered:false` sin cambiar físicas, controles, 60 Hz de simulación ni 30 snapshots/s.

- Inicio online V19.56: `PREPARADOS` aparece 2 s en tipografía Flashback con transición rojo→naranja y `VAMOS!!!` aparece 0,9 s en verde, más grande que BRUTAL. Los tres rótulos se prerenderizan con glow en canvas auxiliar. Durante PREPARADOS no arrancan física, controles ni fallback; WebRTC y recursos tienen 2 s para estabilizarse. Al aparecer VAMOS arrancan física y controles.

- V19.57 CPU: durante los 2 s de `PREPARADOS` se congelan también la física local y la IA. El jugador, las CPU y los controles empiezan exactamente al aparecer `VAMOS!!!`; el online mantiene el comportamiento de V19.56.

- V19.58 avisos: `ROBO DE ARMAMENTO` mantiene carácter privado (solo lo ve quien roba) y se anida debajo de `LLUVIA DE METEORITOS`, entrando además en la pila de avisos centrales para no solaparse con BRUTAL, A POR... o FANTASMA.

- V19.59 aprendizaje: el servidor contabiliza por separado las rondas `LOCAL DIFÍCIL` que realmente envían deltas válidos al Brain. `cpu-brain.html` muestra `Partidas LOCAL DIFÍCIL aprendidas`. El contador empieza en 0 al desplegar esta versión; no reconstruye partidas locales anteriores.

- V19.60 bengalas: nuevo pickup no acumulativo `flare` (`bengala.png`) con indicador HUD `bengalahud.png`. Con bengala equipada, toque corto de disparo conserva el disparo normal y mantener disparo 0,22 s despliega tres señuelos durante 2,2 s. Los misiles teledirigidos dirigidos al portador se desvían a una bengala al entrar en radio cercano y explotan al alcanzarla. CPU local y CPU online pueden recogerla y la usan automáticamente ante un misil entrante.

- V19.61 invisibilidad: el pickup flotante de FANTASMA/CAMUFLAJE usa `assets/sprites/ojo.png`. El dibujo vectorial anterior se conserva únicamente como respaldo si el PNG no estuviera disponible.

- V19.62 bengalas: la duración de los tres señuelos aumenta de 2,2 s a 3,0 s en CPU local y online.

- V19.63 bengalas acumulables: cada pickup suma una carga y cada uso consume una. Las cargas se conservan al morir y reaparecer. El HUD muestra un único `bengalahud.png` mientras haya una o más cargas. Al comenzar una ronda nueva, el inventario vuelve a cero.

- V19.64 bengalas/IA: las bengalas siguen desviando misiles teledirigidos; además cualquier bala normal que impacta una bengala queda anulada y consume esa bengala. En IA DIFÍCIL se añade una capa de tráfico CPU↔CPU durante los primeros 8 s: detecta trayectorias convergentes, asigna lados opuestos de evasión y evita los choques simétricos de salida sin cambiar la estrategia normal cuando ya están separados.

- V19.65 defensa CPU con bengalas: una CPU que tenga cargas despliega una en cuanto detecta que otro jugador ha lanzado un misil teledirigido dirigido a ella. Ya no espera a que el misil se acerque. Al aparecer las bengalas, ese misil cambia inmediatamente a una de ellas como objetivo, independientemente de la distancia.

- V19.66 señalización de bengalas: se elimina el icono de bengala del HUD. El pickup flotante usa `bengalahud.png`; `bengala.png` queda para las tres bengalas desplegadas; y mientras una nave conserve una o más cargas se superpone `bengalasnave.png` sobre la nave, con una única capa visual aunque haya varias cargas.

- V19.67 bengalas: las tres bengalas desplegadas se reducen progresivamente durante sus 3 s de vida (aprox. 34 px al salir hasta 5 px al final) y además se desvanecen en el último tramo. El cambio es solo visual; su física y efecto defensivo se mantienen.

- V19.68 colisión/prueba de bengalas: una nave que impacta contra una bengala desplegada la consume. Si lleva escudo, el escudo se rompe (queda a 0) y la nave rebota; sin escudo ni protección de respawn, la nave es destruida. La nave propietaria tiene 0,35 s de gracia al soltarlas para evitar autocolisión inmediata. Para facilitar pruebas, cuando no hay una bengala flotando, hay aproximadamente un 35% de probabilidad de que el siguiente pickup sea una bengala.

- V19.69 controles móviles: las flechas izquierda/derecha son áreas táctiles reales y se añade un respaldo por coordenada para toda la mitad izquierda de la pantalla. Tocar encima, directamente sobre las flechas o por debajo de ellas mantiene el mismo reparto: cuarto izquierdo gira a la izquierda y cuarto siguiente gira a la derecha. La mitad derecha sigue reservada a disparo/acelerador.

- V19.70 aprendizaje táctico de bengalas: la CPU valora misiles dirigidos, balas en trayectoria y perseguidores antes de gastar una carga. LOCAL DIFÍCIL y entrenamiento guardan decisiones USAR BENGALA / CONSERVAR; las CPU online usan la misma detección táctica con reglas seguras. CPU Brain muestra el aprendizaje de bengalas.

- V19.71 bengalas/móvil/manual: el móvil reconoce explícitamente dos toques rápidos de disparo (ventana aproximada de 0,35 s) para lanzar bengalas, sin depender de la munición ni de que el arma esté cargada. El manual elimina la antigua explicación de inclinación y aclara controles PC/móvil, disparo normal y bengalas. Las bengalas desplegadas también destruyen los meteoritos pequeños de la tormenta; ambos se consumen al impactar.

- V19.72 cooldown de bengalas: una misma nave debe esperar un mínimo real de 3,0 s entre dos lanzamientos de cargas de bengalas, aunque tenga varias acumuladas. La restricción se aplica en la física LOCAL/CPU y online, por lo que no puede saltarse desde PC, móvil ni IA. El intervalo se conserva si la nave muere y reaparece; se reinicia al comenzar una ronda nueva.

- V19.73 bajas con bengalas: si una nave enemiga muere al colisionar con una bengala desplegada, la baja se acredita al propietario de esa bengala y suma en su marcador. En online cuenta también para alcanzar la victoria y para el resultado de la ronda/ranking. Una colisión con la propia bengala nunca concede una baja al mismo jugador.

- V19.74 manual visual de controles: el apartado Controles incorpora una infografía clara con los botones móviles, flechas de giro y zona DISPARO. Se muestran los sprites reales de munición y bengala: DISPARO x1 → BALA, DISPARO + DISPARO rápido → BENGALAS y mantener DISPARO → ACELERAR. También se representa el equivalente de CTRL/ESPACIO en PC. El esquema mantiene la regla de 3 s entre lanzamientos de bengalas.

- V19.75 manual PC: la infografía de Controles añade las teclas de giro del teclado como keycaps visuales: A / D y las flechas ← / →, enlazadas claramente con la acción GIRAR.


- V19.76 PERF-1: optimización conservadora para sesiones largas. Se pausa la consulta periódica de aprendizaje durante el combate; el micro móvil deja de leer `getBoundingClientRect()` en cada frame y cachea su layout; los efectos WebAudio desconectan sus nodos al finalizar; la voz evita `play()` redundante en cada gesto y libera streams/contextos si falla la activación; `?debug=1` amplía el monitor con heap, objetos de juego y colas/buffers de red. Sin cambios de reglas, físicas ni cadencia de IA.

- V19.77: manual actualizado. Invisibilidad usa el icono real `assets/sprites/ojo.png` y la explicación de Modo Fantasma aclara que su indicador se muestra tanto en PC como en móvil.

- V19.78: manual online ampliado. Explica cómo crear una sala pública, rellenar las 3 plazas libres con CPU difíciles para empezar de inmediato, mantener la sala abierta para que los humanos sustituyan CPU en marcha y usar Compartir sala para copiar un enlace directo que entra automáticamente en la sala. Textos actualizados en todos los idiomas del manual.

- V19.79 PERF-2: físicas, colisiones, disparos y bengalas continúan a 60 Hz, mientras la decisión estratégica de las CPU se recalcula a 30 Hz y se reutiliza en el tick intermedio. Se eliminan asignaciones frecuentes reutilizando listas CPU y objetos de control. La victoria online se refuerza por WebSocket fiable y ya no depende de recibir el último snapshot 5/5, corrigiendo la ventana de ganador en móvil cuando vence un jugador del PC.

- V19.80: manual simplificado para jugadores. Controles móviles corregidos y resumidos, online explicado en pasos cortos y eliminadas referencias técnicas de conexión, protocolos y caché que no ayudan a jugar.

- V19.81: las bengalas chocan con el meteorito gigante. La bengala explota y desaparece, pero el meteorito gigante no recibe dano ni cambia de trayectoria. Los meteoritos pequenos de la lluvia mantienen el comportamiento actual: bengala y meteorito se destruyen mutuamente. Manual actualizado.

- V19.82: manual simplificado. El ESCUDO explica que una embestida que destruye una nave sin escudo roba su munición y mejoras. Asteroides y meteoritos se reduce a esquivar peligros y disparar a los meteoritos pequeños de la lluvia. El detalle del meteorito gigante queda dentro de BENGALAS.

- V19.83: el manual termina con un agradecimiento por interesarse por Galaxy Combat y un mensaje deseando que el jugador se divierta. Añadido en todos los idiomas.

- V19.84: el apartado ONLINE del manual destaca que se puede crear una partida pública y empezar a jugar inmediatamente aunque no haya entrado nadie, rellenando las plazas libres con CPU; los jugadores reales sustituyen esas CPU cuando se unen, sin reiniciar la partida.

- V19.85: en modo FACIL las CPU esperan la mitad de tiempo para volver a cargar entre disparos. Solo cambia el tiempo de recarga; las mejoras de CADENCIA siguen aumentando la velocidad de la bala exactamente igual que antes. MEDIO, DIFICIL, online y el jugador humano no cambian.

- V20.1: primer sistema LocalFX. Las naves generan un pequeno rastro flotante de particulas al acelerar, calculado y renderizado exclusivamente en cada cliente, sin anadir ningun dato P2P ni modificar fisicas, colisiones o IA. Usa un pool reutilizable limitado (96 movil / 192 PC) y menor frecuencia en movil. Las naves rivales en FANTASMA no generan rastro mientras estan ocultas, para no revelar su posicion.

- V20.2: en modo FACIL el tiempo de carga entre disparos queda al 50% para todas las naves, incluida la del jugador. Solo se reduce la espera de recarga; la velocidad de las balas y el efecto de las mejoras de CADENCIA permanecen exactamente igual.

- V20.3: LocalFX de debris para el meteorito gigante. Cuando el gigante entra en contacto con un asteroide, cada cliente genera localmente 3-6 pequenas rocas grises en el punto de choque. Se desplazan ligeramente y desaparecen suavemente en 2 segundos. Pool limitado (48 movil / 96 PC), sin nuevos datos P2P, sin fisicas ni colisiones adicionales y con control por contacto para no repetir particulas cada frame.

- V20.4: LocalFX para el cohete guiado. Al aparecer genera un pequeno fogonazo de particulas y mientras vuela deja una estela fina de particulas calidas que se apagan rapidamente. Todo se calcula en cada cliente a partir de la posicion y velocidad del cohete ya recibidas; no se anaden datos P2P ni se modifica trayectoria, colisiones, dano o explosiones. Pool limitado a 64 particulas en movil y 128 en PC.

- V20.5: portada animada LocalFX. El menu principal incorpora una escena decorativa independiente por debajo de la interfaz: 5 meteoritos en PC / 3 en movil cruzan la pantalla con tamaños distintos y generan pequeñas rocas locales al chocar. Dos naves exactas se persiguen y se lanzan cohetes ocasionalmente; los impactos generan partículas y, cuando una nave se destruye, reaparece tras una pausa con otro color. Todo vive en `menu-decor.js`, no usa P2P, no toca fisicas de partida ni ranking, se pausa al entrar a jugar o cambiar de pestaña y utiliza pools cerrados de objetos/particulas.

- V20.6: portada LocalFX simplificada. Se eliminan por completo las naves, cohetes y combate decorativo de V20.5. En la pantalla inicial quedan solo meteoritos/asteroides decorativos, con 5 en PC y 3 en movil. Los sprites conservan siempre su relacion de aspecto nativa para evitar deformaciones. Sus choques pueden generar unas pocas rocas grises locales, sin P2P ni relacion con las fisicas reales de partida.

- V20.7: correccion visual de meteoritos en portada. Los meteoritos decorativos vuelven a dibujarse con el mismo criterio cuadrado que en la partida, evitando el aspecto achatado provocado por interpretar la proporcion externa del PNG. Se elimina tambien la doble reduccion de opacidad del canvas/sprite para que conserven el aspecto y contraste originales.

- V20.8: relevo limpio CPU -> humano en partidas online con relleno CPU. Cuando entra un humano en una plaza ocupada por CPU, la entidad CPU se elimina y se crea una entidad humana nueva en esa misma plaza, sin reutilizar su objeto ni sus decisiones de IA. Se limpian controles, balas, misiles y bengalas propiedad de la CPU sustituida antes de habilitar el control humano. Las plazas marcadas como CPU rechazan controles externos hasta que el roster confirme el relevo.

- V20.9: correccion definitiva de la proporcion de los meteoritos decorativos de portada. El fallo estaba en el backing canvas: el ancho podia quedar limitado a 1500 px mientras la altura conservaba otro escalado, y CSS estiraba ese buffer a 16:9, achatando todo el contenido. Ahora ancho y alto se reducen con el mismo factor y conservan exactamente la proporcion del rectangulo visible; el transform del mundo sigue siendo uniforme.

- V20.10: margen visual antes del disparo CPU. Al terminar la recarga de una CPU, la nave pasa inmediatamente al PNG armado/cupula verde, pero esa CPU debe permanecer 1 segundo en ese estado antes de poder disparar. El jugador humano no recibe este retraso adicional. Se aplica a CPU local, CPU de relleno online y entrenamiento. No cambia la velocidad de las balas ni los tiempos de recarga existentes.

- V20.11: ajuste de puntuacion y colisiones decorativas. Ser abatido por la bala, misil o bengala de otro jugador ya no resta una baja/punto a la victima; el atacante sigue sumando su baja. La penalizacion -1 se conserva para muertes por entorno/choque, autodestruccion y colisiones fisicas entre naves. En la portada, el radio de colision de los meteoritos decorativos pasa de 0.41 a 0.485 del tamaño dibujado y el rebote intercambia correctamente la componente normal de velocidad, separando ademas 1.5 px extra para evitar solapamiento visual.

- V20.12: los misiles guiados pueden ser interceptados por proyectiles rivales. Una bala contra un misil destruye ambos y genera una explosion visual/sonido de impacto; misil contra misil destruye ambos. Bala contra bala sigue sin colisionar y los proyectiles del mismo jugador no se destruyen entre si. La comprobacion usa colision continua para reducir fallos cuando los proyectiles se cruzan a alta velocidad.

- V20.13: pantalla de carga de graficos de portada en el primer acceso del dispositivo/navegador. Precarga y decodifica INTRO y los seis sprites de meteoritos decorativos antes de descubrir el menu, con barra de progreso y fundido. Guarda una marca local para no volver a bloquear el menu en siguientes visitas. Incluye timeout de seguridad de 8 s para que un recurso fallido nunca impida entrar.

- V20.14: primera optimizacion anti-microtirones sin cambios de jugabilidad. La deteccion de Hz del monitor usa histeresis y exige seis ventanas consecutivas antes de cambiar el divisor de render, evitando saltos 120/60 por pequeñas oscilaciones de VRR. Los LocalFX del choque gigante/asteroide y de la estela del misil reutilizan Sets scratch en vez de crear Sets/arrays temporales por frame. La intercepcion bala/misil reutiliza tambien un Set por motor y compacta el array de proyectiles in-place, reduciendo presion sobre el recolector de basura. Fisicas, IA, red, velocidades, reglas y aspecto visual permanecen iguales.

- V20.15: la espera de recarga de cada bala pasa a ser la mitad de la anterior en todo el juego: humano y CPU, modos facil/medio/dificil y partidas online. Se conserva la progresion actual de cadencia y velocidad de bala. El segundo de aviso de las CPU cuando la cupula se pone verde sigue intacto y comienza una vez la bala ya esta cargada.
