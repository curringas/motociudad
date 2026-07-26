import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommentRow, authorName } from '../components/CommentRow';
import type { AdminComment } from '../schemas';

const comment = (over: Partial<AdminComment> = {}): AdminComment => ({
  id: 'c1',
  body: 'Comentario a moderar sobre el parking',
  moderation_status: 'pending_review',
  upvotes_count: 0,
  created_at: '2026-07-26T10:00:00Z',
  author_id: 'u1',
  username: 'riderx',
  display_name: 'Rider X',
  parking_id: 'p1',
  parking_name: 'Parking Centro',
  city: 'Madrid',
  ...over,
});

describe('authorName', () => {
  it('display_name → username → anónimo', () => {
    expect(authorName(comment())).toBe('Rider X');
    expect(authorName(comment({ display_name: null }))).toBe('riderx');
    expect(authorName(comment({ display_name: null, username: null }))).toBe('Motero anónimo');
  });
});

describe('CommentRow', () => {
  const base = { checked: false, onToggle: vi.fn(), onApprove: vi.fn(), onDelete: vi.fn() };

  it('muestra autor, cuerpo, parking y ciudad', () => {
    render(<CommentRow comment={comment()} {...base} />);
    expect(screen.getByText('Rider X')).toBeTruthy();
    expect(screen.getByText(/Comentario a moderar/)).toBeTruthy();
    expect(screen.getByText(/Parking Centro/)).toBeTruthy();
    expect(screen.getByText(/Madrid/)).toBeTruthy();
  });

  it('un pendiente muestra Aprobar y Eliminar', () => {
    render(<CommentRow comment={comment({ moderation_status: 'pending_review' })} {...base} />);
    expect(screen.getByText('✓ Aprobar')).toBeTruthy();
    expect(screen.getByText('Eliminar')).toBeTruthy();
  });

  it('un aprobado solo muestra Eliminar', () => {
    render(<CommentRow comment={comment({ moderation_status: 'approved' })} {...base} />);
    expect(screen.queryByText('✓ Aprobar')).toBeNull();
    expect(screen.getByText('Eliminar')).toBeTruthy();
  });

  it('invoca los handlers', () => {
    const onApprove = vi.fn();
    const onDelete = vi.fn();
    const onToggle = vi.fn();
    render(<CommentRow comment={comment()} checked={false} onToggle={onToggle} onApprove={onApprove} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('✓ Aprobar'));
    expect(onApprove).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Eliminar'));
    expect(onDelete).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/Seleccionar comentario/));
    expect(onToggle).toHaveBeenCalled();
  });
});
