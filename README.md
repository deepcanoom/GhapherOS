# GhapherOS

[![Desplegar](https://github.com/deepcanoom/GhapherOS/actions/workflows/deploy.yml/badge.svg)](https://github.com/deepcanoom/GhapherOS/actions/workflows/deploy.yml)

Demo: https://deepcanoom.github.io/GhapherOS/ · Licencia: uso limitado, ver [LICENSE](LICENSE) · © Valenxe Dynamics

Centro de comando 3D para explicar arquitecturas y procesos a audiencias ejecutivas. Este repositorio es un **molde (template)**: se crea un repositorio nuevo a partir de él, se edita el JSON del proyecto desde la propia aplicación y se publica en GitHub Pages.

## Qué incluye

- **Visor 3D** (Three.js r128): niveles de elevación, equipos, flujos de datos animados, escenarios con KPIs, métricas y tarjetas explicativas.
- **Modo presentación**, **ajuste de nodos** (arrastre en el plano) y **guardado de posiciones**.
- **Editor del proyecto**: edita el JSON, aplícalo para ver la escena actualizada y exporta el archivo.
- **Lista de archivos de referencia**: registra diagramas e informes del proyecto (ver limitaciones).
- **Datos de ejemplo genéricos** en `data/example.json`. No contienen datos de clientes.

## Estructura

- `packages/core/`: visor 3D (`@ghapheros/core`). Escena, escenarios, métricas, editor del proyecto y bus de eventos.
- `packages/extensions/`: extensiones opcionales (`@ghapheros/extensions`) que se enganchan al bus sin tocar el núcleo.
- `data/example.json`: proyecto de ejemplo con datos ficticios.
- `schemas/`: esquema del proyecto y plantilla de entrada.
- `docs/`: diseño del servicio.
- `.github/workflows/deploy.yml`: valida y publica en GitHub Pages en cada push a `main`.

## Documentación

- [Diseño del servicio](docs/DISENO-SERVICIO.md): entrada mínima, extracción de materiales y capa de control.
- [Esquema del proyecto](schemas/project.schema.json) y [plantilla de entrada](schemas/intake.example.json).

## Cómo usarlo

1. En GitHub, pulsa **Use this template** y crea tu repositorio.
2. Activa GitHub Pages: *Settings → Pages → Source: GitHub Actions*.
3. Haz push a `main`. El workflow `.github/workflows/deploy.yml` valida y publica el sitio.
4. Abre el sitio, pulsa **EDITOR DEL PROYECTO**, reemplaza el contenido por el de tu proyecto y pulsa **APLICAR**.
5. Para conservar los cambios, pulsa **EXPORTAR JSON** y guárdalo en `data/` (reemplazando `example.json`) y haz commit.

Los cambios hechos en el editor se guardan en el navegador de quien los hace. Para que sean el estado oficial del repositorio, expórtalos y haz commit.

## Formato del proyecto (`data/example.json`)

| Clave | Qué describe |
|---|---|
| `project` | Nombre, cliente, clasificación y descripción (aparecen en la cabecera). |
| `levels` | Niveles de elevación: `id`, `y` (altura) y `name` (rótulo). |
| `nodes` | Equipos: `id`, `level`, `x`, `z`, tamaño (`w`, `h`, `d`), `label`, `sub` por escenario y `card` (qué es, qué pasa hoy, cómo mejora). |
| `flows` | Flujos: `path` (lista de ids de nodos), `color` (`amber`, `red`, `green`, `cyan`, `slate`), `count`, `speed`, `pingpong` (ida y vuelta), `dim` y `scenes`. |
| `scenarios` | Escenarios: `id`, `label`, `tag`, `brief`, `color`, `cam`, `states` por nodo (`normal`, `amber`, `red`, `green`, `retired`, `hidden`) y hasta 4 `kpis`. |
| `metrics` | Barras comparativas: `title`, `scale` y `rows` (cada fila se resalta en el escenario indicado en `scene`). |
| `attachments` | Lista de archivos de referencia del proyecto. |

## Limitaciones de esta versión

- **No interpreta archivos automáticamente.** Los diagramas (.vsdx, .png) y los informes (.pdf, .docx) se registran en el proyecto, pero el modelo de la escena se escribe a mano en el JSON. Interpretar archivos es la siguiente fase.
- **Sin autenticación ni multiusuario.** Es un sitio estático. Si el contenido es confidencial, publícalo en un repositorio privado y con un proveedor de Pages que restrinja el acceso.
- Requiere conexión para cargar Three.js desde `cdn.jsdelivr.net`.

## Desarrollo local

Abre `index.html` con un servidor estático (por ejemplo `python -m http.server`). Abrirlo directamente desde el disco no carga `data/example.json` en todos los navegadores.
