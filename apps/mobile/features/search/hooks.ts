import { useMutation } from '@tanstack/react-query';
import { geocodeAddress, type GeocodeResult } from './api';

/**
 * Mutation wrapper around geocodeAddress. Exposes isPending / isError so the
 * search bar can show a spinner and an inline "not found / error" message.
 */
export function useGeocodeSearch() {
  return useMutation<GeocodeResult | null, Error, string>({
    mutationFn: (query: string) => geocodeAddress(query),
  });
}
