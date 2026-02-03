import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

/**
 * Custom hook for managing pull-to-refresh functionality
 * @param onRefresh - Async function to execute on refresh
 * @param errorMessage - Optional error message to show on failure
 * @returns Object with refreshing state and onRefresh handler
 */
export const useRefreshControl = (
  onRefresh: () => Promise<void>,
  errorMessage = 'Failed to refresh'
) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await onRefresh();
    } catch (e: any) {
      if (!e?.isOffline) {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, errorMessage]);

  return {
    refreshing,
    onRefresh: handleRefresh,
  };
};
