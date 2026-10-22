# Galaxy Combat online — V22.50

GitHub Pages publica `docs/`. El navegador anfitrion simula a 60 Hz y publica estados a 20 Hz. Render ejecuta `server/p2p-server.js`: salas, senalizacion WebRTC, respaldo WebSocket, cuentas y ranking. Los invitados envian controles y acciones; la fisica permanece en el anfitrion.

## Contrato de mensajes

`server/net-protocol.js` es la fuente canonica del contrato. `docs/net-protocol.js` debe ser una copia identica para Pages; `tools/check-online-protocol.js` comprueba ambas. El backend puede ejecutarse con `rootDir: server` sin acceder a archivos fuera de esa carpeta.

Todos los paquetes de juego llevan estos campos, tanto por WebRTC como por WebSocket:

| Campo | Alcance |
| --- | --- |
| `protocolVersion` | Version del contrato: 2. Se comprueba antes de habilitar el online. |
| `seriesId` | Identificador aleatorio de 32 caracteres hexadecimales. Cambia al iniciar otra serie, aunque se conserve la sala y el anfitrion. |
| `hostEpoch` | Autoridad de simulacion. Cambia al migrar el anfitrion o reconstruir su fisica tras una recarga. |
| `rankRound` | Ronda del paquete. Los estados conservan tambien `round`, con el mismo valor. |

Los controles, acciones y confirmaciones deben pertenecer al contexto actual. Un estado o un evento `restarted` puede anunciar exactamente la ronda siguiente; los paquetes posteriores llegan bajo ese nuevo contexto. La senalizacion conserva serie/autoridad, pero permite que cambie la ronda mientras se negocia la misma conexion. Al cambiar serie o autoridad se cierran los peers antiguos.

## Entradas y entrega

- Cada carga de pagina genera un `inputSessionId`, que el servidor incluye en el roster humano. Los controles y acciones de la pagina anterior se rechazan. Una reconexion del transporte conserva la deduplicacion; una nueva sesion de entrada reinicia los contadores de esa plaza.
- `controlSeq` es creciente y compartido entre WebRTC y el respaldo. Los controles antiguos no pueden deshacer una entrada mas reciente.
- Misiles, bengalas y onda usan `kind` + `actionId` dentro del contexto y la sesion de entrada. El cliente conserva la accion hasta recibir `input-ack`; la reenvia con el mismo identificador cada 250 ms. El anfitrion registra cada accion una sola vez y confirma tambien los duplicados.
- La cola tiene un maximo de 32 acciones y caduca a los 2 segundos. Cada accion conserva el `simTime` del estado observado: el anfitrion tambien descarta entregas atrasadas usando su reloj de simulacion, sin depender de la hora de los dispositivos. El ACK de una accion caducada permite retirarla sin ejecutarla.
- Los eventos del anfitrion llevan `eventId` creciente. Una ventana acotada evita ejecutar dos veces el mismo evento recibido por WebRTC y por WebSocket. Los mensajes de sala y fase solo proceden del servidor.
- Resultados y transiciones conservan `requestId`, se reintentan cada 750 ms y son idempotentes. Un rechazo solicita `round-sync`; si la fisica del anfitrion diverge, el servidor coordina una nueva autoridad para reconstruirla.

## Fases y recuperacion

El servidor publica `seriesPhase`: `lobby`, `playing`, `round-finished` o `series-finished`, junto con la ronda, las victorias confirmadas y el ganador de la ultima ronda. No se confunde una ronda iniciada con una ronda contabilizada.

Una reconexion con fisica viva conserva la partida. Si el anfitrion recarga, la ronda aun en juego se reinicia coordinadamente bajo una nueva autoridad; las victorias confirmadas se conservan. Una ronda terminada se recupera en su pantalla de resultado y no vuelve a puntuarse. Los invitados preparan los recursos antes de recuperar la vista de una partida en curso.

## Conexiones bloqueadas y colas

El servidor envia un ping WebSocket nativo cada 15 segundos y retira la conexion si no recibe pong antes del siguiente ciclo. El navegador responde automaticamente. El cliente tambien comprueba la recepcion: con un servidor que anuncia `websocketHeartbeat`, envia ping de aplicacion cada 5 segundos y recupera el transporte tras mas de 25 segundos sin mensajes. La comprobacion se ejecuta cada 5 segundos y puede retrasarse si el navegador suspende la pestaña. Una negociacion WebSocket sin completar tiene 60 segundos de margen. Los servidores anteriores que no anuncian heartbeat siguen siendo compatibles.

Las colas WebSocket admiten hasta 512 KiB; el canal P2P fiable, hasta 256 KiB. Antes de enviar se incluye el tamaño del siguiente mensaje (estimacion conservadora UTF-8 en navegador). Superar el limite retira solo el transporte afectado y utiliza la recuperacion existente. Los snapshots conservan sus limites inferiores. No se añaden colas ilimitadas ni se cambia la autoridad del anfitrion: las acciones y resultados pendientes conservan sus IDs y reintentos. Los eventos transitorios no tienen una nueva garantia de repeticion tras cerrar un canal; las fases se recuperan mediante el protocolo de sesiones existente.

## Validacion y despliegue

V22.59 incorpora prediccion por ticks para la nave propia invitada en P2P. Host, CPU y predictor comparten `stepShipMovement` a 60 Hz. El predictor avanza fuera del dibujo, conserva hasta 120 entradas y envia hasta 60 pendientes por paquete; el host valida el lote y consume como maximo una por tick. Los duplicados no reemplazan entradas aceptadas y las entradas que llegan despues de su plazo no se ejecutan de nuevo. Se conserva la ultima entrada durante seis ticks sin datos, despues se neutraliza. Un atraso superior a 30 ticks solicita reinicio del flujo, sin acelerar la simulacion para vaciarlo.

Los estados incluyen pose de precision completa y ACK de movimiento. El invitado restaura la pose confirmada y repite solamente las entradas posteriores. Las correcciones de presentacion se mantienen separadas de la fisica. Muerte/materializacion, aparicion, ronda, cambio de anfitrion, foco y respaldo tienen reinicio o ruta de compatibilidad. Colisiones, armas, municion y puntuacion siguen siendo autoridad del host. Los disparos normales usan las entradas por tick, pero no hay proyectiles ni impactos predichos localmente.

La nueva ruta se negocia mediante el campo `motion` del estado. Ambos clientes deben cargar V22.59. En respaldo WebSocket o con un host antiguo se utiliza la ruta anterior; el servidor de señalizacion no necesita un cambio. Las naves ajenas conservan su representacion anterior. Para comparar, abrir `?prediction=legacy` en el invitado; para diagnosticar la nueva ruta, `?netdebug=1`, que muestra pendientes, ACK y ultima correccion. El RTT mostrado sigue siendo el del servidor, no del enlace P2P.

`node tools/check-motion-prediction.js` comprueba equivalencia exacta con el integrador anterior, movimiento con retrasos simetricos/asimetricos a 30/60/120 FPS, perdida y variacion de llegada, limites de cola, duplicados, datos invalidos, cambios de ronda, aparicion, respaldo, recuperacion temporal y pulsos cortos. Tambien se ejecuta desde la suite de red en CI. Las pruebas sin perdida ni falta de entradas dan error menor de 1e-7 contra la misma secuencia de ticks; esto no implica ausencia de correcciones con colisiones o red inestable. La prueba de navegador uso dos clientes en el mismo equipo: no sustituye una partida entre equipos reales.

V22.55 consume el estado P2P pendiente al comienzo del RAF del juego, antes de dibujar, y cancela el callback redundante del transporte. Conserva un unico estado pendiente y los filtros de orden. Los controles activos se repiten a 30 Hz (mas trafico pequeño que los 10 Hz anteriores); cambios de signo de giro, aceleracion y disparo se envian sin esperar el intervalo normal. En reposo se conservan 10 Hz. Los canales de controles rechazan envios con mas de 4 KiB en cola y los snapshots P2P se omiten para un peer con 16 KiB o mas pendientes. No se modifica el canal fiable de eventos. El respaldo admite 1 ms de tolerancia en su cadencia para no saltarse estados por redondeo. Las fisicas y la publicacion del host permanecen a 60 Hz y 20 estados/s respectivamente.

El panel `?netdebug=1` incluye FPS pintados, estados aceptados por segundo y mayor intervalo entre estados de la muestra. Estas medidas separan retrasos de entrega de caidas de renderizado; no son una medida de perdida de paquetes. Referencias de implementacion: [colas RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmount) y [callbacks requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

V22.54 corrige la reconciliacion del giro de la propia nave invitada. El host incluye `appliedControlSeq` en cada jugador despues de aplicar un control en un tick; el invitado espera esa confirmacion antes de corregir el angulo al soltar el giro. Los heartbeats no desplazan la confirmacion pendiente y los envios fallidos no se consideran aplicados. Teclado, mando y sensor predicen con el mismo giro cuantizado que se envia. Hosts anteriores sin el campo mantienen el comportamiento compatible anterior. Todos deben recargar para disponer de la correccion completa. La velocidad y las fisicas no cambian; esto elimina las correcciones contra giros antiguos, no el retraso de red ni toda correccion autoritativa bajo perdida o jitter.

V22.53 revierte el suavizado de V22.52 tras un reporte de peor respuesta y fluidez en invitados. Recupera el dibujo de V22.51, conservando las mejoras de reconexion y diagnostico. La regresion observada en juego real requiere pruebas entre dispositivos antes de reintroducir cambios visuales.

V22.51: los reintentos de señalizacion aumentan exponencialmente, con variacion aleatoria del 20 %, hasta una base de 4 s durante la partida y 15 s en el menu. Tras una conexion compatible estable durante 10 s, el siguiente corte vuelve al intervalo inicial. Volver a primer plano o recuperar la red permite reintentar inmediatamente si no hay una conexion en curso. El flujo P2P y la ventana de recuperacion de sala se conservan.

Al perder foco o quedar oculta la pestaña se envian controles neutros y se suspende la lectura de teclado, mando y sensores. Al volver se limpian entradas antiguas y se comprueba el WebSocket, dando margen para responder despues de una suspension del navegador. Esto no permite que el anfitrion simule mientras el sistema operativo congela su pestaña.

Para activar el panel opcional, añadir `?netdebug=1` a la URL (o `&netdebug=1` si ya tiene parametros). Muestra P2P/respaldo, peers, bytes en cola, acciones pendientes y reintentos. El RTT corresponde al servidor WebSocket, no a la latencia entre jugadores. No mide perdida de paquetes ni registra datos personales; con servidores anteriores el RTT puede aparecer como `n/d`.

Ejecutar desde la raiz:

```sh
node tools/check-online-protocol.js
node tools/check-session-regressions.js
node tools/check-network-resilience.js
node tools/check-physics-parity.js
node tools/check-spawn-scoring.js
node tools/stress-game.js
```

Las pruebas de protocolo usan los handlers reales y transportes simulados: ACK perdido, duplicados, expiracion, cambio de ronda/serie, nueva sesion de entrada, reconexion y fases confirmadas. No sustituyen una partida real en dos dispositivos.

Actualizar backend y cliente conjuntamente, con el backend primero; Pages sirve `main/docs` y Render ejecuta `server/`. Un cliente o servidor de otro contrato recibe un aviso de actualizacion en lugar de entrar en una partida incompatible. TURN sigue siendo configurable mediante `/rtc-config`; no se exige para usar el respaldo WebSocket. El anfitrion sigue siendo autoritativo, por lo que este protocolo no impide las trampas de un anfitrion modificado.

