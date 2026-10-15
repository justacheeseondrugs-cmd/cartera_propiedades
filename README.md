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
