# Galaxy Combat: destinos de versiones

- El usuario ha solicitado una copia alternativa para probar versiones, llamada exactamente `bruebas`.
- Si el usuario dice «pruebas» al pedir un cambio o subida, trabajar y publicar en `docs/bruebas/`.
- La version principal esta en `docs/`, excluyendo `docs/bruebas/`.
- No trasladar cambios de pruebas a la principal ni sincronizar las dos copias sin una solicitud del usuario.
- Mantener las rutas de recursos relativas dentro de la copia de pruebas, la etiqueta PRUEBAS, las claves propias de sesion y las caches con prefijo `galaxy-bruebas-`.
- El servidor `server/` es compartido. Una peticion de pruebas de backend requiere un servicio separado; no modificar el servidor principal como efecto de un cambio de pruebas del cliente.
