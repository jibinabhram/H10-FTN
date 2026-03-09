// src/api/axios.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';
import NetInfo from '@react-native-community/netinfo';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

// Attach token
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  error => Promise.reject(error),
);

api.interceptors.response.use(
  response => response,
  async error => {
    // 🌐 OFFLINE HANDLING
    if (!error.response) {
      const netState = await NetInfo.fetch();

      if (!netState.isConnected && netState.isInternetReachable === false) {
        console.log('⚠️ Offline – request blocked');

        return Promise.reject({
          isOffline: true,
          message: 'No internet connection',
        });
      }
    }

    // 🔐 AUTH HANDLING
    if (error.response?.status === 401 || error.response?.status === 403) {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.ROLE,
        STORAGE_KEYS.USER_NAME,
        STORAGE_KEYS.CLUB_ID,
      ]);
      console.log('🔐 Auth expired or Forbidden (Inactive) – user logged out');
    }

    return Promise.reject(error);
  },
);
export default api;
