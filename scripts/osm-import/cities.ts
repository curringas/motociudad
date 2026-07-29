/**
 * Catálogo de ciudades importables. Para añadir una ciudad nueva basta con
 * añadir una entrada aquí (slug + etiqueta + bounding box) y ejecutar el script
 * con su `--city <slug>`. El bounding box se obtiene, p. ej., en
 * https://boundingbox.klokantech.com/ (formato: south,west,north,east).
 */

export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type City = {
  /** Identificador en kebab-case usado en `--city`. */
  slug: string;
  /** Etiqueta que se guarda en `parkings.city`. */
  city: string;
  bbox: BBox;
};

export const CITIES: City[] = [
  {
    slug: "cordoba",
    city: "Córdoba",
    // Casco urbano de Córdoba (medido: la consulta por area[name] da 504).
    bbox: { south: 37.83, west: -4.85, north: 37.92, east: -4.70 },
  },
  {
    slug: "sevilla",
    city: "Sevilla",
    // Casco urbano de Sevilla.
    bbox: { south: 37.32, west: -6.05, north: 37.45, east: -5.90 },
  },
  {
    slug: "madrid",
    city: "Madrid",
    // Madrid capital (aprox. dentro de la M-40).
    bbox: { south: 40.33, west: -3.84, north: 40.52, east: -3.58 },
  },
  {
    slug: "barcelona",
    city: "Barcelona",
    // Barcelona ciudad (del puerto al Carmel/Horta).
    bbox: { south: 41.32, west: 2.05, north: 41.47, east: 2.23 },
  },
];

export function findCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function citySlugs(): string[] {
  return CITIES.map((c) => c.slug);
}
