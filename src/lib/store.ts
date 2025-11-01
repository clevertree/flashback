import { create } from 'zustand';

export interface Identity {
  user_id: string;
  org_name: string;
  mspid: string;
  certificate: string;
}

interface AppStore {
  connected: boolean;
  setConnected: (connected: boolean) => void;
  identity: Identity | null;
  setIdentity: (identity: Identity) => void;
  selectedChannel: string | null;
  setSelectedChannel: (channel: string) => void;
  downloads: Map<string, number>;
  setDownloadProgress: (hash: string, progress: number) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
  identity: null,
  setIdentity: (identity) => set({ identity }),
  selectedChannel: null,
  setSelectedChannel: (selectedChannel) => set({ selectedChannel }),
  downloads: new Map(),
  setDownloadProgress: (hash, progress) =>
    set((state) => {
      const downloads = new Map(state.downloads);
      downloads.set(hash, progress);
      return { downloads };
    }),
}));
