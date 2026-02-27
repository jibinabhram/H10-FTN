import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { STORAGE_KEYS } from '../../utils/constants';
import { hydrateSQLiteFromBackend } from '../../services/hydrateMetrics.service';
import { syncPendingMetrics } from '../../services/syncMetrics.service';
import { syncPendingSessions } from '../../services/sessionMetadataSync.service';

interface AuthContextType {
  role: string | null;
  clubId: string | null;
  isAuthenticated: boolean;
  setAuth: (payload: { role: string; token: string; clubId?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  clubId: null,
  isAuthenticated: false,
  setAuth: async () => { },
  logout: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [authRestored, setAuthRestored] = useState(false);

  /* ---------------------------------
     1️⃣ Restore session ONCE
  ----------------------------------*/
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const storedRole = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
      const storedClubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);

      if (token && storedRole) {
        setRole(storedRole);
        setClubId(storedClubId);
        setIsAuthenticated(true);
      }

      setAuthRestored(true); // 🔑 CRITICAL
    })();
  }, []);

  /* ---------------------------------
     2️⃣ Hydrate SQLite ONCE after auth
  ----------------------------------*/
  useEffect(() => {
    if (!authRestored) return;
    if (!isAuthenticated) return;
    if (hydrated) return;

    hydrateSQLiteFromBackend()
      .then(() => setHydrated(true))
      .catch(err => console.log('❌ AuthContext: Hydration error', err));
  }, [authRestored, isAuthenticated, hydrated]);

  /* ---------------------------------
     3️⃣ Auto-sync when online
  ----------------------------------*/
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log('🌐 Internet detected → syncing data...');
        syncPendingSessions()
          .then(() => syncPendingMetrics())
          .catch(err => console.log('🔄 Background sync error:', err));
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  /* ---------------------------------
     4️⃣ Login handler
  ----------------------------------*/
  const setAuth = async ({ role, token, clubId }: { role: string; token: string; clubId?: string }) => {
    const pairs: [string, string][] = [
      [STORAGE_KEYS.TOKEN, token],
      [STORAGE_KEYS.ROLE, role],
    ];

    if (clubId) {
      pairs.push([STORAGE_KEYS.CLUB_ID, clubId]);
      setClubId(clubId);
    }

    await AsyncStorage.multiSet(pairs);

    setRole(role);
    setIsAuthenticated(true);
  };

  /* ---------------------------------
     5️⃣ Logout
  ----------------------------------*/
  const logout = async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.ROLE,
      STORAGE_KEYS.USER_NAME,
      STORAGE_KEYS.CLUB_ID,
    ]);

    setRole(null);
    setClubId(null);
    setIsAuthenticated(false);
    setHydrated(false);
  };

  return (
    <AuthContext.Provider value={{ role, clubId, isAuthenticated, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
