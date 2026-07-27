import { describe, it, expect } from 'vitest';
import { nickSchema, citySuggestionSchema, citySearchResponseSchema } from '../schemas';

describe('nickSchema', () => {
  it('acepta un nick válido', () => {
    expect(nickSchema.safeParse('curro_23').success).toBe(true);
    expect(nickSchema.safeParse('moto.rider-1').success).toBe(true);
  });

  it('rechaza nicks demasiado cortos', () => {
    expect(nickSchema.safeParse('ab').success).toBe(false);
  });

  it('rechaza nicks demasiado largos', () => {
    expect(nickSchema.safeParse('x'.repeat(31)).success).toBe(false);
  });

  it('rechaza caracteres no permitidos', () => {
    expect(nickSchema.safeParse('con espacio').success).toBe(false);
    expect(nickSchema.safeParse('emoji😀').success).toBe(false);
    expect(nickSchema.safeParse('a/b').success).toBe(false);
  });

  it('recorta espacios antes de validar', () => {
    const r = nickSchema.safeParse('  curro  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('curro');
  });
});

describe('citySuggestionSchema', () => {
  it('valida una sugerencia estructurada', () => {
    const r = citySuggestionSchema.safeParse({
      name: 'Málaga',
      region: 'Andalucía',
      country: 'España',
      country_code: 'ES',
      lat: 36.72,
      lng: -4.42,
      label: 'Málaga, España',
    });
    expect(r.success).toBe(true);
  });

  it('acepta region nula', () => {
    const r = citySuggestionSchema.safeParse({
      name: 'Berlín',
      region: null,
      country: 'Alemania',
      country_code: 'DE',
      lat: 52.5,
      lng: 13.4,
      label: 'Berlín, Alemania',
    });
    expect(r.success).toBe(true);
  });

  it('parsea la respuesta { results: [...] }', () => {
    const r = citySearchResponseSchema.safeParse({ results: [] });
    expect(r.success).toBe(true);
  });
});
