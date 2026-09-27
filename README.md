# Galaxy Combat Web

**Versión actual: V19.22**

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

- Salas online: un usuario normal solo puede estar en 1 sala activa a la vez: o crea una sala o se une a una. La restricción se aplica también por IP pública tanto a registrados como a invitados, por lo que desde la misma conexión no se puede crear con una cuenta y entrar después desde otro navegador, otra cuenta o como invitado. Si el servidor no puede obtener una IP válida, conserva la protección por cuenta o por identificador local del navegador para no bloquear el juego. El MODO TEST activado desde la página privada de entrenamiento autoriza durante 8 horas a los navegadores que salgan por la misma IP pública. El límite elegido (2–10) se aplica al total de participaciones de prueba simultáneas, tanto creando salas como uniéndose a ellas. El token del navegador administrador sigue funcionando como respaldo si cambia de red.\n\n- Voz móvil V19.15: además del PTT táctil nativo, iPhone/iPad usan una ruta WebAudio dedicada: el micrófono permanece negociado y el PTT abre/cierra una ganancia de audio en vez de activar/desactivar la pista WebRTC. El audio remoto se reproduce por WebAudio en móvil y por HTMLAudio como respaldo. La voz usa ahora la configuración ICE del backend (`/rtc-config`), incluido TURN si está configurado en Render, y reintenta automáticamente un peer de voz si falla.

- Móvil V19.17: los botones ROTACIÓN, BOTONES, AUDIO y MICRO comparten el mismo tamaño, forma de pastilla, borde y estado activo. `ACTIVAR VOZ` pasa a `ACTIVAR MICRO`. En partida, el control de micrófono se mantiene centrado bajo las dos flechas, ahora con el mismo diámetro y lenguaje visual que ellas; si el micro aún no está habilitado, el primer toque sirve para activarlo y después el mismo control funciona como PTT.

- Móvil V19.18: los botones de giro izquierda/derecha se reducen a 64 px (58 px en pantallas horizontales bajas) sin reducir sus zonas táctiles amplias. En reposo son más transparentes y, al pulsarlos, solo ganan algo de opacidad y brillo sin volverse opacos. El botón MICRO conserva el mismo tamaño/estilo y pasa a situarse abajo y a la derecha, próximo al botón de giro derecho pero con separación para no solaparse.

- Móvil V19.19: los controles de giro bajan prácticamente al borde inferior de la pantalla. En reposo son mucho más transparentes y al pulsarlos solo aumentan ligeramente su opacidad, manteniendo el aspecto ligero en lugar de volverse opacos. El botón MICRO permanece en la misma franja inferior, a la derecha de los controles de giro y respetando la zona segura del dispositivo.

- Móvil V19.20: se elimina el modo ROTACIÓN/giroscopio. El juego móvil usa exclusivamente los controles táctiles por botones, por lo que desaparecen del menú los botones ROTACIÓN y BOTONES y ya no se solicita permiso del sensor de orientación.

- Móvil V19.21: el texto del ganador reduce mucho el glow, añade una sombra oscura mínima para separar las letras del fondo y suaviza la animación de escala/espaciado para que el nombre del jugador se lea con claridad durante la celebración.

- Móvil online V19.22: corregido el rebote visual de la nave al girar. La predicción local ya no se reconcilia inmediatamente contra un snapshot atrasado del anfitrión mientras se mantiene o acaba de soltar el giro. Se deja un margen de 260 ms para que llegue el estado autoritativo y después la corrección de ángulo es más suave, evitando el efecto de girar, volver atrás y volver a colocarse.

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
