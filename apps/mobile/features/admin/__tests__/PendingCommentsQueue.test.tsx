import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PendingCommentsQueue, pendingAuthorName } from '../components/PendingCommentsQueue';
import type { AdminComment } from '../schemas';

// Rendered as web via react-native-web (same convention as the comments tests).

const comment = (over: Partial<AdminComment> = {}): AdminComment => ({
  id: 'pc1',
  parking_id: 'pk1',
  body: 'Comentario dudoso a revisar',
  created_at: '2026-07-24T10:00:00Z',
  parking: { name: 'Parking Centro' },
  author: { username: 'riderx', display_name: 'Rider X' },
  ...over,
});

describe('pendingAuthorName', () => {
  it('usa display_name, luego username, luego anónimo', () => {
    expect(pendingAuthorName(comment())).toBe('Rider X');
    expect(pendingAuthorName(comment({ author: { username: 'riderx', display_name: null } }))).toBe('riderx');
    expect(pendingAuthorName(comment({ author: null }))).toBe('Motero anónimo');
  });
});

describe('PendingCommentsQueue', () => {
  it('muestra el estado vacío cuando no hay pendientes', () => {
    render(<PendingCommentsQueue comments={[]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/No hay comentarios pendientes/)).toBeTruthy();
  });

  it('muestra el estado de carga', () => {
    render(<PendingCommentsQueue comments={[]} isLoading onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/Cargando cola/)).toBeTruthy();
  });

  it('renderiza cuerpo, autor y parking del pendiente', () => {
    render(<PendingCommentsQueue comments={[comment()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/Comentario dudoso/)).toBeTruthy();
    expect(screen.getByText('Rider X')).toBeTruthy();
    expect(screen.getByText('Parking Centro')).toBeTruthy();
  });

  it('invoca onApprove y onReject con el id', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(<PendingCommentsQueue comments={[comment()]} onApprove={onApprove} onReject={onReject} />);
    fireEvent.click(screen.getByText('Aprobar'));
    expect(onApprove).toHaveBeenCalledWith('pc1');
    fireEvent.click(screen.getByText('Rechazar'));
    expect(onReject).toHaveBeenCalledWith('pc1');
  });
});
