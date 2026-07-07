---
description: Genera notas de versión en lenguaje de usuario a partir del historial de git, para compartir con los usuarios de Lee Tu Biblia
---

Tu tarea es generar **notas de actualización en lenguaje de usuario** para compartir con los usuarios de la app Lee Tu Biblia.

El argumento opcional `$ARGUMENTS` indica el punto de partida:
- Si es un tag o commit (ej. `v1.3.0`, `a049119`), usa los commits **desde** ahí hasta HEAD.
- Si es una fecha (ej. `2026-06-01`), usa `git log --since`.
- Si está vacío: mira `CHANGELOG_USUARIOS.md`. Si existe y su primera entrada tiene un marcador `<!-- ref: <commit> -->`, arranca desde ahí. Si no existe, usa los últimos ~20 commits.

## Pasos

1. **Recolecta los commits** del rango con `git log --pretty=format:'%h %ad %s' --date=short`. Lee también el cuerpo (`%b`) de los `feat` grandes si el título no basta para entender el beneficio.

2. **Filtra lo que NO le importa al usuario final** — no lo incluyas:
   - `chore:`, regeneración de bundles/migraciones, cambios de build/CI.
   - Todo lo del panel `/admin` (es privado, solo para ti).
   - Refactors internos sin efecto visible.
   - Fixes de cosas que nunca llegaron a producción (bugs corregidos dentro del mismo lote).

3. **Traduce de técnico a beneficio.** El usuario no sabe qué es un "deadlock", un "308" ni un "refactor". Escribe qué gana él. Ejemplos:
   - `fix: deadlock de Supabase que colgaba la 1ª apertura` → *"La app abre bien a la primera, sin quedarse en blanco."*
   - `feat: Catecismo de Keach` → *"Nuevo material de lectura: el Catecismo de Keach."*
   - `refactor: renombra ruta` → (omitir, salvo que cambie una URL que el usuario haya guardado).

4. **Agrupa** en estas secciones (omite las vacías):
   - `✨ Novedades` — funciones nuevas.
   - `💫 Mejoras` — cosas que ya existían y ahora funcionan mejor.
   - `🐛 Correcciones` — errores resueltos que el usuario pudo notar.

5. **Respeta el principio de producto:** la app acompaña la lectura en la Biblia física, no es un lector de Escritura. No describas ninguna función como si mostrara el texto bíblico dentro de la app.

6. **Redacta** con voz cálida, cercana y en segunda persona ("ahora puedes…", "hicimos que…"). Frases cortas. Sin jerga. Máximo una línea por punto.

## Salida

Produce DOS cosas:

**A) Entrada para `CHANGELOG_USUARIOS.md`** (créalo si no existe; si existe, añade la entrada nueva ARRIBA sin borrar las anteriores). Formato:

```markdown
## <número o fecha de versión> — <fecha legible>
<!-- ref: <commit-hash-de-HEAD> -->

### ✨ Novedades
- ...

### 💫 Mejoras
- ...

### 🐛 Correcciones
- ...
```

**B) Versión corta para pegar en WhatsApp / redes** — muéstrala en tu respuesta del chat (no en el archivo), con emojis, 4-6 líneas máximo, tono de anuncio breve. Ejemplo de tono:

> 📖 *Novedades en Lee Tu Biblia*
> ✨ Nuevos materiales de lectura: catecismos de Heidelberg, Spurgeon y Keach.
> 💫 Los líderes ahora ven el pulso de lectura de su grupo.
> 🐛 La app abre más rápido y sin pantallas en blanco.
> ¡Actualiza y sigue leyendo! 🙏

Antes de escribir el archivo, muéstrame en el chat un resumen de qué commits incluiste y cuáles descartaste (y por qué), para que yo pueda ajustar antes de publicar.
