# Datos fuente de los planes de lectura

El generador [`scripts/seed.mjs`](../seed.mjs) produce el SQL de seed. Los planes
de 365 días (**M'Cheyne** y **Cronológico**) leen su contenido de archivos de
texto en esta carpeta. **No se inventa contenido bíblico**: si falta el archivo,
el plan se omite.

## Formato

Un archivo por plan, llamado `<slug>.txt`:

- `mcheyne.txt`
- `cronologico.txt`

Reglas:

- **Una línea por día**, en orden: la primera línea es el día 1.
- Referencias de un mismo día separadas por `;`.
- Prefijo opcional `Día N:` al inicio de la línea (se ignora; manda el orden).
- Líneas vacías y las que empiezan con `#` se ignoran (comentarios).
- Nombres de libro en español; el parser ([`usfm.mjs`](../usfm.mjs)) los mapea a
  USFM. Soporta numerados (`1 Crónicas`), acentos y abreviaturas comunes.

### Ejemplo (formato M'Cheyne, 4 pasajes/día)

```
# Día 1
Génesis 1; Mateo 1; Esdras 1; Hechos 1
Génesis 2; Mateo 2; Esdras 2; Hechos 2
Génesis 3; Mateo 3; Esdras 3; Hechos 3
```

### Ejemplo (Cronológico)

```
Génesis 1-2
Génesis 3-5
Génesis 6-9
```

## Fuentes (documento maestro Tarea 2)

- **M'Cheyne:** dominio público (mcheyne.info / calendarios clásicos).
- **Cronológico:** bibliavida.com/planes-lectura/cronologico.html (365 días).

## Regenerar el seed

```bash
node scripts/seed.mjs
```

Genera `supabase/migrations/0003_seed_plans.sql`. Si una línea tiene una
referencia que el parser no reconoce, el script falla indicando plan y línea —
se corrige el dato y se reejecuta.
