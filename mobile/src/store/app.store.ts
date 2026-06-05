// Global app state — Zustand store
// Zustand is chosen over Redux for simplicity and low overhead.
// State is split into clear domains.

import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────
export interface Route {
  id: string;
  name: string;
  shortCode?: string;
  originName: string;
  destinationName: string;
  distanceKm?: number;
  dataConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  dataAgeDays?: number;
  isDataFresh: boolean;
  operatingHours?: any;
  frequencyMinutes?: number;
  fare?: {
    minZAR: number;
    maxZAR: number;
    typicalZAR?: number;
    confidence: string;
    source?: string;
  };
  eta?: { min: number; base: number; max: number };
  isPeakHours?: boolean;
  stops?: any[];
  relevanceScore: number;
}

export interface Stop {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  distanceKm?: number;
}

export interface CrowdReport {
  id: string;
  type: string;
  severity: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  trustScore: number;
  upvotes: number;
  createdAt: string;
  expiresAt: string;
  routeId?: string;
  stopId?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

// ── App Store ──────────────────────────────────────────────────
interface AppStore {
  // ── Network ─────────────────────────────────────────────────
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;

  // ── Location ─────────────────────────────────────────────────
  userLocation: UserLocation | null;
  locationPermissionDenied: boolean;
  setUserLocation: (loc: UserLocation | null) => void;
  setLocationPermissionDenied: (v: boolean) => void;

  // ── Search ───────────────────────────────────────────────────
  searchOrigin: string;
  searchDestination: string;
  searchResults: Route[];
  isSearching: boolean;
  searchError: string | null;
  setSearchOrigin: (v: string) => void;
  setSearchDestination: (v: string) => void;
  setSearchResults: (routes: Route[]) => void;
  setIsSearching: (v: boolean) => void;
  setSearchError: (err: string | null) => void;

  // ── Selected route ───────────────────────────────────────────
  selectedRoute: Route | null;
  setSelectedRoute: (r: Route | null) => void;

  // ── Nearby stops ─────────────────────────────────────────────
  nearbyStops: Stop[];
  setNearbyStops: (stops: Stop[]) => void;

  // ── Live reports ─────────────────────────────────────────────
  activeReports: CrowdReport[];
  addReport: (r: CrowdReport) => void;
  removeReport: (id: string) => void;
  setActiveReports: (reports: CrowdReport[]) => void;

  // ── Offline sync ─────────────────────────────────────────────
  lastSyncedAt: string | null;
  isSyncing: boolean;
  syncError: string | null;
  setLastSyncedAt: (v: string | null) => void;
  setIsSyncing: (v: boolean) => void;
  setSyncError: (err: string | null) => void;

  // ── Language ─────────────────────────────────────────────────
  language: string;
  setLanguage: (lang: string) => void;

  // ── Current city ─────────────────────────────────────────────
  currentCity: string;
  setCurrentCity: (slug: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isOnline: true,
  setIsOnline: (v) => set({ isOnline: v }),

  userLocation: null,
  locationPermissionDenied: false,
  setUserLocation: (loc) => set({ userLocation: loc }),
  setLocationPermissionDenied: (v) => set({ locationPermissionDenied: v }),

  searchOrigin: '',
  searchDestination: '',
  searchResults: [],
  isSearching: false,
  searchError: null,
  setSearchOrigin: (v) => set({ searchOrigin: v }),
  setSearchDestination: (v) => set({ searchDestination: v }),
  setSearchResults: (routes) => set({ searchResults: routes }),
  setIsSearching: (v) => set({ isSearching: v }),
  setSearchError: (err) => set({ searchError: err }),

  selectedRoute: null,
  setSelectedRoute: (r) => set({ selectedRoute: r }),

  nearbyStops: [],
  setNearbyStops: (stops) => set({ nearbyStops: stops }),

  activeReports: [],
  addReport: (r) => set((s) => ({ activeReports: [r, ...s.activeReports.slice(0, 49)] })),
  removeReport: (id) => set((s) => ({ activeReports: s.activeReports.filter((r) => r.id !== id) })),
  setActiveReports: (reports) => set({ activeReports: reports }),

  lastSyncedAt: null,
  isSyncing: false,
  syncError: null,
  setLastSyncedAt: (v) => set({ lastSyncedAt: v }),
  setIsSyncing: (v) => set({ isSyncing: v }),
  setSyncError: (err) => set({ syncError: err }),

  language: 'en',
  setLanguage: (lang) => set({ language: lang }),

  currentCity: 'johannesburg',
  setCurrentCity: (slug) => set({ currentCity: slug }),
}));
