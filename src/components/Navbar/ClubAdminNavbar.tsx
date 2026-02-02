import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemeToggle from '../context/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { fetchProfile } from '../../api/auth';
import { API_BASE_URL } from '../../utils/constants';
import { logout } from '../../utils/logout';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

const ClubAdminNavbar: React.FC<Props> = ({ title, onNavigate, }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  /* ===== LOAD PROFILE ===== */
  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1️⃣ Load cached profile
      const cached = await loadCachedProfile();
      if (cached && mounted) {
        setUser(cached);
      }

      // 2️⃣ Fetch from server
      try {
        const profile = await fetchProfile();
        if (!mounted || !profile) return;

        setUser(profile);
        await saveProfileToCache(profile);
      } catch (err) {
        console.log('CLUB NAVBAR PROFILE (offline, using cache)');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [title]);

  /* ===== ACTIONS ===== */

  const handleLogout = () => {
    setProfileOpen(false);
    onNavigate('Logout');
  };

  /* ===== PROFILE IMAGE HANDLING ===== */
  const profileImage =
    user?.profile_image
      ? user.profile_image.startsWith('http')
        ? user.profile_image
        : `${API_BASE_URL}/uploads/${user.profile_image}`
      : null;

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#2F343B"
        barStyle="light-content"
      />

      {/* ===== NAVBAR ===== */}
      <View style={styles.navbar}>
        {/* LOGO (same as SuperAdmin) */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={{ flex: 1 }} />

        {/* THEME */}
        <ThemeToggle />

        {/* USER */}
        {user && (
          <TouchableOpacity
            style={styles.userBtn}
            onPress={() => setProfileOpen(v => !v)}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.avatar}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={34}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.userName}>
              {user.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== DROPDOWN ===== */}
      {profileOpen && (
        <>
          <Pressable
            style={styles.overlay}
            onPress={() => setProfileOpen(false)}
          />

          <View
            style={[
              styles.dropdown,
              { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
            ]}
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
                onNavigate('ManageEvents');
              }}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
              <Text
                style={[
                  styles.dropdownText,
                  { color: isDark ? '#E5E7EB' : '#020617' },
                ]}
              >
                Manage Events
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
                onNavigate('Zones');
              }}
            >
              <Ionicons
                name="speedometer-outline"
                size={18}
                color={isDark ? '#94A3B8' : '#64748B'}
              />
              <Text
                style={[
                  styles.dropdownText,
                  { color: isDark ? '#E5E7EB' : '#020617' },
                ]}
              >
                Zone
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
          </View>
        </>
      )}
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
    backgroundColor: '#2F343B',
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

  userName: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    maxWidth: 100,
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
    borderRadius: 14,
    paddingVertical: 10,
    elevation: 16,
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
    bottom: 0,
  },
});
