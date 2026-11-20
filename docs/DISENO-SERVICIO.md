# GhapherOS · Diseño del servicio

Este documento define cómo usa una persona el servicio: qué entrega, qué extrae el sistema, qué puede editar después y cómo se conserva el resultado. Es la base para construir el servicio; no describe código todavía.

## 1. Idea central

El usuario no dibuja escenas. Entrega **materiales que ya existen** (diagrama de red, informes, un brief corto). El sistema extrae de ellos un **proyecto** (un JSON con la forma definida en `schemas/project.schema.json`) y lo renderiza como centro de comando 3D. Luego el usuario corrige y completa en una **capa de control**.

Tres capas, cada una con una responsabilidad:

| Capa | Quién la usa | Qué hace |
|---|---|---|
| **Entrada** | Quien prepara la presentación | Entrega archivos y un brief de pocas líneas. |
| **Extracción y modelo** | El sistema | Convierte los materiales en un proyecto, con la fuente de cada dato. |
| **Control** | Quien presenta o mantiene el proyecto | Edita nodos, flujos, escenarios, métricas, condiciones y módulos. Valida y versiona. |

El molde de GitHub (`index.html` + `data/`) es la implementación mínima de la capa de visualización y del editor JSON. Este diseño define lo que va antes (entrada y extracción) y lo que va alrededor (control).

## 2. Qué entrega el usuario

### 2.1 Entrada mínima obligatoria

Son tres cosas. Si falta una, el servicio no genera proyecto.

1. **Un brief** (`intake.json`, máximo una página). Responde cuatro preguntas:
   - ¿Quién es la audiencia y qué decisión necesita tomar?
   - ¿Qué problema se quiere explicar, en una frase?
   - ¿Qué escenarios quieres mostrar? (nombre y una línea cada uno)
   - ¿Qué clasificación tiene el material?
2. **Al menos un diagrama de red o de procesos** (`.vsdx`, `.png`, `.pdf` o `.drawio`).
3. **Al menos un informe** (`.pdf` o `.docx`): técnico, ejecutivo o ambos.

### 2.2 Entrada opcional (mejora la calidad)

- Hojas de datos de equipos o cuestionario firmado.
- Cifras medidas (CSV). Si no hay, las cifras se extraen de los informes.
- Un logo o paleta, si se usa en presentaciones formales.
- Una lista de equipos que no deben aparecer.

### 2.3 Lo que el usuario **no** tiene que hacer

No escribe coordenadas, no define niveles ni colores, no programa flujos. Eso lo propone el sistema y el usuario lo ajusta en la capa de control.

## 3. Extracción: de materiales a proyecto

La extracción corre en tres pasos. Cada dato del proyecto guarda su **origen** (archivo y página o hoja) y su **nivel de respaldo**. Usamos los mismos niveles de la auditoría para no inventar una escala nueva:

| Nivel | Significado | Cómo se muestra en la escena |
|---|---|---|
| `confirmado` | Verificado en sitio o en un documento firmado | Sin marca |
| `reportado` | Dato del cliente, sin verificar | Marca "reportado" en la tarjeta |
| `analisis` | Conclusión técnica derivada de otros datos | Marca "análisis" |
| `hipotesis` | Por medir | Marca "meta" o "hipótesis" en la métrica |

### 3.1 Paso A · Diagrama → estructura

- Cada hoja del diagrama o cada capa se convierte en un **nivel** (`levels`), o el usuario agrupa hojas en niveles.
- Cada caja con nombre se convierte en un **nodo** (`nodes`). El texto de la caja da `label`. Si la caja tiene modelo o capacidad (por ejemplo "1 Gbps" o "fin de vida"), va a `sub`.
- Cada conector se convierte en un **flujo** (`flows`) entre dos nodos. Un conector sin etiqueta queda como flujo de datos por defecto.
- Las posiciones iniciales salen del diagrama, escaladas. El usuario las ajusta después.

Lo que el diagrama **no** dice (capacidad real, qué pasa hoy, cómo mejora) no se inventa. Queda como campo vacío marcado `pendiente`.

### 3.2 Paso B · Informes → contenido

Del informe técnico y del ejecutivo se extraen cuatro tipos de datos:

- **Problemas actuales** → `card.hoy` de cada nodo implicado.
- **Propuesta** → `card.mejora` y los `scenarios` que la representan.
- **Cifras** → `metrics` y `kpis`. Cada cifra conserva el texto original y la página. Ejemplo ficticio: "500 GB en más de 5 horas" → valor 240 Mbps, fuente página 9, nivel `confirmado`.
- **Hallazgos con severidad** → se usan para decidir qué nodos resaltar (`states` en rojo).

### 3.3 Paso C · Brief → escenarios y narrativa

El brief define los `scenarios`. Si el brief pide tres escenarios, se crean tres. Para cada uno, el sistema propone:

- `brief` (texto de dos o tres líneas, en el lenguaje de la audiencia)
- `states` por nodo (qué se resalta)
- `flows` visibles en ese escenario
- `kpis` (hasta cuatro)
- `cam` (encuadre según los nodos que se resaltan)

El usuario revisa estos textos antes de presentar. El sistema marca cada texto propuesto como **borrador** hasta que alguien lo apruebe.

### 3.4 Salida

Un `project.json` válido contra el esquema, más un reporte de extracción:

- Qué se extrajo y de qué fuente.
- Qué quedó `pendiente` (datos que no aparecen en los materiales).
- Contradicciones entre fuentes (por ejemplo, dos cifras distintas para el mismo enlace).

El reporte es lo primero que ve el usuario. Lo que no se pudo extraer se pregunta, no se completa con supuestos.

## 4. Capa de control

Es lo que el usuario usa después de la extracción. Toda acción sobre el proyecto pasa por esta capa. Ninguna edición toca el JSON directamente sin validación.

### 4.1 Objetos que se pueden editar

| Objeto | Acciones |
|---|---|
| Nivel | Crear, renombrar, mover de altura, eliminar |
| Nodo | Crear, editar texto y tamaño, mover, asignar nivel, duplicar, eliminar |
| Flujo | Crear entre dos nodos, cambiar color, velocidad, ida y vuelta, visibilidad por escenario |
| Escenario | Crear, reordenar, editar brief, estados, KPIs y encuadre |
| Métrica | Crear, editar filas, asignar escenario resaltado |
| Tarjeta | Editar qué es, qué pasa hoy, cómo mejora, y su nivel de respaldo |
| Fuente | Adjuntar archivo, página y nivel a cualquier dato |

### 4.2 Condiciones

Una condición decide cuándo algo aparece o cambia. Se expresa en la capa de control como reglas simples, no como código:

- **Visibilidad:** "mostrar el flujo de respaldo solo en el escenario 3".
- **Estado por umbral:** "pintar el nodo en rojo si su capacidad es menor que el 50 % del flujo que pasa por él".
- **Reglas de presentación:** "no mostrar cifras con nivel `hipotesis` en el escenario 1".

Las condiciones se guardan en el proyecto como una lista `rules` (ver esquema). El visor las evalúa al cargar. La primera versión solo soporta comparaciones simples sobre campos numéricos y listas de escenarios.

### 4.3 Módulos

Un módulo es un grupo reutilizable de nodos y flujos con nombre propio. Ejemplos: "Frontera VPN", "Piso de ingesta", "Nube". Sirve para:

- Insertar en otro proyecto el mismo bloque sin volver a dibujarlo.
- Cambiar un módulo completo (por ejemplo, sustituir el firewall) en un solo lugar.

Versión 1: los módulos son solo agrupaciones con un identificador (`group`). Versión 2: biblioteca compartida entre proyectos de la organización.

### 4.4 Validación

Antes de guardar, la capa de control rechaza:

- Flujos que apuntan a nodos que no existen.
- Nodos sin nivel válido.
- Escenarios sin `id` o con `id` repetido.
- Cifras sin fuente cuando su nivel no es `hipotesis`.
- Escenarios que resaltan un nodo eliminado.

Las advertencias (no bloquean) incluyen: textos `borrador` sin aprobar, nodos sin tarjeta y métricas sin escenario.

### 4.5 Historial

Cada guardado crea una versión con fecha, autor y resumen de cambios ("agregué nodo Firewall B; ajusté la métrica de la fase 1 a 650 Mbps"). Se puede volver a una versión anterior. En la versión 1 el historial vive en Git: cada versión es un commit del archivo `data/proyecto.json`.

## 5. Flujo completo de un usuario

1. **Crea un proyecto** desde la plantilla (repo nuevo con *Use this template*).
2. **Llena `intake.json`** con el brief de cuatro preguntas.
3. **Sube los materiales** a `materiales/` (diagrama, informes).
4. **Ejecuta la extracción.** Recibe el borrador de `data/proyecto.json` y el reporte de extracción.
5. **Revisa el reporte**: contesta lo pendiente y marca los textos como aprobados.
6. **Abre la capa de control** en el sitio, ajusta nodos, flujos, escenarios, condiciones y módulos.
7. **Exporta o guarda.** El cambio queda como commit en el repo y el sitio se actualiza con Pages.
8. **Presenta** en modo presentación. Las marcas de respaldo se muestran en las tarjetas.

## 6. Fuera de alcance de la versión 1

- Lectura automática de .vsdx o PDF escaneados sin revisión humana. La extracción propone; una persona aprueba.
- Multiusuario en tiempo real y permisos por rol.
- Autenticación. El repo privado y el control de acceso del hosting cubren esto por ahora.
- Integración con datos en vivo (telemetría, Zabbix, cloud). Se puede agregar más adelante con un conector.

## 7. Riesgos de diseño

- **Extracción incorrecta de cifras.** Mitigación: cada cifra lleva página y nivel de respaldo; el reporte lista contradicciones.
- **Demasiada libertad en la capa de control.** Mitigación: validación obligatoria antes de guardar.
- **Datos sensibles en el repo.** Mitigación: el repo es privado por defecto; la plantilla no incluye datos reales; los materiales de clientes con clasificación restringida no se suben a repos públicos.
- **Que el visor se vea distinto según el navegador.** Mitigación: pruebas de regresión con capturas en el repo.

## 8. Próximos pasos sugeridos

1. Aprobar este diseño y el esquema de `schemas/project.schema.json`.
2. Implementar la capa de control en el editor (validación y reglas simples) sobre el molde actual.
3. Implementar la extracción de diagrama (.drawio y .vsdx) como primer conector, porque su estructura es explícita.
4. Agregar extracción de informes con revisión humana obligatoria.
