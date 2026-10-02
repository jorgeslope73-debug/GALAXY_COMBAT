# Galaxy Combat — pruebas

Esta carpeta se llama `bruebas`, tal como pidio el propietario.

## Estructura

- `index.html`: entrada del juego de pruebas; muestra la etiqueta PRUEBAS.
- `*.js` y `*.css`: copia independiente del cliente.
- `assets/sprites/`: fondos y texturas de esta version.
- `assets/sonido/`, `assets/font/`, `assets/icons/` y `assets/manual/`: recursos propios.
- `config.js`: direccion del servidor online.
- `sw.js` y `manifest.webmanifest`: PWA de pruebas con cache propia.

Direccion: https://jorgeslope73-debug.github.io/GALAXY_COMBAT/bruebas/

## Uso

Cuando el usuario diga «pruebas» para un cambio de version, editar y subir el cambio en `docs/bruebas/`.
La version principal esta en `docs/`, excluyendo esta subcarpeta. No copiar cambios de pruebas a la principal sin una solicitud del usuario.
Esta copia parte del commit `587a37fc8e0b19e68cdd060b1ac319759c70e031`.
Las futuras mejoras de la principal no actualizan automaticamente esta copia.

Las caches de pruebas usan `galaxy-bruebas-` y no borran las caches de la version principal.
Las sesiones de partida y el identificador del cliente tienen claves propias.
La cuenta del jugador y el servidor online siguen siendo los actuales; salas, ranking, estadisticas y aprendizaje comparten backend.
Para experimentar con el backend, preparar un servidor de pruebas y cambiar solo el `config.js` de esta carpeta.
