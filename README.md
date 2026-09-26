# Galaxy Combat Web

**Versión actual: V18.87**

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
- Si un jugador no anfitrión pierde el WebSocket, su plaza se reserva durante 30 segundos.
- Si no vuelve y hay CPU de relleno, su plaza vuelve a CPU y la partida continúa.
- Cuando un jugador no anfitrion abandona una partida con CPU de relleno, su misma plaza pasa a CPU sin detener la partida y se muestra un aviso durante 3 segundos.
- Si se pierde definitivamente el anfitrión, la partida termina porque la física vive en su navegador.
- Las partidas que usan CPU de relleno no cuentan para el ranking.

## Control móvil

Se juega en horizontal.

- Inclinar el móvil: girar.
- Toque rápido en la zona de juego: disparar.
- Mantener pulsado: acelerar mientras el dedo siga apoyado.
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
