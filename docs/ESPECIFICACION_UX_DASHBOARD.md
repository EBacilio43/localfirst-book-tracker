# Especificación de UX y Arquitectura: Dashboard Principal (Centro de Mando de Lectura)

## 1. Visión General y Objetivo de Producto
BaciBooks evoluciona de un inventario pasivo a un **compañero activo de lectura diaria**. El **Dashboard Principal (Inicio)** se convierte en el punto de entrada neurálgico de la aplicación, optimizado para que el lector ejecute sus acciones cotidianas en un solo toque con el pulgar.

---

## 2. Anatomía de la Pantalla Principal (Dashboard)

### A. Encabezado Cálido y Accesos Rápidos
* **Saludo contextual:** *«Buenos días / Buenas tardes / Buenas noches, [Nombre o Lector]»*.
* **Título de pantalla:** *«Mi Espacio de Lectura»*.
* **Iconos superiores:**
  * **Respaldo en la nube (Cloud):** Botón circular de 38x38 px con indicador si hay libros pendientes de sincronización.
  * **¿Qué leo hoy? (Compass):** Acceso directo a la ruleta para sugerencias instantáneas.

### B. Tarjeta Hero: «Continuar Leyendo» (Lectura en Curso)
* **Objetivo:** Resolver el caso de uso #1: *"Voy a leer ahora mismo"*.
* **Contenido:**
  * Etiqueta superior suave: *«Leyendo ahora mismo»*.
  * Miniatura de la portada real (proporción 2:3, bordes redondeados y sombra sutil).
  * Título del libro (tipografía serif elegante) y autor con sello editorial.
  * Progreso visible: `Pág. 184 de 471 · 39%`.
  * Barra de progreso con color acento terracota.
  * **Botón principal SafeButton de 1 toque:** **`Continuar Leyendo`** (con icono de cronómetro) que abre el cronómetro de lectura de inmediato sin navegar por menús intermedios.

### C. Cuadrícula de Acciones Rápidas (4 Atajos Táctiles)
Diseñada en cuadrícula 2x2 para alcance ergonómico con una sola mano:
1. **Avanzar Páginas:** Modal para registrar avance manual de páginas leídas hoy o ayer sin necesidad de haber usado el cronómetro.
2. **Capturar Frase:** Acceso directo a la cámara para fotografiar una página de libro y extraer texto mediante OCR on-device.
3. **Escanear Libro:** Acceso directo a la cámara para lectura de códigos de barras ISBN (individual o ráfaga).
4. **¿Qué leo hoy?:** Selector aleatorio basado en el estado de ánimo, tiempo disponible o formato.

### D. Widget de Pulso y Racha
* Círculo con conteo de racha de días consecutivos (`6d`).
* Tiempo leído hoy respecto a la meta diaria (`22 de 30 min leídos hoy`).
* Botón *«Ver Metas»* que enlaza a la pestaña de estadísticas y pronósticos.

### E. Alerta Condicional de Préstamos
* Solo se renderiza si existen libros prestados con fecha próxima de devolución.
* Ejemplo: *«Prestaste «El principito» a Sofía · Vence en 3 días»*.

### F. En Mi Mesita de Noche (Lecturas Recientes)
* Carrusel horizontal con los últimos 3 o 4 libros leídos, en espera o por leer.
* Enlace directo destacado: **«Ver todo mi librero (42 ejemplares) →»**.

---

## 3. Estado Despejado (Sin Lectura Activa)
Cuando el usuario no tiene ningún libro en estado `LEYENDO`:
* La tarjeta Hero se transforma en una invitación cálida:
  * Ilustración minimalista de libro abierto.
  * *«Tu mesita de noche está lista»*.
  * *«No tienes ninguna lectura en curso en este momento. Puedes dejarte sorprender por el selector o buscar en tu estantería.»*.
  * Botón primario: **«Elegir con ¿Qué leo hoy?»**.
* Muestra la lista de libros **Por Leer** (`POR_LEER`) como siguientes en la fila con portadas y páginas estimadas.

---

## 4. Modal de Registro Rápido («Avanzar Páginas / Ayer»)
* Despliegue en *Bottom Sheet* nativo.
* Selección de libro activo (con opción de cambiar a otro libro en lectura).
* Selector de fecha en píldoras: `Hoy` o `Ayer`.
* Ajustador rápido de página alcanzada con botones `-5`, `-1`, `+1`, `+5` y cálculo dinámico de páginas avanzadas (`+31 págs`).
* Botón SafeButton: **«Guardar en mi biblioteca»**.

---

## 5. Reorganización de la Navegación (5 Pestañas con Escanear al Centro)
1. **Inicio (Dashboard):** Centro de mando diario, lectura activa con acceso al cronómetro en 1 toque, atajos y racha.
2. **Mi Librero:** Cuadrícula completa de libros, sagas, libreros/repisas físicas y lista de deseos.
3. **Escanear (Botón Central Destacado):** Acceso instantáneo a la cámara para lectura de códigos de barras EAN-13/ISBN en modo individual o ráfaga.
4. **Buscar:** Búsqueda rápida offline y detective literario con inteligencia artificial.
5. **Metas y Stats:** Ritmo de lectura, predicciones matemáticas y resumen de lecturas.

