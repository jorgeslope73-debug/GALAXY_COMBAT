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

