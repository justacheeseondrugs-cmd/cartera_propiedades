# Avisos push de Carterita — Cloudflare Workers Free

La PWA sigue en GitHub Pages. Este Worker independiente guarda únicamente suscripciones push, códigos de ficha, horarios UTC y estado de entrega. No recibe nombres, mensajes, documentos, claves de OpenAI, contraseñas de respaldo ni credenciales de huella. SQLite-backed Durable Objects está disponible en Workers Free; la cuenta conserva sus cuotas y condiciones. No actives un plan de pago para este proyecto.

## Conectar desde Cloudflare (sin terminal)

1. En **Workers & Pages → Create application / Crear aplicación**, elige **Import a repository / Continue with GitHub**. No elijas Pages ni agregar un dominio.
2. Autoriza a Cloudflare a leer solamente `justacheeseondrugs-cmd/cartera_propiedades` si permite seleccionar repositorios.
3. Selecciona el repositorio. Nombre del Worker/proyecto: `carterita-avisos`.
4. Directorio raíz: `/`. Deja vacío el comando de build; comando de despliegue: `npx wrangler deploy`. La instalación de dependencias usa el `package-lock.json` del repositorio (`npm ci`). Rama: `main`. El archivo `wrangler.jsonc` configura el Worker, su almacenamiento SQLite y la migración automáticamente.
5. Despliega. Si Cloudflare pide elegir un subdominio gratuito `workers.dev`, puedes escoger uno. No necesitas dominio propio. No confirmes un cambio a un plan de pago.
6. Abre **Settings / Configuración → Variables and Secrets / Variables y secretos → Add**. Tipo **Secret**, nombre exacto **PAIRING_CODE**. Valor: genera en tu gestor de contraseñas un código secreto aleatorio de al menos 24 caracteres (preferible 32 o más, letras/números/guiones). No uses la contraseña de tu cuenta. No lo subas a GitHub ni lo pegues en el chat. Guarda y vuelve a desplegar si Cloudflare lo solicita.
7. Conserva la URL pública `https://carterita-avisos.<tu-subdominio>.workers.dev`. Antes de configurar el secreto, el servicio devuelve un error 503; esto es intencional. Abrir la URL en una pestaña puede devolver “Origen no permitido”: no es una página web; se prueba desde Carterita.
8. En el HONOR, actualiza Carterita → **Más opciones → Notificaciones del teléfono**. Introduce esa URL y el código **PAIRING_CODE** y pulsa **Activar**. Permite notificaciones y después pulsa **Enviar prueba**. El código solo se utiliza para vincular; el navegador guarda un token independiente del dispositivo.
9. Programa un seguimiento con fecha/hora a 2–3 minutos en el futuro. Espera “Avisos sincronizados”, oculta/cierra la PWA y comprueba la notificación. Al tocarla debe pedir desbloqueo si está activado y abrir la ficha. Después prueba marcarlo como hecho ANTES de la hora y espera la sincronización: no debe enviar un nuevo aviso. Un aviso ya entregado o en tránsito no se puede retirar.

Los nombres de menús pueden variar. La primera conexión a GitHub y las condiciones de la cuenta deben completarse en el navegador del propietario. No compartas credenciales para que otra persona haga ese paso.

## Alternativa desde un computador con Node 22+

```sh
npm ci
npx wrangler login
npx wrangler deploy
npx wrangler secret put PAIRING_CODE
```

El último comando pide el valor sin incluirlo en el historial. El login abre el navegador local para autorizar Cloudflare. No mandes el token al asistente. No ejecutes `wrangler delete`: eliminar el Worker o su namespace puede perder suscripciones y avisos. No cambies los nombres de bindings/clase/migración de un servicio ya desplegado sin migrar sus datos.

## Operación y límites

- `REMINDERS`: Durable Object SQLite único por propietario. Una credencial secreta de conexión vincula dispositivos. Cada uno recibe un token de 256 bits, del que el servidor conserva solo SHA-256. Hasta 10 dispositivos y 200 seguimientos futuros por dispositivo, con horizonte de un año.
- Claves VAPID generadas y almacenadas dentro del Durable Object al configurar. No se publican claves privadas. La suscripción se valida contra proveedores Web Push admitidos (FCM/Firefox/Apple/Windows) para evitar destinos arbitrarios. CORS solo permite el origen de GitHub Pages configurado; no sustituye la autenticación por tokens.
- Una instantánea autenticada reemplaza los horarios de ese dispositivo: omitir un seguimiento lo cancela. Revisión monotónica rechaza peticiones anteriores. Si cambia la hora se registra otro horario; marcar completado, cerrar o eliminar la ficha lo retira en la siguiente sincronización. Los estados de reintento se conservan para no reiniciar las esperas con cada edición.
- Al ocultar/cerrar la página se intenta sincronizar con `keepalive`. Si no hay conexión, el navegador cierra antes de enviar, hay conflicto o el servicio falla, puede llegar un aviso anterior. La UI muestra los cambios pendientes; no promete cancelar hasta confirmar en el servidor. Los cambios offline se envían al volver a abrir o recuperar conexión; no hay sincronización de fichas entre dispositivos.
- Alarms despierta el objeto sin la PWA abierta. Procesa pequeños lotes, hasta cinco intentos con espera exponencial. Expira suscripciones 404/410 y dispositivos sin sincronizar 30 días. Reabrir la PWA mantiene la conexión; si ya caducó, se reactiva. No es un sistema de alarmas de seguridad ni asegura hora exacta o entrega única: existen reintentos y fallos entre entrega y confirmación. Etiquetas del sistema evitan acumular duplicados de la misma ficha. TTL del proveedor: una hora; avisos más de un día atrasados no se reenvían.
- Las notificaciones contienen texto fijo genérico y códigos opacos, sin nombres. Abrirlas no evita el gate de desbloqueo. Los códigos permiten que el dispositivo busque su propia ficha; si no la tiene, lo informa.
- Al desactivar se intenta desuscribir el navegador y eliminar los horarios del servidor. Si no se confirma la retirada, la UI ofrece repetir con conexión. La conexión push no forma parte de los respaldos y debe activarse por separado en cada dispositivo.
- API de prueba: como máximo una por minuto por dispositivo. Vinculación: máximo 60 solicitudes correctas por hora. El Worker no habilita registros de observabilidad que almacenen los cuerpos de solicitudes.
- Tarifas y cuotas del plan pueden cambiar: https://developers.cloudflare.com/durable-objects/platform/pricing/

## Verificación realizada

`npm test` cubre autenticación, orígenes, validación de destinos, programación, reemplazo/cancelación, reintentos, retiro de suscripciones, cifrado RFC 8291 y manejo seguro del click. `wrangler deploy --dry-run` compila el servicio. Se probó con el runtime local real de Cloudflare el alta de dispositivo, persistencia SQLite, actualización y eliminación de horarios. Se simuló la UI de permisos/activación/sincronización/desactivación. No se envió ninguna push real ni se desplegó el servicio en la cuenta del usuario: faltan conectar Cloudflare/GitHub, guardar el secreto y probar en HONOR.
