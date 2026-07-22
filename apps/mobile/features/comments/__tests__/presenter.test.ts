import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  authorDisplayName,
  toCommentView,
} from '../presenter';
import type { CommentRow } from '../schemas';

const NOW = new Date('2026-07-20T12:00:00Z');

const row = (over: Partial<CommentRow> = {}): CommentRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  parking_id: '22222222-2222-4222-8222-222222222222',
  author_id: '33333333-3333-4333-8333-333333333333',
  body: 'Buen sitio, cabe una custom',
  upvotes_count: 2,
  created_at: '2026-07-20T11:59:30Z',
  author: {
    display_name: 'Rider X',
    username: 'riderx',
    avatar_url: null,
    current_level: 3,
  },
  ...over,
});

describe('formatRelativeTime', () => {
  it('muestra "hace un momento" para <60s', () => {
    expect(formatRelativeTime('2026-07-20T11:59:30Z', NOW)).toBe('hace un momento');
  });
  it('muestra minutos', () => {
    expect(formatRelativeTime('2026-07-20T11:45:00Z', NOW)).toBe('hace 15 min');
  });
  it('muestra horas', () => {
    expect(formatRelativeTime('2026-07-20T09:00:00Z', NOW)).toBe('hace 3 h');
  });
  it('muestra días', () => {
    expect(formatRelativeTime('2026-07-18T12:00:00Z', NOW)).toBe('hace 2 d');
  });
  it('devuelve cadena vacía para fecha inválida', () => {
    expect(formatRelativeTime('no-es-fecha', NOW)).toBe('');
  });
});

describe('authorDisplayName', () => {
  it('usa display_name', () => {
    expect(authorDisplayName(row())).toBe('Rider X');
  });
  it('cae a username si no hay display_name', () => {
    expect(authorDisplayName(row({ author: { display_name: null, username: 'riderx', avatar_url: null, current_level: 1 } }))).toBe('riderx');
  });
  it('cae a anónimo si no hay autor', () => {
    expect(authorDisplayName(row({ author: null }))).toBe('Motero anónimo');
  });
});

describe('toCommentView', () => {
  it('marca canDelete cuando el viewer es el autor', () => {
    const v = toCommentView(row(), '33333333-3333-4333-8333-333333333333', NOW);
    expect(v.canDelete).toBe(true);
    expect(v.authorName).toBe('Rider X');
    expect(v.upvotes).toBe(2);
  });
  it('no permite borrar a otro usuario', () => {
    const v = toCommentView(row(), 'otro-usuario', NOW);
    expect(v.canDelete).toBe(false);
  });
  it('no permite borrar a un invitado (sin sesión)', () => {
    const v = toCommentView(row(), undefined, NOW);
    expect(v.canDelete).toBe(false);
  });
});
