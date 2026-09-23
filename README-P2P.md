# Galaxy Combat P2P - prueba

Esta variante mueve la simulacion autoritativa al navegador del creador de la partida.

- GitHub Pages sirve `docs/`.
- Render ejecuta solo `server/p2p-server.js` para salas y senalizacion WebRTC.
- El host calcula fisicas a 60 Hz y publica snapshots a 30 Hz por WebRTC DataChannel.
- Los invitados envian solo sus controles al host.
- No requiere abrir puertos en condiciones NAT normales gracias a ICE/STUN.

## Despliegue
1. En Render crea un Web Service desde este repositorio.
2. Usa root `server` y start `npm start`.
3. Copia la URL HTTPS de Render a `docs/config.js`.
4. En GitHub Pages publica desde `main`, carpeta `/docs`.

## Limitaciones de esta primera prueba
- Si el host abandona, termina la sala.
- Aun no hay migracion de host.
- STUN solamente; algunas redes muy restrictivas pueden necesitar TURN.
- El host es autoritativo, por lo que un host modificado podria hacer trampas.
