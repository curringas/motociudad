import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('expo-router', () => ({
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }),
    },
  },
}));

import { UserChip } from '../UserChip';

describe('UserChip', () => {
  beforeEach(() => push.mockClear());

  it('muestra el nick con prefijo @', () => {
    render(<UserChip userId="u1" name="curro" avatarUrl={null} />);
    expect(screen.getByText('@curro')).toBeTruthy();
  });

  it('navega al perfil al pulsar', () => {
    render(<UserChip userId="u1" name="curro" avatarUrl={null} />);
    fireEvent.click(screen.getByLabelText('Ver perfil de curro'));
    expect(push).toHaveBeenCalledWith('/user/u1');
  });

  it('ejecuta onPress antes de navegar', () => {
    const onPress = vi.fn();
    render(<UserChip userId="u1" name="curro" avatarUrl={null} onPress={onPress} />);
    fireEvent.click(screen.getByLabelText('Ver perfil de curro'));
    expect(onPress).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/user/u1');
  });

  it('usa "Motero anónimo" cuando no hay nombre', () => {
    render(<UserChip userId="u1" name={null} avatarUrl={null} />);
    expect(screen.getByText('@Motero anónimo')).toBeTruthy();
  });
});
