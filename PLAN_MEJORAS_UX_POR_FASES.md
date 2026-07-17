# Plan de mejoras UX/UI por fases

Documento operativo para ejecutar con ChatGPT Luna, una fase por vez, las mejoras surgidas de la revisión de producto de **Lee Tu Biblia**.

## Objetivo

Mejorar la aplicación sin perder su identidad actual: tranquila, minimalista, centrada en la lectura bíblica y respetuosa con el usuario. El trabajo debe priorizar claridad, rapidez, consistencia, accesibilidad y confianza antes que decoración.

## Forma de ejecución

1. Ejecutar **una sola fase por conversación o tarea**.
2. No comenzar la fase siguiente hasta que la anterior cumpla sus criterios de aceptación.
3. Antes de modificar código, revisar la implementación actual y confirmar el alcance exacto de la fase.
4. Evitar refactors, cambios visuales o nuevas funciones que no pertenezcan a la fase activa.
5. Mantener sincronizadas las traducciones en español, inglés y portugués.
6. Preservar modo claro, modo oscuro, `prefers-reduced-motion`, funcionamiento PWA y comportamiento responsive.
7. No modificar migraciones, contratos de datos o políticas de seguridad salvo que la fase lo requiera expresamente.
8. Al terminar cada fase:
   - Enumerar los archivos modificados.
   - Explicar las decisiones tomadas.
   - Ejecutar las verificaciones indicadas.
   - Informar cualquier riesgo o asunto pendiente.
   - Detenerse antes de comenzar la fase siguiente.
9. No crear commits ni publicar cambios salvo que el usuario lo solicite expresamente.

## Verificaciones comunes

En todas las fases con cambios de código, ejecutar como mínimo:

```bash
npm run lint
npm test
npm run build
```

Cuando haya cambios visuales o de interacción, comprobar también:

- Móvil: 390 × 844.
- Tablet: 768 × 1024.
- Escritorio: 1440 × 900.
- Modo claro y oscuro.
- Navegación con teclado.
- Texto ampliado cuando corresponda.
- Estados de carga, vacío y error afectados por el cambio.

---

# Fase 0 — Línea base y contrato de producto

## Estado

- [x] Completada — contrato aprobado por el usuario

## Objetivo

Documentar el comportamiento esperado del progreso antes de modificar su lógica o sus textos.

## Alcance

Analizar y definir qué significa en el producto:

- Día calendario del plan.
- Lectura mostrada en Hoy.
- Próxima lectura pendiente.
- Lecturas completadas.
- Lectura adelantada.
- Días atrasados.
- Racha.
- Reprogramación.
- Plan terminado.

Definir qué debe mostrar Hoy cuando:

- El día calendario está pendiente.
- El día calendario ya fue completado.
- Existen días anteriores pendientes.
- El usuario quiere seguir leyendo por adelantado.
- Hay lecturas futuras ya completadas.
- El plan terminó.
- La aplicación está sin conexión.

## Archivos a revisar

- `src/hooks/useReading.js`
- `src/screens/Hoy.jsx`
- `src/screens/Progreso.jsx`
- `src/screens/Ajustes.jsx`
- `src/lib/db.js`
- `APP_LECTURA_ORACION_MASTER.md`

## Entregable

- Una especificación breve del modelo mental elegido.
- Una matriz de estados con ejemplos concretos.
- Vocabulario definitivo para Hoy, Progreso y Ajustes.
- Casos de prueba necesarios para la implementación.
- Ningún cambio funcional en esta fase.

## Criterios de aceptación

- Cada número visible tiene un único significado.
- El día principal de Hoy representa el día del plan en el que la persona está, aunque esté adelantada respecto del calendario.
- El comportamiento adelantado y atrasado puede explicarse sin conocer el código.
- El calendario se usa como referencia para detectar atraso, pero no reemplaza el día del plan mostrado por Hoy.
- El heatmap de Progreso es un historial visual de lecturas y no es editable.
- Ajustar el día del plan y registrar una lectura siguen siendo parte del mismo flujo de producto; no se separan en esta fase.

## Decisiones aprobadas

- La documentación anterior tenía inconsistencias porque no estaba actualizada con el comportamiento actual.
- El heatmap de Progreso permanece como historial visual de días leídos. No se convierte en un editor.
- Si la persona leyó por adelantado, Hoy muestra ese día adelantado. Esto es correcto y permite continuar el plan según el ritmo real de la persona.
- No se revierte Hoy para que use exclusivamente el día calendario.
- No se crea una acción secundaria obligatoria para sustituir la lógica actual de lectura adelantada.
- No se separa “ajustar posición del plan” de “registrar una lectura real”.

## Prompt para ChatGPT Luna

```text
Trabaja únicamente en la Fase 0 de PLAN_MEJORAS_UX_POR_FASES.md.

Analiza el modelo actual de progreso de Lee Tu Biblia sin modificar código. Revisa useReading, Hoy, Progreso, Ajustes, db.js y la documentación de producto. Define con ejemplos concretos la diferencia entre día calendario, día del plan en el que está la persona, lectura mostrada, próxima lectura, lecturas completadas, atraso, lectura adelantada, racha y reprogramación.

Tené en cuenta estas decisiones ya aprobadas: el heatmap es solo historial visual y no es editable; si la persona leyó por adelantado, Hoy muestra ese día adelantado; no hay que volver a un modelo exclusivamente basado en el día calendario; y no se separan ajustar el día del plan y registrar una lectura. Señala contradicciones documentales, pero no propongas revertir estas decisiones. Detente al entregar la especificación; no comiences la Fase 1.
```

---

# Fase 1 — Inicio rápido y promesa clara

## Estado

- [x] Completada — inicio y promesa actualizados

## Objetivo

Eliminar la fricción artificial del inicio y explicar correctamente la propuesta del producto desde la bienvenida.

## Alcance

- Eliminar el mínimo obligatorio de 2,5 segundos del splash.
- Retirar el splash apenas exista una pantalla real lista.
- Evitar flashes, skeletons incompletos o fondos incorrectos durante el arranque.
- Mantener una transición breve y respetar `prefers-reduced-motion`.
- Explicar en la bienvenida que la aplicación acompaña la lectura en una Biblia física.
- Comunicar discretamente en Hoy que tocar una referencia abre una aplicación o sitio externo de Biblia.
- Evitar añadir un icono externo a cada referencia.
- Actualizar todas las traducciones afectadas.

## Archivos probables

- `index.html`
- `src/components/LaunchReady.jsx`
- `src/screens/onboarding/AuthFlow.jsx`
- `src/components/PassageList.jsx`
- `src/screens/Hoy.jsx`
- `src/i18n/es.json`
- `src/i18n/en.json`
- `src/i18n/pt.json`

## Criterios de aceptación

- Si la aplicación está lista, no espera por una animación de marca.
- El splash continúa evitando flashes de contenido incompleto.
- El primer arranque funciona con red rápida, red lenta y sin conexión.
- Antes de registrarse se entiende que Lee Tu Biblia no reemplaza el texto bíblico.
- El destino externo de las referencias se comunica antes de que produzca sorpresa.
- La pantalla Hoy conserva su jerarquía minimalista.

## Prompt para ChatGPT Luna

```text
Implementa únicamente la Fase 1 de PLAN_MEJORAS_UX_POR_FASES.md.

Elimina el tiempo mínimo obligatorio del splash sin provocar flashes ni mostrar estados incompletos. Actualiza la bienvenida para explicar con claridad que Lee Tu Biblia acompaña la lectura en una Biblia física. En Hoy, comunica de manera discreta que tocar una referencia abre la app o web de Biblia, sin añadir ruido visual a cada pasaje.

Mantén el estilo actual, sincroniza las traducciones y verifica apertura en frío, navegación interna, movimiento reducido, móvil y escritorio. Ejecuta lint, tests y build. Entrega resultados y detente antes de la Fase 2.
```

---

# Fase 2 — Claridad del modelo de avance

## Estado

- [x] Completada — claridad implementada y verificada

## Dependencia

Requiere que la especificación de la Fase 0 haya sido revisada y aprobada.

## Objetivo

Eliminar contradicciones aparentes entre Hoy, Progreso y Ajustes.

## Alcance

- Implementar exactamente el modelo aprobado en la Fase 0.
- Conservar el día del plan mostrado por Hoy como referencia principal de avance.
- Conservar la posibilidad de que el día mostrado esté adelantado respecto del calendario.
- Aclarar visualmente la diferencia entre día del plan, día calendario, cantidad completada y atraso.
- No forzar Hoy a mostrar exclusivamente el día calendario.
- No convertir el heatmap en un control editable.
- No separar el ajuste de día del plan del registro de lectura sin una nueva decisión de producto.
- Hacer coherente la reprogramación en Hoy, Progreso y Ajustes.
- Mantener un comportamiento razonable sin conexión.
- Añadir pruebas de regresión sobre cálculos y transiciones de estado.

## Archivos probables

- `src/hooks/useReading.js`
- `src/screens/Hoy.jsx`
- `src/screens/Progreso.jsx`
- `src/screens/Ajustes.jsx`
- `src/lib/db.js`
- Archivos de traducción.
- Pruebas nuevas o existentes.

## Casos mínimos de prueba

- Día calendario pendiente.
- Día calendario completado.
- Un día atrasado.
- Varios días atrasados.
- Lectura adelantada dentro de la sesión y después de recargar.
- Días futuros ya completados.
- Reprogramación hacia adelante.
- Reprogramación hacia atrás.
- Plan terminado.
- Apertura offline con datos recientes y antiguos.

## Criterios de aceptación

- Todos los números visibles se pueden explicar sin conocimiento técnico.
- El día adelantado se entiende como avance real del plan, no como error de calendario.
- Reprogramar produce resultados consistentes en todas las pantallas.
- Las pruebas cubren los límites del plan y cambios de fecha.
- No se altera el progreso histórico de otros planes.

## Prompt para ChatGPT Luna

```text
Implementa únicamente la Fase 2 de PLAN_MEJORAS_UX_POR_FASES.md, siguiendo de forma estricta la especificación aprobada en la Fase 0.

Trabaja en useReading, Hoy, Progreso, Ajustes y las utilidades relacionadas. El día principal de Hoy es el día del plan en el que está la persona y puede estar adelantado respecto del calendario. El usuario debe distinguir claramente día del plan, día calendario, cantidad completada y atraso. El heatmap permanece como historial visual no editable. Añade pruebas para todos los casos enumerados en la fase. No rediseñes otras áreas ni cambies contratos de datos sin justificarlo antes.

Verifica los escenarios con fechas concretas, ejecuta lint, tests y build, informa riesgos y detente antes de la Fase 3.
```

## Punto de control obligatorio

No continuar con las siguientes fases hasta confirmar manualmente que el modelo de progreso es comprensible y estable.

---

# Fase 3 — Navegación predecible

## Estado

- [x] Completada — navegación y regresos verificados

## Objetivo

Hacer que los destinos globales sean estables y estén disponibles desde cualquier pantalla principal.

## Alcance

- Mantener Hoy, Oración, Grupos y Progreso como navegación primaria.
- Mantener Ajustes disponible a un toque desde Hoy en móvil, como acceso dedicado de configuración.
- No añadir accesos duplicados a Ajustes desde Oración, Grupos o Progreso en móvil.
- Usar una posición, icono, etiqueta accesible y área táctil estables para el acceso de Hoy.
- Mantener Ajustes al pie del sidebar en escritorio.
- Revisar el estado activo de las pestañas en subpantallas.
- Verificar que los enlaces de regreso respeten el recorrido real.
- No reestructurar todavía el contenido interno de Oración o Grupos.

## Archivos probables

- `src/components/nav.js`
- `src/components/TabBar.jsx`
- `src/components/Sidebar.jsx`
- `src/components/BackLink.jsx`
- Encabezados de Hoy, Oración, Grupos y Progreso.

## Criterios de aceptación

- Ajustes está a un toque desde cualquier destino principal.
- La ubicación del acceso es consistente.
- El usuario siempre sabe qué sección primaria contiene la pantalla actual.
- Planes y materiales mantienen Hoy como contexto.
- Los detalles de oración y grupo mantienen activa su sección correspondiente.
- No aparecen accesos duplicados en escritorio.

## Prompt para ChatGPT Luna

```text
Implementa únicamente la Fase 3 de PLAN_MEJORAS_UX_POR_FASES.md.

Conserva las cuatro pestañas actuales y deja el acceso a Ajustes únicamente en el encabezado de Hoy en móvil. En escritorio conserva Ajustes en el sidebar. Revisa estados activos, rutas secundarias, regreso contextual y áreas táctiles.

No modifiques todavía la estructura interna de Oración ni Grupos. Verifica móvil, tablet y escritorio, ejecuta lint, tests y build, y detente antes de la Fase 4.
```

---

# Fase 4 — Accesibilidad y controles

## Estado

- [ ] Pendiente

## Objetivo

Mejorar objetivos táctiles, ampliación tipográfica, navegación por teclado y comunicación para lectores de pantalla.

## Alcance

- Garantizar áreas táctiles mínimas de 44 × 44 para controles esenciales.
- Revisar especialmente:
  - Enlace del plan en Hoy.
  - Referencias bíblicas.
  - Chips y menús asociados.
  - Acciones secundarias pequeñas.
- Migrar textos relevantes de interfaz desde píxeles rígidos hacia unidades escalables cuando sea seguro.
- Comprobar la interfaz con texto o zoom al 200%.
- Permitir reflujo sin superposición, corte o pérdida de acciones.
- Implementar el patrón ARIA completo de radiogroup en `Segmented`:
  - Flechas izquierda y derecha.
  - Flechas arriba y abajo cuando corresponda.
  - Roving `tabindex`.
  - Estado seleccionado anunciado correctamente.
- Añadir `aria-live` o `role=status` para resultados asíncronos silenciosos.
- Verificar contraste de textos, controles y estados con todos los acentos.

## Archivos probables

- `src/components/Segmented.jsx`
- `src/components/PassageList.jsx`
- `src/components/Switch.jsx`
- `src/components/BackLink.jsx`
- `src/screens/Hoy.jsx`
- `src/styles/index.css`
- `src/styles/tokens.css`
- Componentes de feedback afectados.

## Criterios de aceptación

- No hay controles esenciales menores de 44 × 44.
- La interfaz sigue siendo funcional con texto al 200%.
- No se depende únicamente del color para comunicar estados.
- Los controles segmentados funcionan con teclado según el patrón de radiogroup.
- Los procesos y éxitos importantes se anuncian a lectores de pantalla.
- `prefers-reduced-motion` elimina el movimiento no esencial.
- Claro, oscuro y los acentos mantienen contraste suficiente.

## Prompt para ChatGPT Luna

```text
Implementa únicamente la Fase 4 de PLAN_MEJORAS_UX_POR_FASES.md.

Amplía los objetivos táctiles sin alterar innecesariamente la apariencia, prepara la tipografía y los layouts para ampliación al 200%, implementa el patrón ARIA completo de radiogroup en Segmented y añade anuncios accesibles para operaciones asíncronas relevantes. Revisa contraste, foco visible, movimiento reducido, modo claro y oscuro.

No cambies la arquitectura de información. Realiza pruebas de teclado y responsive, ejecuta lint, tests y build, documenta los resultados y detente antes de la Fase 5.
```

---

# Fase 5 — Simplificación de Oración y Grupos

## Estado

- [ ] Pendiente

## Objetivo

Reducir scroll, tarjetas repetidas y carga cognitiva sin eliminar funciones.

## Oración

- Mantener “Orar ahora” como acción principal.
- Convertir pedidos normales en una lista agrupada más compacta.
- Reservar tarjetas para:
  - Pedidos que necesitan revisión.
  - Estados vacíos.
  - Errores.
  - Acciones realmente destacadas.
- Mantener Activos y Respondidos claramente separados.
- Conservar visibilidad, intercesores, fechas y estados sin sobrecargar cada fila.

## Detalle de grupo

Priorizar en la parte superior:

- Estado de hoy.
- Plan del grupo.
- Acción Invitar.

Convertir en resúmenes o accesos navegables:

- Miembros.
- Oración.
- Testimonios.
- Resumen pastoral.
- Lectura semanal.

Mostrar “Invitar” como texto visible en móvil y conservar etiquetas accesibles.

## Archivos probables

- `src/screens/Oracion.jsx`
- `src/screens/GroupDetail.jsx`
- `src/screens/groupDetail/*`
- Componentes de listas, filas y estados vacíos.
- Archivos de traducción.

## Criterios de aceptación

- En móvil se ven más pedidos útiles antes de hacer scroll.
- Cada pantalla tiene una acción principal evidente.
- Los pedidos normales no compiten visualmente entre sí.
- El detalle de grupo deja de sentirse como un dashboard interminable.
- Ninguna función existente queda escondida a más de un nivel adicional.
- Los roles de administrador y miembro continúan mostrando solo las acciones permitidas.

## Prompt para ChatGPT Luna

```text
Trabaja únicamente en la Fase 5 de PLAN_MEJORAS_UX_POR_FASES.md.

Primero presenta una propuesta estructural breve basada en la implementación y los datos actuales. Después, simplifica Oración reemplazando las tarjetas repetidas por una lista agrupada compacta, manteniendo tarjetas solo para excepciones y acciones destacadas. En el detalle de grupo, prioriza Hoy, Plan e Invitar y convierte las secciones secundarias en resúmenes navegables.

Conserva todas las funciones, permisos, estados y traducciones. Verifica cuentas con y sin grupos, owner y member, listas vacías y listas extensas. Ejecuta lint, tests y build y detente antes de la Fase 6.
```

---

# Fase 6 — Estados, offline y feedback

## Estado

- [ ] Pendiente

## Objetivo

Hacer que cada acción, demora y problema del sistema tenga una respuesta clara y consistente.

## Estados que deben distinguirse

- Sin conexión.
- Datos guardados disponibles.
- Datos posiblemente antiguos.
- Error del servidor.
- Contenido incompleto.
- Acción pendiente de sincronización.
- Operación exitosa.
- Operación en curso.
- Permiso rechazado.

## Alcance

- Aplicar estados offline claros especialmente en Oración y Grupos.
- Reutilizar datos guardados cuando ya exista soporte seguro para ello.
- No afirmar que una acción se guardó si aún no fue confirmada.
- Añadir feedback de éxito donde cerrar una hoja o cambiar un switch no sea suficiente.
- Unificar la carga de Progreso con los skeletons del sistema.
- Revisar reintentos, botones ocupados, errores de formularios y permisos.
- Evitar mensajes técnicos o alarmistas.
- Mantener anuncios accesibles.

## Archivos probables

- `src/components/RetryError.jsx`
- `src/components/Skeleton.jsx`
- `src/screens/Oracion.jsx`
- `src/screens/Grupos.jsx`
- `src/screens/GroupDetail.jsx`
- `src/screens/Progreso.jsx`
- `src/screens/Hoy.jsx`
- Utilidades de caché u offline existentes.

## Criterios de aceptación

- El usuario sabe si puede continuar trabajando sin conexión.
- Un error de red no se presenta como pérdida definitiva de información.
- El contenido antiguo se identifica como tal.
- Las operaciones exitosas tienen confirmación visible o anunciada.
- Los botones ocupados no cambian de tamaño ni generan saltos.
- Los reintentos conservan los datos ingresados cuando sea posible.

## Prompt para ChatGPT Luna

```text
Implementa únicamente la Fase 6 de PLAN_MEJORAS_UX_POR_FASES.md.

Crea una comunicación consistente para sin conexión, datos en caché, contenido antiguo, error, sincronización pendiente, éxito y proceso en curso. Aplícala especialmente a Oración, Grupos, Hoy y Progreso, reutilizando los componentes y la infraestructura offline existentes siempre que sea seguro.

No introduzcas toasts invasivos ni afirmes éxito antes de confirmación. Revisa accesibilidad, permisos, reintentos y formularios. Ejecuta lint, tests y build, documenta los escenarios probados y detente antes de la Fase 7.
```

---

# Fase 7 — QA visual y preparación para publicar

## Estado

- [ ] Pendiente

## Objetivo

Validar el conjunto completo, corregir regresiones y determinar si la aplicación está lista para publicar.

## Restricción

No incorporar funciones nuevas ni rediseños durante esta fase. Solo corregir regresiones, incumplimientos de criterios y problemas de publicación comprobables.

## Matriz visual y funcional

### Viewports

- 390 × 844.
- 768 × 1024.
- 1440 × 900.

### Preferencias

- Claro.
- Oscuro.
- Cada familia de acento relevante.
- Texto normal.
- Texto ampliado al 200%.
- Movimiento normal.
- Movimiento reducido.

### Conectividad

- Con conexión estable.
- Red lenta.
- Sin conexión con datos guardados.
- Sin conexión sin datos guardados.
- Recuperación después de volver la conexión.

### Cuenta y contenido

- Usuario nuevo.
- Usuario sin plan.
- Plan pendiente.
- Lectura completada hoy.
- Usuario atrasado.
- Usuario adelantado.
- Plan terminado.
- Oración vacía.
- Muchos pedidos de oración.
- Sin grupos.
- Miembro de grupo.
- Administrador de grupo.

## Validaciones obligatorias

- Build, lint y pruebas automatizadas.
- Navegación completa con teclado.
- Foco visible y devolución de foco en diálogos.
- Lectores de pantalla en flujos principales.
- Contraste.
- Teclado móvil sobre formularios y sheets.
- Safe areas en dispositivos iOS.
- Apertura desde rutas profundas.
- Inicio PWA en frío y caliente.
- Instalación y actualización de la PWA.
- Ausencia de saltos de layout importantes.
- Comparación visual antes y después.

## Entregable

- Tabla de escenarios probados.
- Resultado de cada prueba.
- Capturas comparativas representativas.
- Regresiones corregidas.
- Riesgos pendientes clasificados por impacto.
- Recomendación explícita: listo para publicar o no listo para publicar.

## Criterios de aceptación

- No quedan problemas críticos conocidos.
- Los criterios de todas las fases anteriores siguen cumpliéndose.
- Las tareas principales funcionan con teclado y texto ampliado.
- El inicio no contiene demoras artificiales.
- El modelo de progreso es consistente en todas las pantallas.
- La recomendación de publicación está respaldada por pruebas concretas.

## Prompt para ChatGPT Luna

```text
Ejecuta únicamente la Fase 7 de PLAN_MEJORAS_UX_POR_FASES.md.

Realiza una auditoría final completa sin incorporar funciones nuevas. Prueba la aplicación con toda la matriz responsive, temas, texto ampliado, teclado, movimiento reducido, conectividad y estados de usuario definidos en la fase. Corrige solo regresiones y problemas de publicación comprobables.

Ejecuta lint, tests y build. Entrega una tabla de resultados, capturas comparativas, riesgos pendientes y una recomendación explícita sobre si la aplicación está lista para publicar.
```

---

# Seguimiento general

| Fase | Descripción | Estado | Dependencia |
|---|---|---|---|
| 0 | Línea base y contrato de producto | Completada | Ninguna |
| 1 | Inicio rápido y promesa clara | Completada | Ninguna |
| 2 | Modelo de avance | Completada | Fase 0 aprobada |
| 3 | Navegación predecible | Completada | Fase 2 recomendada |
| 4 | Accesibilidad y controles | Pendiente | Fase 3 recomendada |
| 5 | Simplificación de Oración y Grupos | Pendiente | Fases 3 y 4 |
| 6 | Estados, offline y feedback | Pendiente | Fases anteriores estables |
| 7 | QA y preparación para publicar | Pendiente | Fases 0–6 completadas |

## Orden de ejecución recomendado

1. Fase 0.
2. Fase 1.
3. Fase 2.
4. Punto de control y aprobación manual del modelo de avance.
5. Fase 3.
6. Fase 4.
7. Fase 5.
8. Fase 6.
9. Fase 7.

## Registro de decisiones

Completar esta sección después de cada fase para que las siguientes conversaciones de ChatGPT Luna no pierdan contexto.

### Fase 0

- Fecha: 2026-07-16
- Decisiones: el día principal de Hoy es el día del plan; puede adelantarse respecto del calendario. El heatmap es historial visual no editable. No se separan ajustar posición y registrar lectura.
- Archivos o documentos generados: contrato actualizado en este plan.
- Pendientes: ninguno para el contrato.

### Fase 1

- Fecha: 2026-07-16
- Decisiones: el splash se retira cuando la pantalla real está lista, sin esperar 2,5 segundos. La bienvenida explica que la app acompaña la Biblia física. Hoy mantiene la interfaz limpia; el destino externo de las referencias se comunica mediante etiquetas accesibles, sin texto visible ni iconos repetidos.
- Archivos modificados: `index.html`, `src/components/LaunchReady.jsx`, `src/screens/onboarding/AuthFlow.jsx`, `src/screens/Hoy.jsx`, `src/components/PassageList.jsx`, `src/i18n/es.json`, `src/i18n/en.json`, `src/i18n/pt.json`.
- Pruebas: `npm run lint` (sin errores; 3 warnings preexistentes), `npm test` (4/4), `npm run build` (correcto), salida del splash verificada a 300 ms/1300 ms y revisión visual de Hoy en escritorio.
- Pendientes: probar manualmente la bienvenida en una sesión sin autenticar y revisar arranque offline en un dispositivo real.

### Fase 2

- Fecha: 2026-07-16
- Decisiones: se conserva el modelo de avance adelantado. Se explicitan día del plan, día calendario y estado adelantado en Hoy, Progreso y Ajustes. El heatmap no se convierte en editor.
- Archivos modificados: `src/hooks/useReading.js`, `src/screens/Hoy.jsx`, `src/screens/Progreso.jsx`, `src/screens/Ajustes.jsx`, `src/i18n/es.json`, `src/i18n/en.json`, `src/i18n/pt.json`.
- Pruebas: `npm run lint` (sin errores; 3 warnings preexistentes), `npm test` (4/4), `npm run build` (correcto), verificación visual en móvil 390×844 y rutas Hoy/Progreso/Ajustes.
- Pendientes: añadir una suite específica de escenarios de avance cuando se incorpore infraestructura de pruebas de UI; la cobertura actual no altera contratos de datos.

### Fase 3

- Fecha: 2026-07-16
- Decisiones: se mantienen cuatro pestañas primarias. Ajustes queda accesible desde Hoy en móvil y al pie del sidebar en escritorio; no se agregan accesos duplicados desde Oración, Grupos o Progreso. Los regresos conservan el origen real cuando se entra a detalles.
- Archivos modificados: `src/components/TodayExtraRows.jsx`, `src/screens/Grupos.jsx`, `src/screens/Oracion.jsx`, `src/screens/Planes.jsx` y este plan.
- Pruebas: navegación verificada en móvil 390×844, tablet 768×1024 y escritorio 1440×900; sidebar con Progreso activo en `/recorrido`; regreso contextual desde `/planes/10`; `npm run lint` (sin errores; 3 warnings preexistentes), `npm test` (4/4), `npm run build` (correcto).
- Pendientes: ninguno dentro del alcance aprobado.

### Fase 4

- Fecha:
- Decisiones:
- Archivos modificados:
- Pruebas:
- Pendientes:

### Fase 5

- Fecha:
- Decisiones:
- Archivos modificados:
- Pruebas:
- Pendientes:

### Fase 6

- Fecha:
- Decisiones:
- Archivos modificados:
- Pruebas:
- Pendientes:

### Fase 7

- Fecha:
- Resultado final:
- Pruebas:
- Riesgos aceptados:
- Decisión de publicación:
