# @ghapheros/extensions

Extensiones opcionales. Una extensión es un script que se engancha a eventos del núcleo sin modificarlo.

## Contrato

```html
<script src="packages/core/viewer.js"></script>
<script src="packages/extensions/examples/scenario-log.js"></script>
```

| Evento | Cuándo | Payload |
|---|---|---|
| `built` | Se reconstruye la escena completa | `{ project }` |
| `scenario` | Cambia el escenario activo | `{ id }` |

Un error dentro de una extensión se registra en consola y no detiene el visor.

## Escribir una extensión

1. Crea un archivo en `packages/extensions/`.
2. Usa `window.GhapherOS.on(evento, fn)` para suscribirte.
3. Si necesitas leer datos del proyecto, usa el `payload` o `fetch('data/example.json')`.
4. Documenta en el encabezado del archivo qué evento usa y qué hace.

Las extensiones no deben escribir en `data/`. Los cambios de proyecto pasan por la capa de control (ver `docs/DISENO-SERVICIO.md`).
