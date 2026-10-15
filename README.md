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
