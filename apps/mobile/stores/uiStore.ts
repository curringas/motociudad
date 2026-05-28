import { create } from 'zustand';

type MapCenter = { lat: number; lng: number };

type UiStore = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mapCenter: MapCenter | null;
  setMapCenter: (center: MapCenter) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  activeTab: 'map',
  setActiveTab: (tab) => set({ activeTab: tab }),
  mapCenter: null,
  setMapCenter: (center) => set({ mapCenter: center }),
}));
