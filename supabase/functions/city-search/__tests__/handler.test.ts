/**
 * Tests unitarios para city-search: validación de entrada y normalización de
 * las sugerencias de Nominatim (sin red).
 *
 * Run: deno test __tests__/handler.test.ts
 */

import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { MIN_QUERY_LENGTH, parseCitySearch } from "../schemas.ts";
import { normalizeNominatim } from "../nominatim.ts";

// ── parseCitySearch ───────────────────────────────────────────
Deno.test("parseCitySearch: acepta una consulta válida", () => {
  const r = parseCitySearch({ q: "malaga" });
  assertEquals(r.success, true);
});

Deno.test("parseCitySearch: recorta espacios", () => {
  const r = parseCitySearch({ q: "  berlin  " });
  if (!r.success) throw new Error("debería ser válido");
  assertEquals(r.data.q, "berlin");
});

Deno.test("parseCitySearch: rechaza entrada no-objeto", () => {
  const r = parseCitySearch("malaga");
  assertEquals(r.success, false);
});

Deno.test("parseCitySearch: rechaza q no-string", () => {
  const r = parseCitySearch({ q: 42 });
  assertEquals(r.success, false);
});

Deno.test("MIN_QUERY_LENGTH es 2", () => {
  assertEquals(MIN_QUERY_LENGTH, 2);
});

// ── normalizeNominatim ────────────────────────────────────────
const MALAGA = {
  lat: "36.7213",
  lon: "-4.4213",
  name: "Málaga",
  addresstype: "city",
  address: {
    city: "Málaga",
    state: "Andalucía",
    country: "España",
    country_code: "es",
  },
};

const BERLIN = {
  lat: "52.5200",
  lon: "13.4050",
  name: "Berlín",
  addresstype: "city",
  address: {
    city: "Berlín",
    country: "Alemania",
    country_code: "de",
  },
};

const A_ROAD = {
  lat: "40.0",
  lon: "-3.0",
  name: "A-42",
  addresstype: "road",
  address: { road: "A-42", country: "España", country_code: "es" },
};

Deno.test("normalizeNominatim: mapea una ciudad con etiqueta 'Ciudad, País'", () => {
  const out = normalizeNominatim([MALAGA]);
  assertEquals(out.length, 1);
  assertEquals(out[0]?.name, "Málaga");
  assertEquals(out[0]?.country, "España");
  assertEquals(out[0]?.country_code, "ES");
  assertEquals(out[0]?.region, "Andalucía");
  assertEquals(out[0]?.label, "Málaga, España");
  assertEquals(out[0]?.lat, 36.7213);
});

Deno.test("normalizeNominatim: incluye ciudades internacionales", () => {
  const out = normalizeNominatim([BERLIN]);
  assertEquals(out.length, 1);
  assertEquals(out[0]?.label, "Berlín, Alemania");
});

Deno.test("normalizeNominatim: descarta resultados que no son ciudad (carreteras)", () => {
  const out = normalizeNominatim([A_ROAD]);
  assertEquals(out.length, 0);
});

Deno.test("normalizeNominatim: de-duplica por etiqueta", () => {
  const out = normalizeNominatim([MALAGA, { ...MALAGA }]);
  assertEquals(out.length, 1);
});

Deno.test("normalizeNominatim: entrada no-array → []", () => {
  assertEquals(normalizeNominatim(null), []);
  assertEquals(normalizeNominatim({}), []);
});

Deno.test("normalizeNominatim: descarta items sin país o coordenadas", () => {
  const noCountry = { lat: "1", lon: "1", addresstype: "city", address: { city: "X" } };
  const noCoords = { name: "Y", addresstype: "city", address: { city: "Y", country: "Z" } };
  assertEquals(normalizeNominatim([noCountry, noCoords]).length, 0);
});
