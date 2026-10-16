# Avisos push de Carterita — Cloudflare Workers Free

La PWA sigue en GitHub Pages. La ruta de avisos guarda únicamente suscripciones push, códigos de ficha, horarios UTC y estado de entrega. La ruta opcional `/transcribe` recibe audio y, con autorización, nombres para reenviarlos a OpenAI; no los persiste. La clave de OpenAI para voz se guarda como secreto del Worker. No recibe documentos, contraseñas de respaldo ni credenciales de huella. SQLite-backed Durable Objects está disponible en Workers Free; la cuenta conserva sus cuotas y condiciones. No actives un plan de pago para este proyecto.

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

### Compatibilidad de las peticiones push
Cloudflare Workers solo admite los modos de redirección `follow` y `manual`. El envío usa `manual` para no seguir redirecciones del endpoint; una respuesta 3xx no se considera una entrega aceptada. La opción estándar de navegador `error` provoca un TypeError en Workers antes de enviar la petición. Esta diferencia se reprodujo y corrigió con el runtime real, no solo con el mock de fetch de Node.


## Voz opcional: configuración en Cloudflare

La voz usa el mismo Worker con una ruta independiente `/transcribe`. Los avisos existentes conservan `REMINDERS`, la clase `ReminderService` y la migración v1. La migración v2 añade `VOICE_USAGE`/`VoiceUsage`, otro Durable Object SQLite que guarda solo fecha y número de intentos. No modifica suscripciones, fichas, respaldos ni avisos. No requiere KV: el contador es atómico para evitar excederlo por peticiones simultáneas.

1. Espera que **Workers Builds** termine correctamente al actualizar el repositorio.
2. En Carterita abre **Asistente → Configurar voz con IA → Generar código nuevo → Copiar código**. Conserva esta pantalla mientras configuras Cloudflare. No es la clave de OpenAI.
3. En Cloudflare entra a **Workers & Pages → carterita-avisos → Settings → Variables and Secrets**. Añade dos valores de tipo **Secret**:
   - `OPENAI_API_KEY`: una clave de API de OpenAI con saldo y permiso para transcripción. No es la suscripción de ChatGPT. Puede usarse una clave existente si tiene los permisos necesarios; nunca se pega en GitHub ni en este chat.
   - `TRANSCRIBE_TOKEN`: el mismo código aleatorio que generó Carterita (mínimo 32 caracteres).
4. Guarda/despliega la configuración de Cloudflare si lo solicita. No borres ni cambies `PAIRING_CODE` ni los bindings de avisos.
5. Regresa a Carterita. La dirección predefinida es `https://carterita-avisos.justacheeseondrugs.workers.dev`. Si desplegaste otro Worker, cámbiala. Guarda el código de conexión en esa pantalla. No pegues aquí la clave de OpenAI.
6. Compartir nombres es opcional y viene desactivado. Si lo activas, se enviarán hasta 100 nombres, nunca sus teléfonos, correos ni documentos. Antes de transcribir manualmente se muestra la lista; en modo conversación se revisa al autorizar la sesión. La lista se fija durante esa sesión. Las coincidencias aproximadas son sugerencias para aceptar, nunca sustituciones silenciosas.

Variables no secretas ya incluidas en `wrangler.jsonc`:

- `TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`.
- `TRANSCRIBE_DAILY_LIMIT=20`. Se admiten valores entre 1 y 200; el día se calcula en `America/Santiago`. Cada fragmento que se envía a OpenAI reserva un intento antes de contactar al proveedor; los fallos también consumen ese intento. No es un límite monetario de la cuenta.
- `APP_ORIGIN` y `APP_URL` continúan apuntando a GitHub Pages.

Los secretos de Cloudflare no se publican al desplegar el código. El token del navegador se conserva en una clave local separada de la sesión y no se exporta en los respaldos. Es una protección básica para un dispositivo personal; alguien con acceso al navegador puede extraerlo. CORS solo permite el origen configurado, pero no reemplaza el token.

### Prueba desde el teléfono

1. Actualiza Carterita. En el asistente elige **Grabación con IA** y toca el micrófono. Permite el acceso.
2. Di una frase breve con datos inventados y toca para detener. Escucha la grabación si quieres. Aún no se envió nada.
3. Pulsa **Transcribir con IA**. Revisa/corrige el texto y pulsa **Aceptar texto**, o descártalo. Aceptarlo no envía por sí solo un mensaje al asistente.
4. Prueba **Iniciar conversación** y lee la autorización de sesión. Di «Agrega a Cliente de prueba, busca casa en Coronel. Respóndeme ahora» y deja unos segundos de silencio. No se guardará una ficha hasta revisar y confirmar las acciones.
5. Carterita pausa el micrófono, responde en voz alta y vuelve a escuchar al terminar. Usa **Solo texto** para desactivar la lectura. Si el navegador bloquea la voz, prueba antes **Ficha de contexto y voz → Elegir voz y velocidad → Probar voz**. Si no puede hablar, se detiene la sesión en lugar de fingir que respondió por voz.
6. Pulsa **Terminar conversación** y verifica que desaparezca el indicador de micrófono. Cambiar de app u ocultar Carterita detiene la conversación; no funciona como una llamada en segundo plano.
7. Cambia a **Dictado del teléfono** para probar el camino sin transcripción de pago; necesita la IA de texto para obtener respuestas, pero no usa la ruta de audio.

### Costos, límites y privacidad

MediaRecorder elige un tipo soportado (WebM/Opus o MP4 en dispositivos compatibles). El cliente limita a 60 segundos y el servidor a 2 MB por audio. La pausa de aproximadamente 2,5 segundos cierra un fragmento; puede haber varios fragmentos/transcripciones antes de una única respuesta del asistente. El servidor valida duración declarada y tamaño, pero no decodifica el audio para medir su duración real. Un token filtrado puede permitir consumir la cuota hasta el límite diario; no equivale a un tope de dólares.

En grabación manual se revisa el audio antes de compartirlo y luego se revisa el texto. El modo conversación requiere consentimiento explícito por sesión para compartir cada fragmento, el historial del chat y el contexto seleccionado sin confirmaciones intermedias. Solo la frase de cierre al final del texto autoriza enviar al asistente. Los cambios en clientes siempre requieren el flujo de revisión y guardado. No hay reintentos automáticos ante fallos de red/proveedor.

El Worker y la PWA no guardan grabaciones en bases de datos ni respaldos. El audio se procesa temporalmente en memoria y se envía a OpenAI; sus políticas de retención son independientes. El chat aceptado se guarda con el flujo habitual de Carterita. Los registros de observabilidad del Worker siguen desactivados. La lectura usa las voces del teléfono y no hace llamadas de audio a OpenAI.

La transcripción y las respuestas tienen contadores independientes. El plan gratuito de Cloudflare tiene cuotas propias: no se garantiza costo cero si cambias de plan o superas sus cuotas. La prueba real de audio requiere que el propietario configure los secretos; el código se verificó con respuestas de proveedor simuladas, no con sus claves.
