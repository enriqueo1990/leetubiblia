# Lee Tu Biblia en Google Play (TWA)

Guía paso a paso para publicar la PWA en Play Store como **Trusted Web Activity**:
una app de Android que abre `leetubiblia.com` a pantalla completa, sin barra del
navegador. Costo: **USD 25, pago único**.

**Qué NO cambia:** la app es la misma web. Cada deploy a Netlify llega solo a
Android; a Play se vuelve únicamente para cambiar ícono/nombre o subir el nivel
de API que Google exige una vez por año (antes del 31 de agosto).

**Lo que ya quedó listo en el código:**
- `isStoreApp()` (`src/lib/platform.js`) reconoce la TWA por `?source=twa` y por
  el referrer `android-app://`. Dentro de la app de Play se ocultan la meta de
  donación y "Apoyar la misión" (Google exige su propio cobro para donaciones al
  desarrollador). La web sigue mostrándolas.
- Los avisos de "instalá la app" no aparecen: la TWA corre en modo standalone.
- El recordatorio (Web Push) sigue funcionando: Chrome se lo delega a la app.

---

## 1. Cuenta de Google Play Console (vos)

1. Entrá a <https://play.google.com/console/signup> con tu cuenta de Google.
2. Tipo de cuenta: **Personal**. (Organización evita la prueba de 12 testers,
   pero exige número D-U-N-S: solo si una iglesia/fundación la publica.)
3. Pagá los USD 25 y completá la verificación de identidad (documento). Puede
   tardar unos días.

## 2. Generar la app con Bubblewrap (en tu Mac)

Requiere Node (ya lo tenés). Bubblewrap baja el JDK y el SDK de Android solo la
primera vez (~1 GB).

```bash
npm install -g @bubblewrap/cli
```

```bash
mkdir -p ~/Documents/Proyectos/leetubiblia-android
```

```bash
cd ~/Documents/Proyectos/leetubiblia-android && bubblewrap init --manifest=https://leetubiblia.com/manifest.webmanifest
```

Respuestas a las preguntas (lo que no figura, dejalo por defecto):

| Pregunta | Valor |
|---|---|
| Domain | `leetubiblia.com` |
| URL path (start URL) | `/?source=twa` ← **importante**, es lo que oculta las donaciones |
| Application name | `Lee Tu Biblia` |
| Short name | `Lee Tu Biblia` |
| Application ID (package) | `com.leetubiblia.app` (no se puede cambiar después) |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#F8F7F4` |
| Splash screen color | `#F8F7F4` |
| Icon URL | `https://leetubiblia.com/icons/icon-512.png` |
| Maskable icon URL | `https://leetubiblia.com/icons/maskable-512.png` |
| Monochrome icon | (vacío) |
| Include support for Play Billing | **No** |
| Request geolocation permission | **No** |
| Enable notifications (notification delegation) | **Sí** |
| Key store location / alias | por defecto (`android.keystore`, `android`) |

> **Guardá `android.keystore` y sus contraseñas en un lugar seguro** (gestor de
> contraseñas + copia fuera de la Mac). Sin eso no podés subir actualizaciones.
> Esa carpeta NO va a este repo.

Compilar:

```bash
cd ~/Documents/Proyectos/leetubiblia-android && bubblewrap build
```

Sale `app-release-bundle.aab` (lo que se sube a Play) y `app-release-signed.apk`
(para probar en un Android por cable o mandándolo por WhatsApp).

## 3. Vincular el dominio (Digital Asset Links)

Sin esto la app se abre con barra de navegador arriba.

1. En Play Console › tu app › **Configuración › Integridad de la app › Firma de
   apps**, copiá la **huella SHA-256 del certificado de firma de apps**.
2. Pasámela y creo `public/.well-known/assetlinks.json` con este contenido:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.leetubiblia.app",
      "sha256_cert_fingerprints": ["AA:BB:…la huella de Play…"]
    }
  }
]
```

3. Deploy y verificar que <https://leetubiblia.com/.well-known/assetlinks.json>
   responda ese JSON.

> Si además probás el APK firmado con tu llave local, sumá también la huella de
> `bubblewrap fingerprint list` en el mismo arreglo.

## 4. Ficha de Play Store

**Nombre:** Lee Tu Biblia

**Descripción breve (80 caracteres):**
> Plan de lectura, racha, diario y oración en grupo para tu Biblia de papel.

**Descripción completa:**
> Lee Tu Biblia te ayuda a sostener el hábito de abrir tu Biblia cada día. No es
> otro lector de Escritura: acompaña tu Biblia de papel.
>
> • Planes de lectura: 13 planes, cortos y largos, con los minutos por día a la vista.
> • Racha y progreso: ves cuántos días llevás y por dónde vas.
> • Diario: anotá qué te habló Dios hoy.
> • Oración: tus pedidos, privados o compartidos con tu grupo. Marcá cuándo fueron respondidos.
> • Grupos de discipulado: lean al mismo ritmo, anímense y oren unos por otros.
> • Recordatorio diario a la hora que elijas.
>
> Privada por defecto, sin publicidad y sin vender tus datos. Podés borrar tu
> cuenta y todo lo tuyo cuando quieras.

**Categoría:** Libros y obras de consulta (o Estilo de vida).
**Correo de contacto:** el de `src/lib/developer.js`.
**Política de privacidad:** `https://leetubiblia.com/privacidad`
**Ícono 512×512:** `public/icons/icon-512.png`
**Gráfico destacado 1024×500:** se puede sacar del `og-info.png` (te lo armo).
**Capturas de teléfono:** mínimo 2 (ideal 4–6): Hoy, Planes, Oración, Grupo, Progreso.

## 5. Formularios obligatorios

**Seguridad de los datos** (Data safety):

| Dato | ¿Se recopila? | Para qué | ¿Opcional? |
|---|---|---|---|
| Dirección de correo | Sí | Cuenta | No |
| Nombre | Sí | Funciones de la app (grupos) | Sí |
| Contenido del usuario (pedidos, diario, testimonios) | Sí | Funciones de la app | Sí |
| Actividad en la app (lecturas, progreso) | Sí | Funciones de la app, estadísticas | No |
| Diagnóstico (errores de arranque) | Sí | Estadísticas | No |
| ID de dispositivo u otros (id anónimo del embudo) | Sí | Estadísticas | No |
| Ubicación | **No** (solo país, sin IP ni GPS) | — | — |

- ¿Se comparten datos con terceros? **No** (Supabase y Netlify son proveedores
  del servicio, no "compartir").
- ¿Cifrados en tránsito? **Sí**.
- ¿Se pueden borrar? **Sí**, desde Ajustes › Borrar cuenta.

**Clasificación de contenido:** cuestionario IARC → referencia religiosa, sin
violencia, sin compras, con **interacción entre usuarios** (grupos cerrados por
invitación).

**Público objetivo:** 18+ (evita los requisitos extra de apps para menores).

**Anuncios:** No contiene anuncios.

## 6. Prueba cerrada: 12 testers durante 14 días

Obligatoria para cuentas personales nuevas antes de producción.

1. Creá un Grupo de Google (ej. `testers-leetubiblia@googlegroups.com`) y sumá
   al menos **12 personas con Android** (miembros de tus grupos, los líderes
   del mensaje de `marketing/mensaje-lideres.md`).
2. Play Console › Pruebas › **Prueba cerrada** › crear pista › agregar el grupo
   › subir el `.aab`.
3. Compartí el link de suscripción. Cada tester tiene que **aceptar e instalar**
   desde ese link, y tener la app instalada los 14 días.
4. Pasados 14 días con 12+ testers activos: **Solicitar acceso a producción**
   (preguntan cómo fue la prueba: contestá con lo que te digan los testers).

## 7. Actualizar después

- **Cambios de la app:** nada. Deploy a Netlify como siempre.
- **Cambiar ícono, nombre o colores:** editar `twa-manifest.json`, subir
  `appVersionCode` y `bubblewrap update && bubblewrap build`, subir el `.aab`.
- **Nivel de API anual:** Play avisa por correo. `bubblewrap update` trae el
  target nuevo; compilar y subir.
