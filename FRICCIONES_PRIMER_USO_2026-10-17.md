# Fricciones de primer uso — 2026-10-17

Recorrido como persona nueva en móvil (375×812): landing `/info` → bienvenida → catálogo → crear cuenta (llegué hasta antes de enviar el código), más lectura del código de `Gate`, `AuthFlow`, `AskName`, `ChoosePlanOnboarding`, `OnboardingExtras`, `Hoy`, `Join` y las plantillas de email.

Lo que ya resolvió `PRODUCT_REVIEW.md` (el login ya no crea cuentas sin querer, la zona horaria se sincroniza) no se repite acá.

## Estado (actualizado el 2026-10-17)

Todas las fricciones de este documento tienen un cambio en el código. Lo que queda abierto:
- **#1, invitados en iPhone:** a quien llega por invitación no se le pide instalar antes, porque no está comprobado que la app instalada conserve el código del grupo. Hay que probarlo en un iPhone real.
- **#6, minutos por día:** el catálogo todavía no los muestra; los planes no tienen ese dato.
- **#9, correos:** las plantillas de `supabase/email-templates/` ya cambiaron, pero hay que pegarlas a mano en Supabase (Authentication → Emails).

## El recorrido hoy

Camino solo (sin invitación), contando pantallas hasta ver la primera lectura:

1. Bienvenida → **Empezar**
2. Catálogo de planes → elegir → **Continuar**
3. Crear cuenta → correo → **Enviarme el código**
4. *(salir a la app de correo y volver)* → código → **Entrar**
5. "Paso 1 de 3" · ¿Cómo te llamás?
6. "Activando…" (flash: el paso 2 se aplica solo)
7. "Paso 3 de 3" · Casi listo (recordatorio / agregar a inicio)
8. **Hoy**

Son siete pantallas y un cambio de app antes de ver un pasaje. Cada una está bien hecha por separado; el problema es la suma.

---

## P1 — Lo que más pesa

### 1. En iPhone se entra dos veces y el paso 3 se repite
- La landing dice *"Creá tu cuenta y agregala a tu pantalla de inicio"*, y el onboarding también sugiere instalar **al final**.
- En iOS, la app agregada a inicio **no comparte el almacenamiento con Safari**. Al abrirla desde el ícono vuelve a aparecer la bienvenida: hay que tocar "Ya tengo cuenta", pedir otro código, volver al correo…
- …y después aparece otra vez **"Paso 3 de 3 · Casi listo"**, porque la bandera `ltb.onboarded_extras.<uid>` vive en `localStorage` (`lib/sessionFlags.js`). Lo comprobé: con el almacenamiento vacío, una cuenta ya hecha cae de nuevo en el paso 3.
- Además, en Safari de iOS el recordatorio **siempre falla** (el push necesita la app instalada). Activar el switch lleva sí o sí al error "Agregá la app a la pantalla de inicio".

**Propuesta:** en iOS sin instalar, pedir la instalación **antes** de la cuenta (o justo después de la bienvenida) y no ofrecer el switch del recordatorio en Safari: reemplazarlo por "Instalá la app para recibir el recordatorio". Saltear el paso 3 si el perfil ya existía (por ejemplo `created_at` de hace más de unas horas, `reminder_enabled` ya definido o lecturas marcadas), o guardar la bandera en `profiles`.

### 2. El nombre se pide antes de mostrar nada
`AskName` es obligatorio (mínimo 2 caracteres) y su justificación es *"Así te ven tus grupos…"*. Quien llega a leer solo todavía no tiene grupo y lo vive como un trámite más.

**Propuesta:** pedir el nombre recién al unirse o crear un grupo, o al compartir un pedido de oración. Para quien viene por invitación se puede seguir pidiendo en el onboarding, porque ahí sí tiene sentido. Eso quita una pantalla del camino solo.

### 3. El recordatorio se ofrece en el peor momento
Se pide antes de leer nada, con un texto fijo *"por la mañana (07:00)"*, aunque la persona cambie la hora a las 21:00.

**Propuesta:** sacarlo del onboarding y ofrecerlo **después del primer "Marcar como leído"**: *"¿Te aviso mañana a esta hora?"*, con la hora actual precargada. Es el momento de mayor motivación y la hora real de lectura es el mejor valor por defecto. En iOS sin instalar, ese mismo momento sirve para pedir la instalación. Así el onboarding queda en bienvenida → plan → cuenta → Hoy.

### 4. No se mide dónde se cae la gente
Ningún paso del onboarding llama a `recordDiag`. Hoy no hay forma de saber si la gente abandona en el catálogo, en el correo o en el nombre. Las prioridades de este documento son de criterio, no de datos.

**Propuesta:** registrar eventos `welcome_view`, `explore_view`, `plan_selected`, `code_sent`, `code_verified`, `name_saved`, `extras_done` y `first_mark`, y agregar un embudo en `/admin`, que ya tiene la infraestructura de diagnóstico.

---

## P2 — Fricción notable

### 5. Quien viene invitado igual tiene que decidir un plan personal
Con `/join?code=` el paso 2 muestra el catálogo personal como acción principal ("Empezar") y la invitación como secundaria ("Continuar con la invitación"). Alguien recién invitado puede elegir un plan distinto al del grupo y, con un solo plan activo, después choca. Desde el enlace de WhatsApp hasta ver el grupo pasan unas siete pantallas.

**Propuesta:** en el flujo de invitación, saltear el paso 2 entero y resolver el plan dentro del grupo ("Seguir el plan del grupo").

### 6. El catálogo no ayuda a elegir
- Los tres planes destacados dicen **"Recomendado para empezar"**. Si los tres lo son, la etiqueta no orienta.
- El subtítulo *"Un plan activo a la vez."* es una regla del sistema, no una ayuda para alguien nuevo.
- Al elegir un plan aparece el switch **"Ya venía leyendo este plan"**, que casi nunca aplica a alguien nuevo, y empuja **Continuar** fuera de la pantalla en un teléfono de 812 px.
- Antes de elegir, **Continuar** se ve deshabilitado y no dice por qué.
- No hay ninguna idea del esfuerzo diario ("~5 min por día").

**Propuesta:** un solo plan marcado como *"Si no sabés cuál, empezá por este"*. Cambiar el subtítulo por algo como *"Podés cambiarlo cuando quieras"*. Convertir "Ya venía leyendo" en un link chico que despliega el campo. Mostrar los minutos por día.

### 7. El contador de pasos confunde
"Paso 1 de 3" recién aparece en la quinta pantalla. Con un plan ya elegido, el paso 2 se aplica solo, así que la persona ve **1 de 3 → 3 de 3**.

**Propuesta:** sacar el contador (si se aplican 2 y 3 sobra) o calcularlo según los pasos que de verdad se van a mostrar.

### 8. El primer "Hoy" no explica cómo funciona
La nota *"La app acompaña tu Biblia de papel…"* aparece solo en la bienvenida. En el día 1 se ve una lista de referencias y "Marcar como leído", sin decir cómo se usa: leés en tu Biblia y volvés a marcar. Tocar un pasaje abre YouVersion, el proveedor por defecto, sin aviso previo.

**Propuesta:** una línea quieta, solo mientras `completedCount === 0`: *"Buscá estos pasajes en tu Biblia. Cuando termines, marcá el día."*

---

## P3 — Detalles

9. **Los correos están solo en español** (`supabase/email-templates/`) y el de alta dice *"Bienvenido"*. Una persona con el teléfono en inglés o portugués ve la app en su idioma y el código en español. Como mínimo: un saludo sin género y un texto corto bilingüe o trilingüe.
10. **La tarjeta de instalación de Hoy no aparece en iPhone.** Depende de `beforeinstallprompt`, que solo existe en Chrome y Android. Quien se salteó el paso 3 en iOS no vuelve a ver cómo instalar.
11. **La bienvenida y el formulario repiten "Creá tu cuenta"**: el título y el subtítulo empiezan igual (*"Creá tu cuenta / Creá tu cuenta para guardar…"*).

---

## Orden sugerido

| # | Cambio | Esfuerzo | Efecto |
|---|---|---|---|
| 4 | Embudo de eventos | S | Permite medir todo lo demás |
| 1 | iOS: instalar antes, sin switch de push en Safari, no repetir el paso 3 | M | Elimina el doble login, la mayor fricción |
| 3 | Recordatorio después de la primera marca | M | Una pantalla menos y más gente que lo activa |
| 2 | Nombre diferido a grupos | S | Una pantalla menos |
| 5 | Invitación sin el paso del plan | S | Menos choques de plan |
| 6–8 | Catálogo, contador, pista del día 1 | S | Pulido |

Con 1 a 3 aplicados, el camino solo queda en **bienvenida → plan → correo → código → Hoy**: cuatro pantallas y el cambio de app inevitable.
