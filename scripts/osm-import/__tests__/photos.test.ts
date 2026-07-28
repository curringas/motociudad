import { assertEquals } from "jsr:@std/assert";
import { selectCommonsFile } from "../photos.ts";

Deno.test("selectCommonsFile: usa wikimedia_commons y normaliza el prefijo File:", () => {
  assertEquals(
    selectCommonsFile({ wikimedia_commons: "File:Parking.jpg" }),
    "File:Parking.jpg",
  );
  assertEquals(
    selectCommonsFile({ wikimedia_commons: "Parking.jpg" }),
    "File:Parking.jpg",
  );
});

Deno.test("selectCommonsFile: ignora el tag image genérico", () => {
  assertEquals(
    selectCommonsFile({ image: "https://ejemplo.com/foto.jpg" }),
    null,
  );
});

Deno.test("selectCommonsFile: sin tags de foto → null", () => {
  assertEquals(selectCommonsFile({ amenity: "motorcycle_parking" }), null);
  assertEquals(selectCommonsFile({ wikimedia_commons: "  " }), null);
});
