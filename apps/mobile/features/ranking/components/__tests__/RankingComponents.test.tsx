import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RankingRow } from '../RankingRow';
import { RankingPodium } from '../RankingPodium';
import { RankingMetricToggle } from '../RankingMetricToggle';
import { RankingScopeTabs } from '../RankingScopeTabs';
import { RankingEmptyState } from '../RankingEmptyState';
import type { RankingEntryView } from '../../presenter';

// Rendered as web via the react-native → react-native-web alias (vitest.config.ts)
// with @testing-library/react, matching the project's component-test convention.

const entry = (over: Partial<RankingEntryView> = {}): RankingEntryView => ({
  id: 'u1',
  rank: 1,
  name: 'Rider X',
  octanos: 120,
  level: 4,
  city: 'Madrid',
  avatarUrl: null,
  ...over,
});

describe('RankingRow', () => {
  it('muestra nombre y Octanos', () => {
    render(<RankingRow entry={entry()} />);
    expect(screen.getByText(/Rider X/)).toBeTruthy();
    expect(screen.getByText(/120/)).toBeTruthy();
  });

  it('marca la fila del usuario actual con "Tú"', () => {
    render(<RankingRow entry={entry()} highlighted />);
    expect(screen.getByText(/Tú/)).toBeTruthy();
  });
});

describe('RankingPodium', () => {
  it('renderiza el top 3', () => {
    render(
      <RankingPodium
        entries={[
          entry({ id: 'a', name: 'Uno' }),
          entry({ id: 'b', name: 'Dos' }),
          entry({ id: 'c', name: 'Tres' }),
          entry({ id: 'd', name: 'Cuatro' }),
        ]}
      />,
    );
    expect(screen.getByText('Uno')).toBeTruthy();
    expect(screen.getByText('Tres')).toBeTruthy();
    expect(screen.queryByText('Cuatro')).toBeNull();
  });

  it('no renderiza nada sin entradas', () => {
    const { container } = render(<RankingPodium entries={[]} />);
    expect(container.querySelector('[aria-label="Podio del ranking"]')).toBeNull();
  });
});

describe('RankingMetricToggle', () => {
  it('llama a onChange con la métrica seleccionada', () => {
    const onChange = vi.fn();
    render(<RankingMetricToggle value="total" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Octanos Este mes/ }));
    expect(onChange).toHaveBeenCalledWith('month');
  });
});

describe('RankingScopeTabs', () => {
  it('llama a onChange con el scope seleccionado', () => {
    const onChange = vi.fn();
    render(<RankingScopeTabs value="global" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Ranking Mi ciudad/ }));
    expect(onChange).toHaveBeenCalledWith('city');
  });
});

describe('RankingEmptyState', () => {
  it('muestra el mensaje', () => {
    render(<RankingEmptyState message="Sin pilotos todavía" />);
    expect(screen.getByText('Sin pilotos todavía')).toBeTruthy();
  });
});
