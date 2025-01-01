export interface WalletData {
  address: string;
  balance?: string;
  error?: string;
  checked: boolean;
}

export interface StoredProgress {
  wallets: WalletData[];
  lastUpdated: number;
}

const STORAGE_KEY = 'wallet-checker-progress';

export const storage = {
  saveProgress(wallets: WalletData[]) {
    const data: StoredProgress = {
      wallets,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  loadProgress(): WalletData[] | null {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data) as StoredProgress;
    if (Date.now() - parsed.lastUpdated > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return parsed.wallets;
  },

  clearProgress() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
