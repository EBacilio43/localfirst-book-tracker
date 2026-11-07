# AGENTS.md — Guía de Ingeniería y Reglas del Proyecto BaciBooks

Este documento define el stack tecnológico oficial, la arquitectura, los estándares de código, las reglas de UX/resiliencia, la estrategia de pruebas y el flujo de Git que todo agente de IA y desarrollador debe cumplir al trabajar en **BaciBooks**.

---

## 1. Contexto y Objetivos del Proyecto

**BaciBooks** es una aplicación móvil multiplataforma (**React Native + Expo + TypeScript**) para el registro y gestión integral de bibliotecas personales (**tanto de libros físicos como digitales / eBooks**).
El proyecto tiene tres metas estratégicas simultáneas:
1. **Piloto Personal de Uso Diario:** Debe ser ultrarrápida, *Offline-First* y resolver con precisión el registro por **ISBN + Editorial exacta + Portada real** (físicos y digitales), estados de lectura, **metas mensuales/anuales**, **estadísticas y predicciones de lectura**, préstamos, cronómetro, OCR de citas y **Búsqueda Inteligente por recuerdos/trama**.
2. **Portafolio Profesional en GitHub:** El código, historial de commits, documentación, pruebas automatizadas y arquitectura deben reflejar estándares de ingeniería de software de nivel Senior.
3. **Publicación en Tiendas (Google Play Store primero, luego Apple App Store):** Toda decisión técnica, permiso nativo y manejo de datos debe cumplir desde el día 1 con las políticas de revisión de Google Play y App Store (EAS Build / EAS Submit).

---

## 2. Stack Tecnológico Oficial (Definición Estricta)

Ningún agente o desarrollador debe introducir librerías alternativas sin justificación arquitectónica previa. Este es el stack oficial de **BaciBooks**:

| Categoría | Tecnología / Paquete Oficial | Propósito en BaciBooks |
| :--- | :--- | :--- |
| **Framework & Lenguaje** | `Expo SDK 52+` + `React Native` + `TypeScript 5.x` (`strict: true`) | Base multiplataforma Android/iOS con Nueva Arquitectura y tipado estricto. |
| **Navegación** | `expo-router` (v4 con `typedRoutes: true`) | Enrutamiento basado en archivos dentro de `app/` y deep linking tipado. |
| **Estilos y UI** | `NativeWind v4` (Tailwind CSS) + `lucide-react-native` | Sistema de diseño consistente, soporte de temas y componentes limpios. |
| **Animaciones y Gestos** | `react-native-reanimated` + `react-native-gesture-handler` + `expo-haptics` | Transiciones fluidas a 60/120 fps, carruseles, ruleta TBR y vibración háptica. |
| **Listas e Imágenes** | `@shopify/flash-list` + `expo-image` | Renderizado virtualizado de estanterías grandes y caché en disco de portadas. |
| **BD Local (ORM)** | `expo-sqlite` + `drizzle-orm` + `drizzle-kit` (+ `SQLite FTS5`) | Persistencia *Local-First* tipada, migraciones SQL automáticas y búsqueda de texto completo offline. |
| **Estado en Memoria** | `zustand` + `expo-secure-store` | Estado efímero de UI (cola del escáner en ráfaga, cronómetro activo) y almacenamiento seguro de tokens. |
| **Validación de Datos** | `zod` | Validación en tiempo de ejecución de todas las respuestas de APIs externas y esquemas de IA. |
| **Cámara y Portadas** | `expo-camera` + `expo-image-manipulator` + `expo-file-system` | Lectura EAN-13/ISBN a 60 fps y compresión de portadas fotografiadas a formato `WebP` (`~60-80 KB`). |
| **OCR On-Device** | `@react-native-ml-kit/text-recognition` | Extracción de texto de páginas físicas para citas (100% en el dispositivo, offline y costo `$0 USD`). |
| **IA & Búsqueda** | `@google/genai` (**Gemini 2.5 Flash**) + `Google Books API` + `Open Library API` | Detective literario por trama/frases con JSON estructurado y cascada de metadatos/portadas. |
| **Utilidades Nativas** | `expo-notifications` + `react-native-view-shot` + `expo-sharing` | Recordatorios locales de préstamos físicos y generación de postales compartibles (Citas / Wrapped). |
| **Nube Híbrida (`$0`)** | `Google Drive API v3 (appDataFolder)` + `@supabase/supabase-js` | Backup privado en el Google Drive del usuario + Catálogo Comunitario Global de ISBNs en Supabase Free. |
| **Testing & QA** | `jest` + `jest-expo` + `@testing-library/react-native` + `eslint` | Pruebas unitarias de dominio, pruebas de contratos de API con mocks y análisis estático en GitHub Actions. |
| **Despliegue / Tiendas** | `EAS Build` + `EAS Submit` (`eas.json`) | Generación de `.apk` (piloto), `.aab` (Google Play Store) e `.ipa` (Apple App Store). |

### ¿Por qué usamos `Drizzle ORM + expo-sqlite` en lugar de `Prisma`?
En proyectos backend con Node.js/TypeScript, **Prisma** es excelente; sin embargo, en aplicaciones móviles **React Native / Expo (Local-First)** donde la base de datos corre dentro del teléfono del usuario:
- **Prisma** requiere un motor binario pesado en Rust (*Query Engine*) y su adaptación experimental para React Native tiene limitaciones fuertes con Expo SDK 52+ y aumenta el tamaño del `.apk`/`.ipa`.
- **Drizzle ORM + `expo-sqlite`** es el estándar recomendado por Expo: es **100% TypeScript con 0 binarios extra**, ofrece la misma experiencia que Prisma (`schema.ts` tipado, relaciones, *Drizzle Studio* visual y migraciones automáticas con `useMigrations()`), soporta **consultas reactivas en vivo (`useLiveQuery`)** y habilita **SQLite FTS5** nativo para la búsqueda inteligente offline.

---

## 3. Arquitectura de Directorios (*Feature-Sliced Design*)

```text
BaciBooks/
├── app/                      # Rutas de Expo Router (SOLO pantallas y layouts, sin lógica pesada)
│   ├── (tabs)/               # Navegación principal (Biblioteca, Escáner/Registro, Búsqueda IA, Metas/Stats)
│   ├── book/[id].tsx         # Detalle del libro (físico o digital), sesiones, citas y préstamos
│   └── _layout.tsx           # Providers globales y ejecución de migraciones SQLite
├── src/
│   ├── core/                 # Configuración transversal (tema, constantes, cliente HTTP, errores)
│   ├── db/                   # Capa de persistencia Local-First (expo-sqlite + Drizzle ORM)
│   │   ├── schema/           # Definición de tablas (books, goals, sessions, quotes, loans) e índices FTS5
│   │   ├── migrations/       # Migraciones SQL autogeneradas por Drizzle Kit
│   │   └── repositories/     # Acceso a datos transaccional e idempotente
│   ├── features/             # Módulos de negocio independientes
│   │   ├── catalog/          # Resolución ISBN/Edición (Cascada: Catálogo Global, Google Books, OpenLibrary)
│   │   ├── scanner/          # Cámara EAN-13, Modo Ráfaga con cooldown y recorte de portadas (WebP)
│   │   ├── smart-search/     # Búsqueda inteligente por trama/frases/recuerdos (Gemini + FTS5)
│   │   ├── reading-tracker/  # Estados de lectura (páginas o %), cronómetro y rachas
│   │   ├── goals-analytics/  # Metas (mensual/anual), estadísticas profundas y motor de predicciones
│   │   ├── loans/            # Control de préstamos físicos y notificaciones locales
│   │   ├── quotes-ocr/       # Escáner OCR on-device (ML Kit) y postales compartibles
│   │   ├── shelves/          # Ubicación física (librero/repisa), colecciones digitales, Wishlist y Ruleta TBR
│   │   └── cloud-sync/       # Sincronización híbrida (Google Drive appDataFolder + Supabase)
│   └── shared/               # Componentes UI reutilizables (SafeButton anti-doble toque, etc.), hooks y utils
├── assets/                   # Iconos, fuentes y splash screens optimizados para tiendas
└── tests/                    # Pruebas unitarias y de contratos de API (Jest + RN Testing Library)
    ├── unit/                 # Pruebas de dominio (predicciones, conversión ISBN, repositorios)
    └── api/                  # Pruebas de integración/mocks de APIs (Google Books, OpenLibrary, Gemini)
```

### Reglas Arquitectónicas Estrictas
- **Diseño de Pantallas por Fase (Figma / Mobbin + Artifact + Revisión con GPT):**
  1. Las pantallas se diseñan **únicamente cuando inicia su Fase correspondiente** (nunca todas las fases juntas de golpe), priorizando interfaces limpias, visuales, centradas en las portadas y sin saturación de texto.
  2. Al iniciar cada Fase, nos apoyamos en los conectores **Figma** / **Mobbin** y presentamos solo las pantallas de esa Fase para validación.
  3. **Revisión Cruzada de UX/UI con GPT (*Multi-Model Design Critique*):** El usuario cambiará el modelo directamente en el chat a un modelo de la familia **GPT** para auditar el diseño de las pantallas de la fase en curso (*Ergonomía del pulgar, Jerarquía visual, Estados vacíos/carga, Accesibilidad y Micro-interacciones*).
  4. Solo tras integrar las mejoras de ambos modelos y contar con el visto bueno del usuario se pasa a codificar las pantallas de esa Fase en `app/` y `src/features/`.
- **Separación UI / Lógica:** Los archivos dentro de `app/` solo orquestan navegación y layout. Toda la lógica de negocio vive en `src/features/<feature>/`.
- **Principio Local-First:** La interfaz de usuario **siempre** lee y escribe primero en la base de datos local (`SQLite`). Ninguna acción del usuario en su biblioteca debe bloquearse esperando red.

---

## 4. Reglas de Resiliencia UX, Anti-Doble Toque e Idempotencia

Para evitar registros duplicados, condiciones de carrera o llamadas dobles a las APIs:

1. **Protección Obligatoria Anti-Doble Toque (`SafeButton` / `useSafePress`):**
   - **Ningún botón** que dispare una escritura en base de datos, navegación o petición de red puede usar un `onPress` crudo sin protección.
   - Todo botón de acción debe utilizar el componente estándar `SafeButton` (o el hook `useSafePress`) que:
     - Bloquea instantáneamente nuevos toques mediante referencia síncrona (`isLockedRef.current = true`) desde el primer milisegundo (sin esperar al re-render de React).
     - Muestra estado visual de carga (`isSubmitting`) y aplica un *cooldown/debounce* mínimo de `500ms` tras finalizar la acción.
2. **Skeletons Obligatorios en Pantallas de Carga (`Skeleton` / `Shimmer`):**
   - Queda prohibido mostrar pantallas en blanco o depender únicamente de un `ActivityIndicator` genérico durante la carga inicial de pantallas, cuadrículas de portadas, estanterías, listas de búsqueda o fichas de detalle.
   - Todas las pantallas deben utilizar componentes `Skeleton` con animación de pulso suave (`src/shared/components/Skeleton.tsx`) que respeten la geometría exacta del contenido final (proporción `2:3` de portadas, píldoras de estado y bloques de metadatos) para eliminar saltos bruscos de interfaz (*CLS / Layout Shift*).
3. **Deduplicación en el Escáner de Cámara (Modo Individual y Ráfaga):**
   - La cámara lee códigos de barras a 30-60 fps. El módulo `scanner` debe mantener un `Map<string, number>` de códigos recién leídos con una ventana de enfriamiento (*cooldown*) de **`3,000 ms` por ISBN** y verificar contra SQLite antes de agregar un libro a la cola o consultar las APIs.
4. **Idempotencia en Base de Datos (SQLite) y Reglas Técnicas Críticas:**
   - Las operaciones de creación críticas (guardar libro, registrar sesión de cronómetro, crear meta mensual/anual) deben ejecutarse dentro de transacciones y permitir múltiples ediciones de un mismo ISBN solo tras confirmación explícita del usuario.
   - **Agrupación por Sagas (`series_name` + `series_index`):** La biblioteca soporta agrupar libros por saga en orden numérico (`#1`, `#1.5`, `#2`) mostrando el progreso de la saga, y la Ruleta TBR jamás debe sugerir un tomo posterior si existe un tomo previo sin leer.
   - **Cronómetro por Timestamps y Rachas en Zona Horaria Local:** El cronómetro debe persistir `started_at_epoch_ms` (nunca depender de `setInterval` en memoria al apagar la pantalla), y cada sesión debe registrar `local_date ('YYYY-MM-DD')` en el huso horario local del dispositivo.
   - **Portadas 100% Local-First (`.webp`) y Seguridad de API Keys:** Toda portada confirmada (sea de API o cámara) se descarga y comprime localmente en `.webp` (`~50-80 KB`). En producción, las llamadas a Gemini API se realizan a través de una **Supabase Edge Function** para nunca exponer llaves privadas en el binario móvil.
   - **Validación Bookland (`978`/`979`) en Escáner:** El escáner debe validar el dígito verificador ISBN e ignorar códigos internos de librerías (`200...`) o suplementos `EAN-5`, mostrando un aviso guía si detecta etiquetas de tienda.
   - **Fusión Campo por Campo (*Field-Level Merge*) y Limpieza de Metadatos:** Combinar campos entre Google Books y Open Library (ej. sinopsis de uno + `pageCount` del otro), normalizar nombres y títulos en mayúsculas, y exigir `page_count > 0` para evitar divisiones por cero (`NaN`).
   - **Búsqueda FTS5 sin Acentos (`remove_diacritics 2`):** Configurar SQLite FTS5 con `tokenize = 'unicode61 remove_diacritics 2'` para que búsquedas sin tilde en español funcionen siempre.
   - **Arranque en Frío (*Cold Start*) y Filtro de *Outliers* en Predicciones:** Usar base inicial (`25 págs/h`, `20 págs/día`) cuando el usuario tiene `0` sesiones, y alertar ante sesiones atípicas (`< 3 págs/h` o `> 180 págs/h`) por olvido del cronómetro.
   - **Patrón Adapter (`Expo Go` vs `Dev Build`) y `schemaVersion` en Backups:** Encapsular módulos nativos de fases avanzadas con *fallbacks* para no romper `Expo Go`, e incluir `schemaVersion` con migradores `Zod` en todo archivo de backup.
   - **Cola Offline del Escáner (`PENDING_OFFLINE_SYNC`):** Si se escanea un ISBN sin conexión, guardar inmediatamente el ISBN y ubicación en SQLite para resolver sus metadatos en segundo plano al recuperar red.
   - **Glosario de Personajes (`CHARACTER`), Spoilers (`is_spoiler`) y Préstamos Bidireccionales (`LENT_OUT` / `BORROWED_IN`):** Soportar notas de personajes sin spoilers, desenfoque de notas sensibles y distinción entre libros propios prestados y libros que le prestaron al usuario (`ownership = 'BORROWED'`).
   - **Registro Retroactivo ("Ayer"), Relecturas y Limpieza Post-OCR:** Permitir registrar sesiones con fecha del día anterior, mantener el conteo de libros leídos cuando un libro terminado vuelve a estado `LEYENDO` por relectura (`read_count >= 1`), y eliminar guiones de corte de línea (`/\-\s*\r?\n\s*/g`) en textos extraídos por OCR.
   - **Integridad de Backups (JSON GZIP Snapshot), Limpieza de `.webp` Huérfanos y Moderación de Catálogo:** Exportar backups desde transacciones consistentes (nunca copiar el binario `.db` con `WAL` abierto), borrar archivos `.webp` antiguos al cambiar/eliminar portadas, normalizar orientación `EXIF`, refrescar tokens OAuth silenciosamente y proteger el catálogo global en Supabase contra vandalismo mediante consenso (`isbn_contributions`).

---

## 5. Estándares de TypeScript y Pruebas Automatizadas (Unitarias y API)

1. **TypeScript Estricto (`strict: true`):**
   - **Prohibido el uso de `any`**. Usa tipos explícitos, genéricos o `unknown` con *type guards*.
   - Todas las respuestas de APIs externas (Google Books, Open Library, Gemini API, Supabase) **deben validarse en tiempo de ejecución con esquemas de `Zod`**.
2. **Pruebas Unitarias (`tests/unit/` con Jest):**
   - Todo módulo de negocio debe incluir pruebas unitarias que cubran casos normales y casos borde (*edge cases*):
     - Conversión y validación de checksum de `ISBN-10` a `ISBN-13`.
     - Fórmulas del **Motor de Predicciones**: cálculo de `páginas/hora`, media móvil de `páginas/día`, fecha estimada de finalización (incluso cuando el usuario lleva 0 sesiones o lee por `%` en eBook) y cálculo de ritmo para metas mensuales/anuales.
     - Operaciones CRUD e idempotencia ante doble ejecución en los repositorios.
3. **Pruebas de Integración y Contratos de API (`tests/api/`):**
   - Todos los clientes HTTP (`GoogleBooksClient`, `OpenLibraryClient`, `GeminiSmartSearchClient`) deben tener pruebas automatizadas usando *fixtures/mocks* realistas que verifiquen:
     - Parseo correcto con `Zod` ante respuestas exitosas.
     - Comportamiento del **fallback en cascada** cuando una API devuelve datos incompletos (ej. libro sin portada en Google Books que se recupera desde Open Library).
     - Manejo limpio de errores HTTP (`429 Rate Limit`, `500 Server Error`, corte de internet / *timeout*) devolviendo errores tipados sin romper la app.

---

## 6. Flujo de Trabajo en Git, Fases y Estándares para Portafolio GitHub

### Estrategia de Ramas (Git Flow Ligero por Fases)
- `main`: Rama de producción estable. Solo recibe merges al completar cada Fase, etiquetada con **SemVer** (`v0.1.0` Fase 1, `v0.2.0` Fase 2, etc.).
- `develop`: Rama principal de integración donde se unen las ramas de funcionalidades terminadas y probadas.
- **Ramas de trabajo (creadas desde `develop`):**
  - `feat/<modulo>-<descripcion-corta>` (ej. `feat/escaner-modo-rafaga`, `feat/metas-motor-predicciones`).
  - `fix/<modulo>-<descripcion-corta>` (ej. `fix/ui-bloqueo-doble-toque`).
  - `test/<modulo>-<descripcion>` (ej. `test/api-cascada-isbn`).
  - `docs/<descripcion>` y `chore/<descripcion>`.

### Regla de Commits (Conventional Commits en Español)
Por definición del proyecto, todos los mensajes de commit se redactarán **en español**, siguiendo el formato **Conventional Commits**:
- Formato: `<tipo>(<alcance>): <resumen corto en infinitivo o imperativo sin punto final>`
- Ejemplos:
  - `feat(escaner): implementar lectura EAN-13 en modo rafaga con bloqueo de duplicados`
  - `feat(metas): agregar motor de predicciones y metas mensuales/anuales`
  - `test(catalogo): agregar pruebas de contrato y fallback para Google Books y OpenLibrary`
  - `fix(ui): prevenir doble toque en botones de guardado con useSafePress`

### Seguridad en GitHub
- **NUNCA** subir archivos `.env`, llaves privadas (`.jks`, `.p8`) ni credenciales al repositorio. Mantener `.env.example` documentado.

---

## 7. Regla Estricta: Prohibición Total de Emojis

Queda estrictamente prohibido el uso de emojis en cualquier parte del proyecto BaciBooks, sin excepciones:
1. **En el Código Fuente y UI:** Prohibido usar emojis en textos visibles de la interfaz, botones, toasts, alertas, logs de consola, comentarios de código o nombres de variables. La iconografía de la aplicación se gestiona exclusivamente mediante iconos vectoriales de la librería oficial (`lucide-react-native`).
2. **En la Comunicación y Respuestas:** El asistente y los desarrolladores jamás deben incluir emojis en los mensajes del chat, explicaciones técnicas, resúmenes de estado ni revisiones de código.
3. **En Commits y Control de Versiones:** Prohibido incluir emojis en los títulos o descripciones de los commits de Git (`git commit`) y en las etiquetas de versión (`git tag`).
4. **En Documentación:** Prohibido utilizar emojis en archivos Markdown (`README.md`, `PLAN_MAESTRO_BACIBOOKS.md`, especificaciones, etc.). Toda la documentación debe mantener un tono técnico, formal y sobrio.

