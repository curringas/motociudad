import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommentItem } from '../CommentItem';
import { CommentList } from '../CommentList';
import type { CommentView } from '../../presenter';

// Rendered as web via the react-native → react-native-web alias (vitest.config.ts)
// with @testing-library/react, matching the project's component-test convention.

const view = (over: Partial<CommentView> = {}): CommentView => ({
  id: 'c1',
  authorId: 'u1',
  authorName: 'Rider X',
  authorLevel: 3,
  body: 'Cabe una custom sin problema',
  upvotes: 2,
  timeLabel: 'hace 5 min',
  canDelete: false,
  ...over,
});

describe('CommentItem', () => {
  it('muestra autor, cuerpo y upvotes', () => {
    render(<CommentItem comment={view()} onUpvote={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Rider X')).toBeTruthy();
    expect(screen.getByText(/Cabe una custom/)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('oculta el botón Borrar si no es el autor', () => {
    render(<CommentItem comment={view({ canDelete: false })} onUpvote={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Borrar')).toBeNull();
  });

  it('muestra Borrar si es el autor y lo invoca', () => {
    const onDelete = vi.fn();
    render(<CommentItem comment={view({ canDelete: true })} onUpvote={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Borrar'));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('invoca onUpvote al pulsar el voto', () => {
    const onUpvote = vi.fn();
    render(<CommentItem comment={view()} onUpvote={onUpvote} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Votar útil este comentario'));
    expect(onUpvote).toHaveBeenCalledWith('c1');
  });
});

describe('CommentList', () => {
  it('muestra el estado vacío incentivando el primer comentario', () => {
    render(<CommentList comments={[]} onUpvote={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Sé el primero en comentar/)).toBeTruthy();
  });

  it('renderiza los comentarios', () => {
    render(
      <CommentList
        comments={[view({ id: 'a', body: 'Uno' }), view({ id: 'b', body: 'Dos' })]}
        onUpvote={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Uno')).toBeTruthy();
    expect(screen.getByText('Dos')).toBeTruthy();
  });
});
