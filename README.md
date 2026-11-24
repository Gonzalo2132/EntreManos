# EntreManos

Demo de una comunidad vecinal cerrada para compartir herramientas y pedirlas prestadas. La idea resuelve algo cotidiano: comprar o guardar una herramienta que otra persona del barrio ya tiene.

## Cómo probarla con registro e inicio de sesión

1. Iniciá **Apache** y **MySQL** desde el panel de XAMPP.
2. En phpMyAdmin, importá `database.sql`. Esto crea la base `entremanos`, las tablas `usuarios` y `vecindarios`, y el vecindario inicial **Villa del Parque**.
   - Si ya tenías una base anterior con tablas `users` y `neighborhoods`, ejecutá una sola vez `migracion_nombres_espanol.sql` para renombrar las tablas y columnas conservando las cuentas.
   - Si esa base todavía no tenía vecindarios, ejecutá primero `migracion_vecindarios.sql` y después `migracion_nombres_espanol.sql`.
3. Abrí `http://localhost/entremanos/` (no abras `index.html` directamente, porque PHP debe ejecutarse en Apache).
4. Elegí **Registrate**, completá nombre, correo y contraseña, y seleccioná un vecindario existente o creá uno nuevo. Después iniciá sesión con esos datos.
5. Buscá herramientas y filtrá por categoría. Al publicar una herramienta, agregá tu WhatsApp con el código de país; el botón de contacto abre una conversación con un mensaje preparado.

La conexión usa por defecto MySQL en `127.0.0.1`, base `entremanos`, usuario `root` y contraseña vacía, que es la configuración habitual de XAMPP. Se puede personalizar con las variables de entorno `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.

Las cuentas, sus vecindarios y las contraseñas cifradas se guardan en MySQL. La sesión de autenticación se mantiene en el servidor; publicaciones y guardados se guardan en el almacenamiento local del navegador. El teléfono que se agrega a una publicación queda visible para que otros vecinos puedan escribir por WhatsApp. Los nombres de tablas y columnas de MySQL están en español; la base conserva el nombre `entremanos`.

## Para explicar en el coloquio

- **Problema:** muchas herramientas se usan poco; compartirlas ahorra compras y ayuda a los vecinos.
- **Propuesta:** una comunidad cerrada donde consultar qué hay disponible cerca y coordinar un préstamo.
- **Demo técnica:** registro e inicio de sesión con PHP, PDO y MySQL; creación y selección de vecindarios; búsqueda, filtros y publicaciones locales aisladas por vecindario.
- **Tecnologías:** HTML, CSS, JavaScript, PHP y MySQL, ejecutados localmente con XAMPP.
- **Próxima etapa:** guardar publicaciones en el servidor y agregar chat, aprobación de solicitudes y perfiles verificados.

> **Importante:** configurá credenciales seguras de MySQL si publicás la aplicación fuera de un entorno local.
