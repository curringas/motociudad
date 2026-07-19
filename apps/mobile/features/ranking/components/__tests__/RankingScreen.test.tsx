import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// expo-router is native-only; stub the router used by the sign-in button.
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Supabase client throws at import without env vars; the auth gate never hits it.
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

// react-native-safe-area-context ships untranspiled source under Vitest;
// render its views as plain passthroughs.
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { RankingScreen } from '../RankingScreen';
import { useSessionStore } from '@/stores/sessionStore';

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RankingScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSessionStore.setState({ session: null, user: null, isLoading: false });
});

describe('RankingScreen auth gate', () => {
  it('sin sesión muestra el prompt de inicio de sesión, no un error de carga', () => {
    renderScreen();

    expect(screen.getByText('Inicia sesión para ver el ranking')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Iniciar sesión/ }),
    ).toBeTruthy();
    // No debe aparecer el mensaje de error de carga.
    expect(screen.queryByText(/No se pudo cargar el ranking/)).toBeNull();
  });

  it('mientras la sesión carga muestra un indicador, no el prompt', () => {
    useSessionStore.setState({ session: null, user: null, isLoading: true });
    renderScreen();

    expect(screen.queryByText('Inicia sesión para ver el ranking')).toBeNull();
  });
});
