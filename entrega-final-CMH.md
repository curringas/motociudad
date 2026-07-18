# Entrega final — CMH

> Bitácora de **nuevas features y correcciones realizadas después de la entrega 2**,
> de cara a la entrega final del máster.
> Autor: Curro Martínez Hidalgo (CMH).

## Punto de partida

La **entrega 2** quedó congelada en la rama `feature-entrega2-CMH`, cuyo estado
en el momento de la entrega fue el commit:

- `b6688df` — *fix(mapa): tipa MAP_STYLE_DARK como MapStyleElement[] para pasar typecheck* (2026-07-11)

Ese commit incluía ya: el merge de iPhone (Octanos en Perfil + mejoras de
verificación) y el fix de tipos del mapa. **Todo lo que aparece en este
documento es posterior a ese punto** y forma parte de la entrega final.

> Nota: el trabajo del buscador (ver abajo) se commiteó sobre la propia rama
> `feature-entrega2-CMH` *después* de su push inicial de entrega 2, y de ahí se
> integró en `main`. Es, por tanto, trabajo de la entrega final aunque
> comparta rama.

---

## Nuevas features

### 1. Buscador de ubicaciones sobre el mapa

Barra de búsqueda fija sobre el mapa que permite escribir una calle o ciudad y
centrar la vista en esa zona para ver los parkings disponibles allí (caso de uso
del "motorista viajero"). Geocoding nativo vía `expo-location` (sin API key ni
billing). Al encontrar la ubicación, solo se recentra el mapa; la recarga de
pins reutiliza el ciclo por región ya existente.

- **Estado:** implementado e integrado en `main`. Verificado en simulador (la
  barra renderiza y se coloca correctamente); pendiente la prueba manual
  end-to-end de teclear y comprobar el centrado.
- **Slice:** `apps/mobile/features/search/` (`api.ts`, `hooks.ts`, `schemas.ts`,
  `components/MapSearchBar.tsx`).
- **Tests:** `features/search/api.ts` cubierto con 4 tests (Vitest,
  `expo-location` mockeado).
- **Specs:** `docs/superpowers/specs/2026-07-11-buscador-mapa-design.md` ·
  `docs/superpowers/plans/2026-07-11-buscador-mapa.md`.
- **Docs actualizados:** `prd.md` (user story + feature F15), `arquitectura.md`
  (nota de forward geocoding), `testing.md` (tests de `features/search`).
- **Commits:** `e74fbe5`, `e5e79a2`, `b80017f`, `c81e290`, `8937f27`,
  `ca13a84`, `42cac40` (2026-07-11).

---

## Correcciones

_(Sin entradas todavía. Se irán añadiendo aquí los fixes posteriores a la
entrega 2.)_

---

## Deuda técnica pendiente

- **Infra de tests (Vitest):** 2 suites fallan por configuración, no por bugs de
  producto (todo el código nuevo pasa):
  - `lib/__tests__/deeplinks.test.ts` — asserts obsoletos respecto a la
    implementación actual de `deeplinks.ts`.
  - `features/parkings/components/__tests__/ParkingMapPin.test.tsx` — RNTL es
    incompatible con Vitest (carga el `react-native` real flow-typed).
  - Además, el script `test` de `apps/mobile` corre en modo watch; para CI usar
    `vitest run`.
- **Verificación manual del buscador:** teclear "Barcelona" en el simulador y
  confirmar el centrado end-to-end.

---

## Mantenimiento de este documento

Cada nueva feature o corrección que entre a partir de aquí se añade en su sección
con: qué hace, estado, ficheros/slice, tests, specs afectadas y commits. Así este
`.md` sirve como resumen de todo lo aportado en la entrega final respecto a la
entrega 2.
