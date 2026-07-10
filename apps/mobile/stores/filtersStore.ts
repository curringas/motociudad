import { create } from 'zustand';

type ParkingTypeFilter = 'all' | 'public' | 'private';

type FiltersStore = {
  parkingType: ParkingTypeFilter;
  onlyVerified: boolean;
  setType: (type: ParkingTypeFilter) => void;
  setOnlyVerified: (value: boolean) => void;
  resetFilters: () => void;
};

const DEFAULT_STATE = {
  parkingType: 'all' as ParkingTypeFilter,
  onlyVerified: false,
};

export const useFiltersStore = create<FiltersStore>((set) => ({
  ...DEFAULT_STATE,

  setType: (type) => set({ parkingType: type }),

  setOnlyVerified: (value) => set({ onlyVerified: value }),

  resetFilters: () => set(DEFAULT_STATE),
}));
