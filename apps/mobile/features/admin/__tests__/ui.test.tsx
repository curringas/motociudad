import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  Pagination,
  BulkBar,
  Checkbox,
  SearchInput,
  CommentStatusBadge,
  Button,
} from '../ui';

// Renderizado como web vía react-native-web (convención del proyecto).

describe('Pagination', () => {
  it('muestra el rango y el total', () => {
    render(<Pagination page={0} pageSize={25} total={148} onPage={vi.fn()} />);
    expect(screen.getByText('Mostrando 1–25 de 148')).toBeTruthy();
  });
  it('muestra "Sin resultados" con total 0', () => {
    render(<Pagination page={0} pageSize={25} total={0} onPage={vi.fn()} />);
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });
  it('cambia de página al pulsar un número', () => {
    const onPage = vi.fn();
    render(<Pagination page={0} pageSize={25} total={148} onPage={onPage} />);
    fireEvent.click(screen.getByLabelText('Página 2'));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});

describe('BulkBar', () => {
  it('no se muestra sin selección', () => {
    const { container } = render(<BulkBar count={0} onClear={vi.fn()}><Button label="Aprobar" onPress={vi.fn()} /></BulkBar>);
    expect(container.textContent).toBe('');
  });
  it('muestra el número de seleccionados', () => {
    render(<BulkBar count={3} onClear={vi.fn()}><Button label="Aprobar" onPress={vi.fn()} /></BulkBar>);
    expect(screen.getByText('3 seleccionados')).toBeTruthy();
  });
});

describe('Checkbox', () => {
  it('invoca onToggle', () => {
    const onToggle = vi.fn();
    render(<Checkbox checked={false} onToggle={onToggle} label="Seleccionar" />);
    fireEvent.click(screen.getByLabelText('Seleccionar'));
    expect(onToggle).toHaveBeenCalled();
  });
});

describe('SearchInput', () => {
  it('propaga el texto', () => {
    const onChangeText = vi.fn();
    render(<SearchInput value="" onChangeText={onChangeText} placeholder="Buscar…" />);
    fireEvent.change(screen.getByLabelText('Buscar…'), { target: { value: 'moto' } });
    expect(onChangeText).toHaveBeenCalledWith('moto');
  });
});

describe('CommentStatusBadge', () => {
  it('etiqueta según estado', () => {
    const { rerender } = render(<CommentStatusBadge status="approved" />);
    expect(screen.getByText('Aprobado')).toBeTruthy();
    rerender(<CommentStatusBadge status="pending_review" />);
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });
});
