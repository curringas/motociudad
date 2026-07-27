import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/avatars/${path}` },
        }),
      }),
    },
  },
}));

import { Avatar, resolveAvatarUrl } from '../Avatar';

describe('resolveAvatarUrl', () => {
  it('devuelve null cuando no hay url', () => {
    expect(resolveAvatarUrl(null)).toBeNull();
    expect(resolveAvatarUrl(undefined)).toBeNull();
  });

  it('devuelve las URLs http tal cual', () => {
    expect(resolveAvatarUrl('https://x/y.jpg?v=1')).toBe('https://x/y.jpg?v=1');
  });

  it('resuelve un path de bucket a URL pública', () => {
    expect(resolveAvatarUrl('u1/avatar.jpg')).toBe(
      'https://cdn.test/avatars/u1/avatar.jpg',
    );
  });
});

describe('Avatar', () => {
  it('muestra la inicial del nombre cuando no hay imagen', () => {
    render(<Avatar url={null} name="curro" />);
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('usa "?" cuando no hay nombre ni imagen', () => {
    render(<Avatar url={null} name={null} />);
    expect(screen.getByText('?')).toBeTruthy();
  });
});
