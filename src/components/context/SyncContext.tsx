import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { syncSessionToPodholder } from '../../services/sessionSync.service';
import { useSnackbar } from './SnackbarContext';
import { DeviceEventEmitter } from 'react-native';

interface SyncContextType {
    isSyncing: boolean;
    syncingSessionId: string | null;
    startSync: (sessionId: string) => Promise<boolean>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncingSessionId, setSyncingSessionId] = useState<string | null>(null);
    const { showSnackbar } = useSnackbar();

    // Use a ref to track the current syncing state to avoid stale closure issues if needed,
    // though useState is generally fine for UI.
    const isSyncingRef = useRef(false);

    const startSync = useCallback(async (sessionId: string) => {
        if (isSyncingRef.current) {
            showSnackbar({ message: "A synchronization is already in progress.", type: 'warning' });
            return false;
        }

        try {
            setIsSyncing(true);
            isSyncingRef.current = true;
            setSyncingSessionId(sessionId);

            console.log(`[SyncContext] Starting background sync for session: ${sessionId}`);

            const result = await syncSessionToPodholder(sessionId);

            console.log(`[SyncContext] Sync completed for session: ${sessionId}`);

            showSnackbar({
                message: "Sync completed successfully!",
                type: 'success',
            });

            // Emit an event so screens can refresh if they care
            DeviceEventEmitter.emit('SYNC_COMPLETED', { sessionId, success: true });

            return true;
        } catch (error) {
            console.error(`[SyncContext] Sync failed for session ${sessionId}:`, error);

            showSnackbar({
                message: "Sync failed. Data is saved locally.",
                type: 'error',
            });

            DeviceEventEmitter.emit('SYNC_COMPLETED', { sessionId, success: false, error });
            return false;
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
            setSyncingSessionId(null);
        }
    }, [showSnackbar]);

    return (
        <SyncContext.Provider value={{ isSyncing, syncingSessionId, startSync }}>
            {children}
        </SyncContext.Provider>
    );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (context === undefined) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
};
