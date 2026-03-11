import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
  StatusBar,
  Dimensions,
  DeviceEventEmitter,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../context/ThemeContext';
import { fetchProfile } from '../../api/auth';
import { API_BASE_URL, POD_HOLDER_URL } from '../../utils/constants';
import { logout } from '../../utils/logout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PodHolderDropdown from './PodHolderDropdown';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '../context/NotificationContext';
import { useSync } from '../context/SyncContext';
import { ActivityIndicator } from 'react-native';

const PROFILE_CACHE_KEY = 'CACHED_PROFILE';

const loadCachedProfile = async () => {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveProfileToCache = async (profile: any) => {
  try {
    await AsyncStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify(profile),
    );
  } catch { }
};

const NAVBAR_HEIGHT = 56;

interface Props {
  title: string;
  onNavigate: (screen: 'ProfileEdit' | 'Logout' | 'ManageEvents' | 'TeamSettings' | 'ManagePlayers' | 'Zones') => void;
  onCreateSession?: () => void;
  loadingSession?: boolean;
}

const ClubAdminNavbar: React.FC<Props> = ({ title, onNavigate, onCreateSession, loadingSession }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { isSyncing } = useSync();

  const [profileOpen, setProfileOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { unreadCount } = useNotifications();
  const [hasImageError, setHasImageError] = useState(false);
  const [isPodholderConnected, setIsPodholderConnected] = useState(true);

  // Poll podholder connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${POD_HOLDER_URL}/status`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(tid);
        setIsPodholderConnected(res.ok || res.status < 500);
      } catch {
        setIsPodholderConnected(false);
      }
    };

    checkConnection();
    const intervalId = setInterval(checkConnection, 5000); // Check every 5s

    return () => clearInterval(intervalId);
  }, []);

  /* ===== LOAD PROFILE ===== */
  const fetchUserData = async () => {
    // 1️⃣ Load cached profile
    const cached = await loadCachedProfile();
    if (cached) {
      setUser(cached);
    }

    // 2️⃣ Fetch from server
    try {
      const profile = await fetchProfile();
      if (!profile) return;

      setUser(profile);
      setHasImageError(false);
      await saveProfileToCache(profile);
    } catch (err) {
      console.log('CLUB NAVBAR PROFILE (offline, using cache)');
    }
  };

  useEffect(() => {
    fetchUserData();

    const subscription = DeviceEventEmitter.addListener('PROFILE_UPDATED', fetchUserData);

    return () => {
      subscription.remove();
    };
  }, [title]);

  /* ===== ACTIONS ===== */

  const handleLogout = () => {
    setProfileOpen(false);
    onNavigate('Logout');
  };

  /* ===== PROFILE IMAGE HANDLING ===== */
  // Always derive the full URL from the *current* API_BASE_URL so that
  // an IP change doesn't result in a stale/broken image URL.
  const profileImage = user?.profile_image
    ? user.profile_image.startsWith('http')
      ? user.profile_image            // already full URL (edge case)
      : `${API_BASE_URL}/uploads/${user.profile_image}`
    : null;

  // Reset image error whenever the resolved URL changes (e.g. after an IP change)
  useEffect(() => {
    setHasImageError(false);
  }, [profileImage]);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={isDark ? '#0F172A' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* ===== NAVBAR ===== */}
      <View style={[styles.navbar, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
        {/* LOGO (same as SuperAdmin) */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={{ flex: 1 }} />

        {/* USER */}
        {user && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* SYNC INDICATOR OR CREATE SESSION */}
            {isSyncing ? (
              <View style={[styles.syncIndicator, { backgroundColor: !isPodholderConnected ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)') : (isDark ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)') }]}>
                <ActivityIndicator size="small" color={!isPodholderConnected ? '#DC2626' : '#16A34A'} />
                <Text style={[styles.syncText, { color: !isPodholderConnected ? (isDark ? '#EF4444' : '#B50002') : '#16A34A' }]}>
                  {!isPodholderConnected ? 'Paused' : 'Syncing...'}
                </Text>
              </View>
            ) : (
              isPodholderConnected && onCreateSession && (
                <TouchableOpacity
                  style={[styles.navCreateBtn, loadingSession && { opacity: 0.7 }]}
                  onPress={onCreateSession}
                  disabled={loadingSession}
                >
                  {loadingSession ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="add" size={18} color="#fff" />
                  )}
                  <Text style={styles.navCreateBtnText}>
                    {loadingSession ? "Connecting..." : "Create Session"}
                  </Text>
                </TouchableOpacity>
              )
            )}

            {/* NOTIFICATION ICON */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => {
                setNotifOpen(v => !v);
                setWifiOpen(false);
                setProfileOpen(false);
              }}
            >
              <Ionicons
                name={notifOpen ? "notifications" : "notifications-outline"}
                size={22}
                color={notifOpen ? '#B50002' : (isDark ? '#FFFFFF' : '#020617')}
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* WIFI ICON */}
            <TouchableOpacity
              style={styles.wifiBtn}
              onPress={() => {
                setWifiOpen(v => !v);
                setProfileOpen(false);
                setNotifOpen(false);
              }}
            >
              <Ionicons
                name="wifi-outline"
                size={22}
                color={wifiOpen ? '#B50002' : (isDark ? '#FFFFFF' : '#020617')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userBtn}
              onPress={() => {
                setProfileOpen(v => !v);
                setWifiOpen(false);
                setNotifOpen(false);
              }}
            >
              {profileImage && !hasImageError ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatar}
                  onError={() => setHasImageError(true)}
                />
              ) : (
                <Ionicons
                  name="person-circle-outline"
                  size={34}
                  color={isDark ? '#FFFFFF' : '#020617'}
                />
              )}
              <Text style={[styles.userName, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>
                {user.name}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ===== DROPDOWNS ===== */}
      {(profileOpen || wifiOpen) && (
        <>
          <Pressable
            style={styles.overlay}
            onPress={() => {
              setProfileOpen(false);
              setWifiOpen(false);
            }}
          />

          {wifiOpen && (
            <PodHolderDropdown onClose={() => setWifiOpen(false)} />
          )}

          {profileOpen && (
            <View
              style={[
                styles.dropdown,
                { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
              ]}
            >
              <ScrollView
                showsVerticalScrollIndicator={true}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}
                nestedScrollEnabled={true}
              >
                <Text
                  style={[
                    styles.dropdownTitle,
                    { color: isDark ? '#E5E7EB' : '#020617' },
                  ]}
                >
                  My Account
                </Text>


                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false);
                    onNavigate('ManagePlayers');
                  }}
                >
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={isDark ? '#94A3B8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: isDark ? '#E5E7EB' : '#020617' },
                    ]}
                  >
                    Manage Players
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false);
                    onNavigate('ProfileEdit');
                  }}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={isDark ? '#94A3B8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: isDark ? '#E5E7EB' : '#020617' },
                    ]}
                  >
                    Edit Profile
                  </Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* THEME TOGGLE */}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    toggleTheme();
                  }}
                >
                  <Ionicons
                    name={isDark ? 'sunny-outline' : 'moon-outline'}
                    size={18}
                    color={isDark ? '#94A3B8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: isDark ? '#E5E7EB' : '#020617' },
                    ]}
                  >
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileOpen(false);
                    onNavigate('TeamSettings');
                  }}
                >
                  <Ionicons
                    name="settings-outline"
                    size={18}
                    color={isDark ? '#94A3B8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: isDark ? '#E5E7EB' : '#020617' },
                    ]}
                  >
                    Team Settings
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={handleLogout}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color="#EF4444"
                  />
                  <Text
                    style={[
                      styles.dropdownText,
                      { color: '#EF4444' },
                    ]}
                  >
                    Sign Out
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </>
      )}

      <NotificationDropdown
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </View>
  );
};

export default ClubAdminNavbar;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },

  navbar: {
    height: NAVBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  logo: {
    width: 120,
    height: 36,
  },

  userBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },

  wifiBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(181, 0, 2, 0.05)',
    marginRight: 4,
  },

  userName: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    maxWidth: 100,
  },

  notifBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(181, 0, 2, 0.05)',
    marginRight: 4,
    position: 'relative',
    zIndex: 110,
  },

  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff'
  },

  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900'
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#22D3EE',
  },

  dropdown: {
    position: 'absolute',
    top: NAVBAR_HEIGHT + 6,
    right: 12,
    width: 220,
    maxHeight: 250,
    borderRadius: 14,
    paddingVertical: 10,
    elevation: 16,
    zIndex: 101,
  },

  dropdownTitle: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 14,
    marginBottom: 6,
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  dropdownText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 6,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height,
    zIndex: 99, // Ensure it sits below the dropdown (which is zIndex 100 due to container? No, we should rely on stacking context or explicit z-index)
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncWarningText: {
    marginRight: 8,
  },
  navCreateBtn: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  navCreateBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
