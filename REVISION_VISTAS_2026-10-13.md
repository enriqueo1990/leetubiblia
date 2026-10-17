# Revisión de vistas — Lee Tu Biblia

> 13 de octubre de 2026 · Revisión de diseño, funcionalidad y usabilidad, vista por vista.
> Método: siete revisores en paralelo, uno por flujo, leyendo el código de cada pantalla
> contra los principios del producto (`.impeccable.md`, canon de diseño, memoria del
> dueño). Sin sesión iniciada: todo hallazgo cita archivo y línea y fue verificado en el
> código. Los tres de mayor severidad se re-verificaron a mano al consolidar.

## Cifras

| | |
|---|---|
| Flujos revisados | 7 |
| Hallazgos | 83 |
| P0 | 1 |
| P1 | 25 |
| P2 | 32 |
| P3 | 25 |

## Veredicto

La app está madura. Cada flujo tiene sus estados de carga, vacío y error; los
componentes compartidos se usan de verdad; la miga de vuelta es honesta casi en todos
lados; el push no miente; la frontera privado→compartido en Oración ya tiene fricción;
Grupos tiene invitación por enlace y salida para miembros. Lo que la revisión anterior
marcó como roto está en su mayoría resuelto.

Lo que queda son **bordes donde la app engaña sin querer**: guardados que fallan y la
pantalla sigue como si hubieran salido bien, datos que cambian de significado al
renovar o cambiar de plan, y acciones con costo que no piden confirmación. No hay
nada que impida usarla hoy, pero sí varias cosas que, cuando ocurren, le hacen perder
confianza al usuario justo en lo que más le importa: su progreso y su racha.

## Patrones transversales

Estos temas aparecen en más de una vista. Conviene atacarlos como tema, no pantalla
por pantalla.

### A. Guardados que fallan en silencio

El canon dice "optimista pero honesto": la interfaz avanza ya, y si el guardado falla
se revierte y se avisa. Hoy, el lector de materiales y el marcado principal de Hoy lo
cumplen. Estos no:

| Dónde | Qué pasa si falla | Archivo |
|---|---|---|
| Activar o cambiar plan | Navega a Hoy con el plan viejo, sin mensaje | `src/screens/PlanDetail.jsx:91-102` |
| Todos los ajustes cotidianos | El control no se mueve y nadie explica por qué; acento/tema/idioma se revierten solos en la próxima carga | `src/screens/Ajustes.jsx:113, 137-152, 182, 334, 525` |
| Regenerar código, quitar miembro, salir del grupo | El diálogo queda abierto, sin mensaje | `src/screens/GroupDetail.jsx:322-340` |
| Volver a leer un plan | Borra el progreso y, si la segunda escritura falla, cierra el diálogo como si hubiera salido bien | `src/screens/Hoy.jsx:206-226` |
| Activar o apagar un material | El error aparece diez tarjetas más abajo del switch | `src/screens/Materiales.jsx:98-109` |
| Cargar materiales en "También hoy" | Skeleton para siempre | `src/lib/todayExtras.js:42-50` |
| Cargar grupos en "También hoy" | Se disfraza de "No hay otras lecturas para hoy" | `src/lib/todayExtras.js:26` |
| Abrir un material por primera vez sin red | Skeleton para siempre, sin reintento | `src/screens/MaterialReader.jsx:95-105` |

**Cómo encararlo.** Un helper único para "guardar con reversión y aviso" que usen
Ajustes, PlanDetail, Materiales y GroupDetail. Todo `.then` sin `.catch` sobre un
`import()` o una consulta pasa a tener `RetryError`.

### B. Datos que cambian de significado al renovar o cambiar de plan

| Qué | Efecto para el usuario | Archivo |
|---|---|---|
| Renovar un plan no borra las notas del diario | Al releer el día N, la nota vieja bloquea la nueva: la hoja se abre sellada | `src/screens/Hoy.jsx:146-148`, `src/lib/db.js:293-300` |
| La racha se calcula solo sobre el plan activo | Cambiar de plan la lleva a 0 aunque hayas leído ayer | `src/lib/db.js:139-159`, `src/hooks/useReading.js:119-122` |
| "Días en la Palabra" cuenta solo filas vivas | Renovar un plan de 90 días baja el acumulado de 90 a 0 | `src/lib/db.js:317-338` |
| El progreso de grupo comparte clave con el personal | Si seguís un grupo con tu mismo plan y otra fecha, marcar el día 40 del grupo marca tu día 40 personal | `src/screens/GroupReading.jsx:73`, `src/lib/db.js:162-179` |
| Cambiar el plan del grupo desengancha a todos | Los seguidores pierden la fila en Hoy sin aviso; no hay confirmación | `src/screens/GroupDetail.jsx:175-188`, `supabase/migrations/0028_group_plan_follow.sql:66-69` |

**Cómo encararlo.** La racha y los acumulados deben salir de todas las fechas del
usuario, no del plan activo. El progreso de grupo necesita su propia clave o, a corto
plazo, ocultar y avisar cuando el plan coincide con el personal. Las notas del diario
deben quedar ligadas al ciclo, no al par plan+día.

### C. Acciones con costo sin confirmación

- **Cerrar sesión** borra caché offline y suscripción push, y volver exige un código por correo. Está justo encima de "Eliminar cuenta". `src/screens/Ajustes.jsx:646-652`
- **Cambiar el plan del grupo** ejecuta al instante. "Quitar el plan" sí confirma. `src/screens/groupDetail/GroupPlanSheet.jsx:29-37`
- **Apagar un material** borra el marcador. Un toque accidental en el switch tira 80 preguntas de avance. `src/screens/Materiales.jsx:48-55`
- **Compartir un pedido al crearlo** preselecciona el primer grupo en silencio; con varios grupos es fácil publicar al equivocado. `src/screens/PrayerSheet.jsx:60-62, 264-279`
- **"Siguiente pedido" en Orar ahora** registra "estoy orando" visible para el autor sin decirlo. `src/screens/OrarAhora.jsx:264-271`

### D. Feedback que aparece lejos del toque o desaparece antes de verse

- La confirmación de **Reprogramar** vive dentro del bloque de atraso, que desaparece al tener éxito. Ocurre igual en Hoy y en Progreso. `src/screens/Hoy.jsx:410-447`, `src/screens/Progreso.jsx:177-203`
- Las notas de resultado de **Ajustes** se pintan al pie de la tarjeta, tres filas debajo del switch. `src/screens/Ajustes.jsx:172, 193, 531-533`
- **Progreso** reemplaza toda la pantalla por "Cargando…" en cada recarga, fuera del canon de skeletons. `src/screens/Progreso.jsx:68-70`

### E. Bloques sin encabezado o sin explicación

Es el punto que más confunde al dueño del producto, y sigue apareciendo:

- Las dos tarjetas de números de **Progreso** y la grilla de **Recorrido** no tienen título de sección. `src/screens/Progreso.jsx:95-112`, `src/screens/Recorrido.jsx:94-114`
- La lista de **miembros** no explica por qué casi nadie tiene el chip "Leyó hoy". `src/screens/groupDetail/GroupMembers.jsx:15-17`
- El **índice** de materiales deshabilita las entradas futuras sin decir por qué. `src/components/MaterialIndexSheet.jsx:62-73`
- El pulso **"N leyeron hoy"** te cuenta a vos. `src/screens/GroupDetail.jsx:147-148`

### F. Idioma

- Portugués con marcas de género en Oración y Grupos: `prayerDetail.beFirst`, `prayerDetail.authorWillKnow`, `grupos.createHelp`, `groupDetail.adminSuffix`, `grupos.admin`. Y "Só aparecem quem compartilha" es agramatical.
- Nombres de respaldo quemados en la capa de datos: `'Alguien'` y `'Miembro'` en `src/lib/db.js:401, 510, 598, 626, 764`.
- Nombres de materiales, de acentos y el catálogo de planes en el onboarding aparecen en español en en/pt. `src/components/PlanCatalog.jsx:75, 81`, `src/lib/materials.js:21-100`, `src/hooks/useAccent.js:7-16`
- "(vos)" hardcodeado aunque existe la clave. `src/screens/groupDetail/GroupPrivateStats.jsx:78`
- Claves huérfanas: `hoy.readingDay`, `hoy.readingTodayWithDay`, `hoy.readingToday`, `hoy.openBible`, `ajustes.section.lecturaGrupos`, `ajustes.section.avisosGrupo`, `ajustes.section.seguimiento`, `ajustes.section.compartir`, `ajustes.section.ayuda`, `ajustes.activar`.

### G. Accesibilidad

- Errores inline sin `role="alert"`: Hoy (marcar, reprogramar), GroupReading, modo vista de la nota. `src/screens/Hoy.jsx:403-407, 436-440`, `src/screens/GroupReading.jsx:120-124`
- Controles de texto por debajo de 44 px en Hoy, GroupReading, TodayExtras, GroupPlanCard, GroupPulse.
- Textareas sin nombre accesible: nota del día y novedades. `src/components/ReflectionSheet.jsx:139-156`, `src/screens/PrayerDetail.jsx:379-388`
- El menú del chip "✓ Leído" no se maneja con teclado. `src/screens/Hoy.jsx:328-370`
- El selector de grupo en Oración no anuncia la selección. `src/screens/PrayerSheet.jsx:267-279`
- Leyenda del heatmap en un `aria-label` sobre un `div` sin rol. `src/screens/Progreso.jsx:157-161`
- Input de renombrar grupo sin `aria-label`. `src/screens/groupDetail/GroupHeader.jsx:26-37`

### H. Contenido público desactualizado

- /info y /ayuda prometen **12 acentos**; la app tiene 8. `src/screens/Info.jsx:59`, `src/screens/Ayuda.jsx:103`
- La sección Ajustes de **/ayuda** describe 4 de los 10 ajustes reales y menciona "(NBLA)" cuando la versión depende del idioma. `src/screens/Ayuda.jsx:41, 102-107`
- **/privacidad** habla de "enlace de acceso" y el login es por código. `src/screens/Privacidad.jsx:179`
- Anchos 720/880 mezclados dentro de /info, /ayuda y /lideres. `src/screens/Info.jsx:181, 272`, `src/screens/Ayuda.jsx:322`

### I. PWA offline en frío

El caso común, abrir la app con red o con sesión caliente, funciona. Los bordes no:

- Token vencido sin red muestra la bienvenida a un usuario logueado. `src/lib/auth.jsx:97-131`
- Versión nueva más primer arranque sin red rompe la app privada por chunks no precacheados. `vite.config.js:175-196`
- Un material abierto por primera vez sin red queda en skeleton. `src/screens/MaterialReader.jsx:95-105`
- Progreso sin snapshot muestra ceros como dato. `src/hooks/useReading.js:177-188`
- Cerrar sesión borra la cola de marcados pendientes sin intentar vaciarla. `src/lib/auth.jsx:210`

**Cómo encararlo.** Precachear el camino crítico a Hoy, entrar con el perfil cacheado
cuando no hay red y sí hay sesión persistida, y vaciar la cola antes de salir.

### J. Estado por dispositivo que debería ser por usuario

- Flags de onboarding `ltb.onboarded_extras` y `ltb.pendingPlan` no se limpian al salir: una segunda cuenta en la misma tablet salta pasos y pierde el plan elegido. `src/components/Gate.jsx:49-50`
- La pista de materiales ya se corrigió a por usuario en esta misma fecha; conviene aplicar la misma regla al resto.

## Los diez primeros

En orden de impacto por esfuerzo. Los cinco primeros tocan confianza o datos.

1. **Activar plan ignora el error y navega.** Arreglo de diez líneas. `PlanDetail.jsx:91-102`
2. **Marcar lectura de grupo puede marcar tu plan personal.** Ocultar y avisar cuando el plan coincide; a largo plazo clave propia. `GroupReading.jsx:73`
3. **Racha y acumulados por plan activo.** Calcular sobre todas las fechas del usuario. `db.js:139-159, 317-338`
4. **Notas del diario bloqueadas al renovar.** Ligar la nota al ciclo. `Hoy.jsx:146-148`
5. **Ajustes fallan mudos.** Un helper de guardado con reversión y aviso, reutilizable en PlanDetail, Materiales y GroupDetail. `Ajustes.jsx`
6. **"También hoy" y el lector pueden quedar cargando para siempre o mentir con el vacío.** `.catch` y `RetryError`. `todayExtras.js:26, 42-50`, `MaterialReader.jsx:95-105`
7. **Arranque sin red:** token vencido muestra la bienvenida, y versión nueva más arranque offline rompe la app. Precachear el camino crítico y entrar con el perfil cacheado. `auth.jsx:97-131`, `vite.config.js:175-196`
8. **Cerrar sesión sin confirmación** y borrando marcados pendientes. Vaciar la cola, confirmar. `Ajustes.jsx:646-652`, `auth.jsx:210`
9. **Cambiar el plan del grupo sin confirmación** y el líder sin salida del grupo. `GroupDetail.jsx:175-188, 433-442`
10. **Flags de onboarding por dispositivo.** Una segunda cuenta pierde el plan elegido. `Gate.jsx:49-50`

Después de estos diez, en una segunda tanda: el proveedor de Biblia en GroupReading
(una línea), el contenido público (8 acentos, Ayuda completa, Privacidad con el login
real), y la pasada de accesibilidad del patrón G.

## Por vista

### Hoy y lectura diaria

**Estado.** Sólido en sesión caliente y online: ancla de día clara, marcado optimista
con cola offline, nota del día con caché, "También hoy" sin competir con la lectura
principal. Los problemas están en los bordes de red y en el reinicio del plan.

- **[P1] "También hoy" puede quedar en skeleton para siempre.** `Promise.all` de materiales sin `.catch`. `src/lib/todayExtras.js:42-50`
- **[P1] Un fallo de red se disfraza de "no hay otras lecturas".** El hook no distingue error de vacío; Hoy muestra la pista de materiales a alguien que sí tiene grupos. `src/lib/todayExtras.js:26`
- **[P1] GroupReading ignora el proveedor de Biblia.** Siempre abre YouVersion aunque elegiste BibleGateway. `src/screens/GroupReading.jsx:20, 110`
- **[P1] "Volver a leer este plan" puede borrar el progreso y cerrar como si hubiera salido bien.** `updateProfile` devuelve `{ error }`, no lanza, y el código lo trata como si lanzara. `src/screens/Hoy.jsx:206-226`
- **[P1] Marcar la lectura de grupo puede marcar tu plan personal.** Misma clave en `reading_progress`. `src/screens/GroupReading.jsx:73`
- **[P2] La confirmación de Reprogramar nunca llega a verse.** `src/screens/Hoy.jsx:410-447`
- **[P2] Errores inline sin `role="alert"`.** `src/screens/Hoy.jsx:403-407, 436-440`
- **[P2] Controles por debajo de 44 px:** Reprogramar, link de header, "Leer el día siguiente", "Desmarcar", pista de materiales.
- **[P2] El menú del chip "✓ Leído" no se maneja con teclado.** `src/screens/Hoy.jsx:328-370`
- **[P3] Barra de acción vacía cuando la lectura no está disponible.** `src/screens/Hoy.jsx:624`
- **[P3] Skeletons que no repiten la forma final** en la vista completa y GroupReading.
- **[P3] Textarea de la nota sin nombre accesible** y cuatro claves i18n huérfanas.

### Planes y Materiales

**Estado.** Bien construido y fiel a los principios: referencias, no texto bíblico;
marcador optimista con reversión en el lector; miga honesta en todos los orígenes.

- **[P0] Cambiar o activar plan falla en silencio y navega a Hoy igual.** `src/screens/PlanDetail.jsx:88-103`
- **[P1] Lector de materiales: error de carga mudo e infinito.** Los chunks de materiales no están precacheados; abrir uno nuevo sin red cae acá. `src/screens/MaterialReader.jsx:95-105`
- **[P1] Apagar un material borra el marcador sin confirmación.** `src/screens/Materiales.jsx:48-55`
- **[P1] PlanCatalog muestra nombre y descripción en español crudo en en/pt.** `src/components/PlanCatalog.jsx:75, 81`
- **[P2] En PlanDetail el error de carga convive con el skeleton.** `src/screens/PlanDetail.jsx:190-191`
- **[P2] "Engancharse en el día N" puede dejar N−1 días de atraso falso** si falla el marcado masivo. `src/screens/PlanDetail.jsx:92-99`
- **[P2] El catálogo agrupa por duración, no por puerta pastoral.** `src/screens/Planes.jsx:39-42`
- **[P2] En Materiales el error de guardado aparece lejos del toque y sin estado "en curso".** `src/screens/Materiales.jsx:98-109`
- **[P2] Nombres y descripciones de materiales solo en español sin señalarlo.** `src/lib/materials.js:21-100`
- **[P3] Estados de carga fuera del canon Skeleton.** `src/components/PlanCatalog.jsx:60-62`
- **[P3] La imagen compartida de un devocional queda solo con el versículo.** `src/lib/shareImage.js:644-655`
- **[P3] Filas futuras del índice deshabilitadas sin explicación.** `src/components/MaterialIndexSheet.jsx:62-73`

### Oración

**Estado.** Completo y bien cableado. La fricción privado→compartido que pidió la
revisión anterior existe. Sheet accesible de verdad: foco atrapado, Escape,
confirmación de descarte.

- **[P1] "Seguir orando" no saca de revisión a un pedido vencido.** Vuelve a "Para volver a orar" en cada carga. `src/lib/db.js:694-700, 743-749`
- **[P1] "Siguiente pedido" registra "estoy orando" sin decirlo.** `src/screens/OrarAhora.jsx:264-271`
- **[P2] Al compartir en creación se preselecciona el primer grupo en silencio.** `src/screens/PrayerSheet.jsx:60-62`
- **[P2] El sheet de testimonio abre "sucio"** y pide descartar cambios que no hiciste. `src/screens/PrayerSheet.jsx:68-70, 103`
- **[P2] Tocar un pedido propio lleva a lugares distintos según sea privado o compartido.** `src/screens/Oracion.jsx:238-262`
- **[P2] "Actualizar" abre el formulario completo, no el composer de novedades,** y el pedido aparece duplicado en revisión y en activos. `src/screens/Oracion.jsx:198-204`
- **[P2] Portugués con marcas de género.** `src/i18n/pt.json:444, 447`
- **[P3] Textarea de novedades sin etiqueta y con estilo distinto.** `src/screens/PrayerDetail.jsx:379-388`
- **[P3] Selector de grupo no anuncia selección.** `src/screens/PrayerSheet.jsx:267-279`
- **[P3] Borrar desde el detalle ignora el camino de vuelta.** `src/screens/PrayerDetail.jsx:461`
- **[P3] Nombres de respaldo en español en la capa de datos.** `src/lib/db.js:510, 598, 626`
- **[P3] Dos acciones con relleno de acento en la misma pantalla.** `src/screens/Oracion.jsx:139-165`

### Grupos

**Estado.** Completo y maduro: invitación por código y enlace con aterrizaje propio,
salida para miembros, plan común con dos modos, pulso recíproco, estadísticas privadas
del líder. Lo que marcó la revisión anterior está resuelto.

- **[P1] Regenerar código, quitar miembro y salir del grupo fallan en silencio.** `src/screens/GroupDetail.jsx:322-340`
- **[P1] Cambiar el plan del grupo no pide confirmación y desengancha a todos sin aviso.** `src/screens/GroupDetail.jsx:175-188`
- **[P1] El líder no tiene ninguna salida del grupo que creó.** Ni eliminar ni delegar; la policy de borrado existe sin UI. `src/screens/GroupDetail.jsx:433-442`
- **[P2] La lista de miembros no explica por qué casi nadie tiene chip.** `src/screens/groupDetail/GroupMembers.jsx:15-17`
- **[P2] Si falla cargar el plan, el líder ve "Todavía no eligieron un plan"** aunque exista. `src/screens/groupDetail/GroupPlanCard.jsx:24, 97-112`
- **[P2] "Ver todos" de oración saca del grupo y mezcla todos los grupos.** `src/screens/groupDetail/GroupPrayers.jsx:57, 130`
- **[P2] Error de carga de planes sin reintento.** `src/screens/groupDetail/GroupPlanSheet.jsx:42-43`
- **[P2] "(vos)" hardcodeado, portugués con género, fallbacks sin traducir.** `src/screens/groupDetail/GroupPrivateStats.jsx:78`
- **[P3] "Admin" y "administrador" para un público de líderes.** `src/screens/groupDetail/GroupMembers.jsx:36`
- **[P3] Targets menores a 44 px** en la tarjeta de plan y el pulso.
- **[P3] Input de renombrar sin etiqueta accesible.** `src/screens/groupDetail/GroupHeader.jsx:26-37`
- **[P3] El pulso "N leyeron hoy" te cuenta a vos.** `src/screens/GroupDetail.jsx:147-148`

### Progreso, Recorrido y Diario

**Estado.** Racha por fechas locales reales, coherente con el heatmap; fechas robustas
ante DST y bisiestos; Diario con regla clara y guardado honesto. El flash de ceros y la
racha offline de la revisión anterior están resueltos en el caso común.

- **[P1] Al renovar un plan, las notas del ciclo anterior bloquean las nuevas.** `src/screens/Hoy.jsx:146-148`, `src/lib/db.js:293-300`
- **[P1] Offline sin snapshot: Progreso muestra "0 días de racha · 0%" como dato.** `src/hooks/useReading.js:177-188`, `src/screens/Progreso.jsx:86-111`
- **[P1] La racha es por plan activo: cambiar de plan la lleva a 0.** `src/lib/db.js:139-159`
- **[P1] "Días en la Palabra" retrocede al renovar.** `src/lib/db.js:317-338`
- **[P2] Nota de atraso contradictoria cuando vas adelantado.** Progreso no aplica la regla `anchoredAhead` que Hoy sí usa. `src/screens/Progreso.jsx:56-58, 177-191`
- **[P2] "Cargando…" reemplaza toda la pantalla en cada recarga** y la confirmación de reprogramar nunca se ve. `src/screens/Progreso.jsx:68-70`
- **[P2] El cero de racha como número héroe en acento.** `src/screens/Progreso.jsx:96-103`
- **[P2] Bloques de números sin encabezado y estilo divergente.** `src/screens/Progreso.jsx:95-112`, `src/screens/Recorrido.jsx:94-114`
- **[P3] Leyenda del heatmap inaccesible, sin resumen textual.** `src/screens/Progreso.jsx:157-161`
- **[P3] El porcentaje llega a 100% antes de terminar.** `src/hooks/useReading.js:270`
- **[P3] Apagar el diario esconde las notas existentes.** `src/screens/Progreso.jsx:62-67`
- **[P3] Recorrido reimplementa el vacío a mano; tarjeta de Diario con bloques dentro de un botón.**

### Ajustes y páginas públicas

**Estado.** El push es honesto, borrar cuenta está bien protegido, "¿En qué día vas?"
anticipa consecuencias, y las landings cumplen la rúbrica anterior en lo verificable
(CTA única, header ghost, focus-visible, sin overflow en 375 px).

- **[P1] Los ajustes cotidianos fallan en silencio.** `src/screens/Ajustes.jsx:113, 137-152, 182, 334, 525`
- **[P1] "Cerrar sesión" sin confirmación aunque tiene costo real.** `src/screens/Ajustes.jsx:646-652`
- **[P1] Las landings prometen 12 acentos y la app tiene 8.** `src/screens/Info.jsx:59`, `src/screens/Ayuda.jsx:103`
- **[P1] La sección Ajustes de /ayuda describe la mitad de los ajustes reales.** `src/screens/Ayuda.jsx:41, 102-107`
- **[P2] Los mensajes de resultado aparecen lejos del control.** `src/screens/Ajustes.jsx:172, 193, 531-533`
- **[P2] En móvil el recordatorio queda séptimo, detrás de cuatro selectores estéticos.** `src/screens/Ajustes.jsx:296-486`
- **[P2] Anchos 720/880 mezclados dentro de una misma página pública.** `src/screens/Info.jsx:181, 272`
- **[P2] /privacidad describe un login por enlace; el real es por código.** `src/screens/Privacidad.jsx:179`
- **[P3] Nombres de acento y guía solo en español.** `src/hooks/useAccent.js:7-16`
- **[P3] BibleGateway arma la referencia con el nombre del libro en español.** `src/lib/bible.js:65`
- **[P3] Seis claves i18n huérfanas y un ícono duplicado en Misión.** `src/screens/Ajustes.jsx:591, 596`

### Onboarding, autenticación y navegación

**Estado.** Los dos P0 de la revisión anterior están resueltos: "ingresar" ya no crea
cuenta en silencio y el arranque offline caliente no cuelga. Modales correctos, una sola
fuente de navegación, banner de actualización honesto. La "exploración sin cuenta" es en
realidad solo el catálogo de planes: un visitante no ve ninguna pestaña, así que no hay
callejones sin salida, pero tampoco hay exploración de la app.

- **[P1] Arranque offline con token vencido muestra la bienvenida a un usuario logueado.** Sin red el refresco falla, la sesión queda en null y el Gate renderiza AuthFlow: quien abre la PWA a la mañana sin señal ve "Empezar / Ya tengo cuenta". Deducido del código; confirmar en dispositivo. `src/lib/auth.jsx:97-131`, `src/components/Gate.jsx:65-66`
- **[P1] Tras una actualización, el primer arranque sin red rompe la app.** El precache solo incluye el shell; los chunks de PrivateRoot, supabase y las pantallas se cachean al usarse. Versión nueva más arranque sin red da pantalla de error en bucle. `vite.config.js:175-196`
- **[P1] Los flags de onboarding son por dispositivo, no por usuario.** Una segunda cuenta en el mismo dispositivo salta el paso 3 y pierde el plan elegido. `src/components/Gate.jsx:49-50, 75, 82`, `src/lib/auth.jsx:198-214`
- **[P1] Cerrar sesión descarta sin aviso los marcados pendientes de sincronizar.** Nada vacía la cola antes de salir. `src/lib/auth.jsx:210`, `src/lib/offline.js:91-100`
- **[P2] En "ingresar", cualquier fallo se reporta como "no encontramos una cuenta".** Sin red o con límite de envíos, el usuario puede terminar creando una cuenta duplicada. `src/screens/onboarding/AuthFlow.jsx:70-77`
- **[P2] "Reenviar código" no confirma nada ni tiene espera.** `AuthFlow.jsx:276-285`
- **[P2] Sesión sin perfil: tras 10 s el splash queda para siempre,** sin mensaje ni salida. `src/lib/auth.jsx:168-179`, `src/components/Gate.jsx:72`
- **[P2] Targets menores a 44 px en la bienvenida:** los tres "Volver", "usar otro correo", "reenviar", y el "Reintentar" de RetryError. `AuthFlow.jsx:169-177, 210-218, 301-308`
- **[P2] El splash muestra un versículo.** Es texto bíblico dentro de la app y está fijo en español. Decisión de marca: documentarla como excepción o dejar solo la referencia. `index.html:250-252`
- **[P3] 404 y ErrorBoundary con textos en español fijos.** `src/App.jsx:82-84`, `src/components/ErrorBoundary.jsx:51, 66`
- **[P3] En móvil, /ajustes no enciende ninguna pestaña.** `src/components/nav.js:12`
- **[P3] Cambiar entre "crear" e "ingresar" no limpia el error previo.** `AuthFlow.jsx:358-368`

### i18n transversal

Un script cargó los tres catálogos. Resultado: 600 claves en es, en y pt; cero claves
faltantes en cualquier dirección; cero diferencias de tipo entre string y objeto de
plurales; cero diferencias de placeholders. Los únicos textos fuera de i18n en
pantallas de usuario son el 404, el ErrorBoundary y el versículo del splash. El panel
Admin está en español fijo, aceptable por ser privado del dueño.

Lo que sí hay son claves huérfanas (listadas en el patrón F) y texto en portugués con
marcas de género en Oración y Grupos, que el script no detecta porque es semántica.

## Lo que hay que preservar

- La anatomía compartida de Hoy, GroupReading y el lector: metadata callada arriba, el pasaje o la pregunta como página, una acción primaria abajo.
- `PassageList` sin texto bíblico, con cada referencia abriendo afuera.
- El marcado principal de Hoy, la intercesión y el lector de materiales como ejemplos del patrón "optimista pero honesto" que el resto debería copiar.
- `Sheet` con foco atrapado, Escape, devolución del foco y confirmación de descarte.
- `BackLink` con `state.from` y los orígenes que lo pasan.
- La frontera privado→compartido con confirmación que nombra al grupo.
- Carga parcial con banner y reintento en GroupDetail.
- Push que no se enciende si falla, y copy que no promete una hora exacta.
- Racha por fechas de calendario y fechas en UTC para evitar corrimientos.
- La degradación digna de la imagen para compartir: nunca trunca doctrina.
