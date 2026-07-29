import { assertEquals } from "jsr:@std/assert";
import { buildFeatures, buildNotes, mapToParking, parseCapacity } from "../mapping.ts";
import { normalizeOverpass } from "../osm.ts";
import { OSM_ATTRIBUTION, SYSTEM_USER_ID } from "../constants.ts";
import type { OsmParking } from "../osm.ts";

const node = (tags: Record<string, string>): OsmParking => ({
  osmId: "node/1",
  lat: 37.88,
  lng: -4.78,
  tags,
});

Deno.test("parseCapacity: entero positivo, ausente o no numérico", () => {
  assertEquals(parseCapacity("10"), 10);
  assertEquals(parseCapacity(undefined), null);
  assertEquals(parseCapacity("abc"), null);
  assertEquals(parseCapacity("0"), null);
  assertEquals(parseCapacity("-3"), null);
});

Deno.test("buildFeatures: solo booleanos conocidos (sin claves de texto)", () => {
  const f = buildFeatures(node({ covered: "yes", fee: "no", amenity: "motorcycle_parking" }));
  assertEquals(f, { covered: true, free: true });
});

Deno.test("buildFeatures: covered!=yes y fee!=no → objeto vacío", () => {
  const f = buildFeatures(node({ covered: "no", fee: "yes" }));
  assertEquals(f, {});
});

Deno.test("buildNotes: atribución ODbL + osm_id (trazabilidad en notes)", () => {
  assertEquals(
    buildNotes(node({})),
    `${OSM_ATTRIBUTION} · osm:node/1`,
  );
});

Deno.test("mapToParking: defaults type/status, location WKT, autor sistema", () => {
  const p = mapToParking(node({ capacity: "5", covered: "yes" }), {
    city: "Córdoba",
    name: "Parking moto · Calle Test",
  });
  assertEquals(p.type, "public");
  assertEquals(p.location, "POINT(-4.78 37.88)");
  assertEquals(p.city, "Córdoba");
  assertEquals(p.capacity, 5);
  assertEquals(p.proposed_by, SYSTEM_USER_ID);
  assertEquals(p.notes, `${OSM_ATTRIBUTION} · osm:node/1`);
  assertEquals(p.features, { covered: true });
  // features es SOLO booleanos (el cliente valida z.record(z.boolean())).
  for (const v of Object.values(p.features)) assertEquals(typeof v, "boolean");
  // status NO se fija: lo pone el default 'pending' de la BD.
  assertEquals("status" in p, false);
});

Deno.test("normalizeOverpass: node directo y way por centroide, descarta sin coords", () => {
  const out = normalizeOverpass({
    elements: [
      { type: "node", id: 1, lat: 37.88, lon: -4.78, tags: { amenity: "motorcycle_parking" } },
      { type: "way", id: 2, center: { lat: 37.89, lon: -4.79 }, tags: {} },
      { type: "way", id: 3, tags: {} }, // sin center → descartado
    ],
  });
  assertEquals(out.length, 2);
  assertEquals(out[0]?.osmId, "node/1");
  assertEquals(out[1]?.osmId, "way/2");
  assertEquals(out[1]?.lat, 37.89);
});
