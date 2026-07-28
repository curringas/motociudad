import { assertEquals } from "jsr:@std/assert";
import { resolveName } from "../naming.ts";
import { buildReverseUrl, extractStreet } from "../nominatim.ts";
import type { OsmParking } from "../osm.ts";

const node = (tags: Record<string, string>): OsmParking => ({
  osmId: "node/1",
  lat: 37.88,
  lng: -4.78,
  tags,
});

Deno.test("resolveName: usa tags.name si existe (sin llamar a Nominatim)", async () => {
  let called = false;
  const reverse = () => {
    called = true;
    return Promise.resolve("No debería usarse");
  };
  const name = await resolveName(node({ name: "Parking mimoTo" }), "Córdoba", reverse);
  assertEquals(name, "Parking mimoTo");
  assertEquals(called, false);
});

Deno.test("resolveName: sin name → reverse-geocode de la calle", async () => {
  const reverse = () => Promise.resolve("Calle Cruz Conde");
  const name = await resolveName(node({}), "Córdoba", reverse);
  assertEquals(name, "Parking moto · Calle Cruz Conde");
});

Deno.test("resolveName: sin name y sin calle → fallback a ciudad", async () => {
  const reverse = () => Promise.resolve(null);
  const name = await resolveName(node({}), "Córdoba", reverse);
  assertEquals(name, "Parking moto · Córdoba");
});

Deno.test("extractStreet: prioriza road; null si no hay dirección utilizable", () => {
  assertEquals(extractStreet({ address: { road: "Av. del Aeropuerto" } }), "Av. del Aeropuerto");
  assertEquals(extractStreet({ address: { pedestrian: "Calle Peatonal" } }), "Calle Peatonal");
  assertEquals(extractStreet({ address: { city: "Córdoba" } }), null);
  assertEquals(extractStreet({}), null);
  assertEquals(extractStreet(null), null);
});

Deno.test("buildReverseUrl: incluye lat/lon y formato jsonv2", () => {
  const url = buildReverseUrl(37.88, -4.78);
  assertEquals(url.includes("lat=37.88"), true);
  assertEquals(url.includes("lon=-4.78"), true);
  assertEquals(url.includes("format=jsonv2"), true);
});
