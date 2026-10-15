# Cartera · Consultas de propiedades

PWA para organizar consultas inmobiliarias, preparar respuestas y llevar seguimientos. Sin API key y sin acceso automático a WhatsApp.

## Abrir la aplicación
https://justacheeseondrugs-cmd.github.io/cartera_propiedades/

El enlace funciona después de activar GitHub Pages en **Settings → Pages → Deploy from a branch → main → /docs → Save**.

En Android, abre el enlace en Chrome y usa su menú para instalar la aplicación o añadirla a la pantalla de inicio. La disponibilidad offline requiere una primera carga correcta.

## Funciones
- Crear, editar y eliminar fichas de clientes.
- Filtrar por estado e interés; buscar por nombre, teléfono, comuna o propiedad.
- Preparar y editar plantillas sin inventar precios o disponibilidad.
- Copiar respuestas y enviarlas manualmente en WhatsApp.
- Consultar seguimientos pendientes al abrir la app (sin notificaciones programadas).
- Exportar e importar respaldos con validación y combinación por identificador.

## Datos privados y respaldo
El repositorio y la aplicación son públicos. **Los datos de clientes se guardan solo en localStorage del navegador y no se envían a GitHub.** No hay base de datos remota ni sincronización entre dispositivos. Cualquier persona con acceso al navegador del dispositivo podría ver las consultas: usa bloqueo de pantalla.

No subas respaldos al repositorio: contienen datos personales sin cifrar. Exporta desde Respaldos y comprueba el archivo descargado. Borrar los datos del navegador puede eliminar las consultas. El cambio de dominio o navegador no migra datos automáticamente: exporta desde la dirección anterior e importa en la nueva. Los archivos de respaldo quedan excluidos por .gitignore si se llaman cartera-respaldo-*.json, pero esto no impide subirlos manualmente en GitHub.

El mensaje original que pegas sirve de referencia temporal: no se analiza ni guarda. Los borradores editados sí se guardan. Una sola pestaña de edición a la vez.

## Ejecutar en el computador
Requiere Node.js 22 o superior. No requiere instalar paquetes.

```bash
npm start
```

Abre http://localhost:3001. Este servidor de prueba escucha solo en el computador; para el teléfono usa GitHub Pages.

## Validación
```bash
npm test
```

Comprueba respaldos, combinación sin duplicados, fechas y plantillas. Los archivos publicables están en `docs/`. No hay dependencias externas, analítica o modelos de IA.


## Versión 0.2: Leasing y conversaciones de Dataprop
- Dos áreas de trabajo: Corretaje y Leasing, con filtros y ejemplos ficticios.
- Datos de origen (Dataprop, WhatsApp, referido u otro) y correo.
- Próxima acción y fecha de contacto. El resumen incluye fechas de hoy y anteriores, excluyendo consultas cerradas. No hay notificaciones con la app cerrada.
- Leasing: lista de documentos editable por cliente, con estados Faltante, Recibido, En revisión, Requiere corrección y No aplica. No incluye requisitos predeterminados ni almacena archivos de identidad o antecedentes.
- Simulación: registro manual de estado, entidad, fecha de solicitud y resultado/notas. No calcula crédito ni decide aprobación.
- Plantillas para primer contacto desde Dataprop, conocer requisitos, consultar disponibilidad, proponer visitas y retomar el contacto; además de mensajes para documentación y simulación.
- Tono cercano o profesional. El mensaje original pegado no se interpreta para las plantillas; se incluye solo si se genera un prompt para usar externamente en una IA. Esos prompts omiten nombre, teléfono y correo de la ficha, pero debes revisar el texto que pegues antes de compartirlo.
- No hay integración automática con Dataprop, WhatsApp o una IA. Los mensajes no se envían desde la aplicación.
- Los respaldos son versión 2 y conservan documentos y simulaciones. La app sigue importando respaldos versión 1 y asigna Corretaje a consultas antiguas. El almacenamiento usa la misma clave para conservar fichas existentes.

Al actualizar, recarga la aplicación. Exporta un respaldo antes de cambiar de dominio o dispositivo. Las comprobaciones automatizadas cubren migración, respaldos, fechas, documentos y generación de mensajes/prompts. También se verificó el flujo de la interfaz mediante simulación DOM (crear ficha, editar documentos, filtrar, copiar y guardar); no se realizó una revisión visual en un navegador en este entorno.


## Versión 0.3: Recordatorios y calendario
- Cada próximo seguimiento tiene fecha y hora local del dispositivo. Se puede marcar como hecho o volver a pendiente sin cerrar la consulta; los hechos no se cuentan en pendientes de hoy. Cambiar la acción, fecha u hora crea un nuevo pendiente; editar otras notas conserva su finalización.
- “Descargar para calendario (.ics)” genera un evento de 15 minutos, con un aviso solicitado 1 minuto antes. El nombre del cliente y la próxima acción se incluyen; no se incluyen documentos, teléfono ni correo. La app de calendario debe admitir importar .ics y conservar/configurar el aviso. No se garantiza compatibilidad con todos los teléfonos.
- “Probar aviso” genera un evento ficticio aproximadamente cinco minutos después. Abre el archivo en Calendario, confirma su fecha/hora y guarda el evento. Puedes eliminarlo al terminar la prueba. Si el sistema no ofrece una app compatible, ese teléfono necesitará otra vía de importación.
- “Abrir Google Calendar” abre un borrador; selecciona la cuenta y el calendario correctos, configura el aviso y guarda. No hay API, credenciales o conexión permanente.
- Ninguna exportación se sincroniza. Completar, editar o borrar en Cartera no cambia los eventos existentes; importar varias veces puede duplicarlos según la app. Los recordatorios externos los gestiona el calendario y sus permisos de notificación.
- Respaldos versión 3: conservan hora y finalización y siguen importando versiones 1 y 2.


## Versión 0.3.1: Accesos a recordatorios en contexto
- Botón para recordar un documento individual, todos los documentos, una simulación o volver a contactar después de preparar una respuesta.
- Después de guardar una consulta o editar documentos/estado, aparece una oferta opcional para programar el próximo paso. Guardar nunca genera eventos por sí solo.
- Un diálogo permite revisar acción, fecha y hora y elegir guardar solo en Cartera, descargar .ics o abrir un borrador de Google Calendar.
- Cada ficha sigue teniendo **un próximo seguimiento**. Programar desde otra sección lo actualiza; los eventos ya exportados son independientes y deben ajustarse manualmente. La app no adjunta ni guarda archivos de documentos.


## Versión 0.4: Vista más sencilla
- Inicio en Mis pendientes y acceso a Todos mis clientes. Filtros y estadísticas avanzadas se despliegan solo cuando se necesitan.
- Ficha por secciones: Qué sigue, Mensaje, Documentos y Simulación. Solo se muestra una sección a la vez. Las opciones de IA y calendario menos frecuentes siguen disponibles en bloques desplegables.
- Añadir cliente requiere solo el nombre; los datos de propiedad, correo, origen, seguimiento, documentos y notas están agrupados. La intención empieza en Por definir, sin asumir compra o arriendo.
- Botones más grandes, texto más legible y acciones nombradas directamente. La pestaña Mensaje explica cómo preparar, revisar y copiar un texto para WhatsApp.
- Las fichas, respaldos y recordatorios existentes se conservan. La estructura de datos sigue en versión 3.
- Se verificaron lógica, migración, calendarios y los recorridos de interfaz mediante simulación DOM, incluyendo navegación entre secciones y apertura del grupo que contenga un campo inválido. Falta una revisión visual en un teléfono real.


## Versión 0.5: Mi forma de escribir y contexto para ChatGPT
- En Más opciones → Mi forma de escribir, guarda trato, tono, extensión, emojis, saludos, firma, preferencias y hasta cinco mensajes de ejemplo de 1.200 caracteres. Las opciones iniciales son editables: no se han deducido de conversaciones privadas.
- La app no puede leer WhatsApp ni el historial de ChatGPT. Pega solo ejemplos seleccionados y anonimizados; no exportes chats completos.
- Dentro de Mensaje → Escribir con ChatGPT, prepara las instrucciones con el perfil y solo el caso seleccionado. Revisa el texto, copia las instrucciones, abre ChatGPT y pégalas. El borrador de respuesta se trae manualmente a Cartera.
- El generador omite nombre, teléfono y correo de la ficha. El texto pegado, preferencias y ejemplos son libres: debes quitarles datos personales o sensibles antes de copiarlos. No hay una anonimización automática ni envío a una API. Abrir ChatGPT solo abre su página, sin datos de la ficha en la dirección.
- El perfil se aplica al prompt para la IA; las plantillas de reglas existentes siguen funcionando sin IA. El perfil no entrena un modelo ni crea memoria permanente en ChatGPT. Se incluye en cada prompt preparado.
- Los respaldos versión 4 incluyen el estilo. Al importar un respaldo, recuperar también el estilo es opcional y requiere marcar una casilla; si no la marcas, conserva el estilo actual. Las versiones 1, 2 y 3 siguen siendo compatibles.

- Perfil inicial suministrado por la usuaria: trato de usted, tono cercano y profesional, respeto por los tiempos y sin promesas no confirmadas. Incluye cinco muestras marcadas como iniciales por revisar. La usuaria puede sustituirlas y marcar cuándo estén aprobadas.
- El perfil inicial solo se aplica si el navegador no tiene uno guardado; nunca reemplaza silenciosamente preferencias existentes. No contiene nombre real de la asesora, empresa ni datos de clientes.


## Versión 0.6: Cargar clientes preparados con ChatGPT
1. Abre Cargar varios con ChatGPT (también en Más opciones).
2. Copia las instrucciones y pega debajo tus notas desordenadas en ChatGPT. Usa alias y evita antecedentes sensibles. No hay envío automático ni API key.
3. Pega el JSON devuelto o carga su archivo, y pulsa Revisar antes de guardar.
4. Corrige las fichas. Las coincidencias por teléfono, correo o nombre requieren elegir explícitamente crear, actualizar u omitir. La app no fusiona identidades por sí sola.
5. Guarda las fichas revisadas. No se crean eventos de calendario ni se envían mensajes al importar.

Formato distinto a un respaldo: `{ "app": "cartera-clientes", "version": 1, "referenceDate": "YYYY-MM-DD", "clients": [...] }`. Las instrucciones incluyen el esquema completo y opciones permitidas. Hasta 50 entradas y 2 MB. No admite IDs ni marcas de tiempo de la IA; se generan localmente.

- La revisión valida tipos, fechas y estados, pero no puede comprobar que los hechos extraídos por ChatGPT sean verdaderos. Los datos dudosos se conservan como notas Por confirmar. Fechas relativas deben confirmarse.
- Actualizar conserva campos no aportados o vacíos, borradores y documentos no mencionados. Añade notas y combina documentos por nombre; un documento existente puede cambiar de estado. La vista previa muestra los campos de la ficha que cambiarán. Dos entradas no pueden actualizar simultáneamente la misma ficha.
- Un cliente puede tener varias consultas legítimas. Crear fichas nuevas con coincidencias requiere confirmación adicional; no se bloquea automáticamente por compartir nombre o contacto.
- El paquete es temporal hasta guardar. Cerrar la app sin confirmar puede perder la vista previa; el texto original permanece en tu conversación con ChatGPT según su servicio. No subas paquetes ni respaldos con datos personales al repositorio.
- La carga por IA es independiente del perfil de escritura y no lo reemplaza. Los respaldos completos siguen usando su flujo habitual.


## Versión 0.7: Ficha rápida, WhatsApp y uso offline
- Qué sigue muestra el último mensaje recibido que hayas guardado manualmente, el próximo paso y el botón Abrir WhatsApp con mi mensaje. No lee conversaciones ni confirma envíos. El último mensaje alimenta el contexto para ChatGPT y se guarda en respaldos versión 5 (se importan también versiones anteriores).
- WhatsApp usa un enlace wa.me con número internacional y borrador codificado. Si falta el número o el código de país, pide corregirlo; si falta el texto, abre Mensaje. El usuario revisa y pulsa Enviar en WhatsApp. No registra como enviado algo que solo se abrió.
- La PWA incluye manifest con iconos PNG de 192 y 512 y compatibilidad maskable; Más opciones → Instalar en este dispositivo usa la oferta nativa cuando existe y ofrece instrucciones cuando no. La instalación depende del sistema y navegador.
- El service worker precarga la versión completa de la interfaz, módulos, estilos e iconos, sin depender de fuentes ni librerías externas. Atiende solo su propio subdirectorio en GitHub Pages, no otros sitios del mismo dominio. La interfaz cacheada se sirve sin esperar a la red; una versión nueva se activa al pulsar Actualizar aplicación, evitando mezclar módulos entre versiones.
- Espera “Lista para usar sin conexión” después de la primera visita con internet. Luego puedes abrir fichas, editarlas, preparar plantillas y respaldos sin conexión. WhatsApp para enviar, ChatGPT y Google requieren sus propios servicios y conexión. El estado de red del navegador no garantiza acceso a un servicio concreto.
- Los datos permanecen en localStorage; instalar la PWA no es un respaldo. Guarda copias frecuentes y no borres los datos del navegador para actualizar.
- `npm test` incluye pruebas de datos, enlaces de WhatsApp, migraciones, caché offline, alcance del service worker y manifest/iconos. Además se simularon las acciones de interfaz y eventos de instalación/actualización. La instalación nativa y la experiencia visual en un teléfono real siguen pendientes de comprobar.

## Correcciones de mensajes
En Mensaje → Ajustar este mensaje puedes combinar Más cercano, Más formal, Más emojis, Sin emojis, Más claro, Más breve o Más completo y escribir otro ajuste. Las opciones opuestas se desmarcan. Preparar corrección para ChatGPT reúne el borrador actual, los ajustes, el perfil y los datos de referencia de ese cliente. Revisa las instrucciones antes de copiarlas; no se envían automáticamente ni requieren una API. Pega el resultado de ChatGPT en el borrador para revisarlo. Este proceso no modifica el perfil ni reemplaza automáticamente el mensaje.

## Versión 0.8: Corrección dentro de Cartera con OpenAI
- Más opciones → IA para mensajes permite guardar o eliminar una clave personal en una entrada local separada. No se incluye en respaldos ni paquetes. El navegador llama directamente a api.openai.com; la clave es accesible desde ese dispositivo. No se sincroniza con Inky ni otros dispositivos.
- Mensaje → Ajustar este mensaje → Corregir aquí con IA envía el borrador, ajustes, perfil sin ejemplos (preferencias resumidas) y datos de referencia de esa ficha. No envía toda la cartera ni el último mensaje del cliente, teléfono o correo de la ficha; el texto libre puede contener datos sensibles y debe revisarse antes. La respuesta solo se aplica al aceptar; se rechaza sobrescribir si cambia el borrador o cliente durante la petición.
- GPT-5.4 mini, razonamiento none, servicio estándar, máximo 800 tokens de salida y borrador de hasta 4.000 caracteres. Una sola solicitud, sin reintentos o modelos alternativos. Salidas incompletas se rechazan. Sin conexión siguen disponibles las plantillas y edición manual.
- Máximo 20 intentos por día local en ese navegador, contando fallos para evitar reintentos costosos. No es un límite monetario ni global; otros dispositivos o borrar el almacenamiento lo reinician. El proveedor puede procesar una petición incluso si se pierde la conexión. La API tiene facturación separada de la suscripción de ChatGPT. No se promete un precio fijo.
- La clave y el contador no se comparten con los clientes ni se incluyen en GitHub. Las propuestas se mantienen en el diálogo durante la sesión; solo al aceptarlas se guarda el borrador. La integración se prueba con respuestas simuladas: la llamada real debe verificarse desde el dispositivo con su clave.

## Versión 0.9: Paquetes para cambiar de dispositivo
Más opciones → Guardar / cargar paquete permite descargar un .json fechado y cargarlo en otra instalación de Cartera. Incluye todas las fichas guardadas, checklist de documentos y estados (no adjuntos), simulaciones, seguimientos, último mensaje anotado, borradores y perfil profesional. La sesión incluye cliente/pestaña abiertos, mensajes originales temporales, objetivos, tonos, prompts y ajustes en preparación, y una propuesta de IA pendiente. No incluye formularios de ficha o perfil sin guardar, la revisión de carga masiva todavía sin confirmar, conversaciones de WhatsApp, eventos externos de calendario, clave API ni contador local de consumo. Guarda los formularios antes de exportar. El archivo contiene datos personales: no debe subirse al repositorio.

Al elegir un archivo se muestra una revisión. Al confirmar se guardan los datos en localStorage del dispositivo receptor: no requiere mantener abierto el .json y persiste al recargar. Perfil y sesión tienen casillas de recuperación; las fichas se combinan por identificador y conserva la fecha de modificación más reciente, sin eliminar otras fichas. Si ambos dispositivos editan la misma ficha, se conserva la ficha completa más reciente, sin combinar campos individualmente. No hay sincronización automática ni se propagan borrados. Una propuesta pendiente solo se recupera si el borrador original sigue coincidiendo. Versiones 1–5 siguen siendo compatibles; exportación y almacenamiento usan versión 6. La clave se configura por dispositivo y los eventos del calendario se gestionan aparte.
