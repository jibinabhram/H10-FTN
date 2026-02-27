import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StatusBar,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemeToggle from '../context/ThemeToggle';
import { fetchProfile } from '../../api/auth';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../../utils/constants';
import { logout } from '../../utils/logout';
import type { ScreenType } from '../Sidebar/SidebarSuperAdmin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '../context/NotificationContext';

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

const { width, height } = Dimensions.get('window');

const NAVBAR_HEIGHT = 56;
const STATUS_BAR_HEIGHT =
  Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;


/* ================= PROPS ================= */
interface Props {
  toggleSidebar?: () => void;
  onNavigate: (screen: ScreenType) => void;
  profileRefreshKey: number;
}

const SuperAdminNavbar = ({
  onNavigate,
  profileRefreshKey,
}: Props) => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const isDark = theme === 'dark';

  const textColor = isDark ? '#E5E7EB' : '#020617';
  const subTextColor = isDark ? '#94A3B8' : '#64748B';
  const dividerColor = isDark ? '#1E293B' : '#CBD5E1';


  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const [user, setUser] = useState<any>(null);

  /* ===== LOAD / REFRESH PROFILE ===== */
  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1️⃣ Load cached profile FIRST
      const cached = await loadCachedProfile();
      if (cached && mounted) {
        setUser(cached);
      }

      // 2️⃣ Try network fetch
      try {
        const profile = await fetchProfile();
        if (!mounted || !profile) return;

        setUser(profile);
        await saveProfileToCache(profile);
      } catch (err) {
        console.log('NAVBAR PROFILE (offline, using cache)');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [profileRefreshKey]);
  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        translucent={false}
        backgroundColor={isDark ? '#0F172A' : '#FFFFFF'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />



      {/* ===== NAVBAR ===== */}
      <View
        style={[
          styles.navbar,
          {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            height: NAVBAR_HEIGHT,
          },
        ]}
      >
        {/* LOGO */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={{ flex: 1 }} />

        {/* NOTIFICATION */}
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => {
            setNotifOpen(v => !v);
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

        {/* THEME */}
        <View style={{ marginLeft: 16 }}>
          <ThemeToggle />
        </View>

        {/* USER */}
        {user && (
          <TouchableOpacity
            style={styles.userBtn}
            onPress={() => {
              setProfileOpen(v => !v);
              setNotifOpen(false);
            }}
          >
            {user.profile_image ? (
              <Image
                source={{
                  uri: `${API_BASE_URL}/uploads/${user.profile_image}`,
                }}
                style={[
                  styles.avatar,
                  { borderColor: '#22D3EE' },
                ]}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={34}
                color={isDark ? '#FFFFFF' : '#020617'}
              />
            )}
            <Text style={[styles.userName, { color: isDark ? '#FFFFFF' : '#020617' }]}>{user.name}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== DROPDOWNS ===== */}
      {profileOpen && (
        <>
          <Pressable
            style={styles.overlay}
            onPress={() => {
              setProfileOpen(false);
            }}
          />


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
                    onNavigate('ProfileEdit');
                  }}
                >
                  <Ionicons name="person-outline" size={18} color={subTextColor} />
                  <Text style={[styles.dropdownText, { color: textColor }]}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={handleLogout}
                >
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                  <Text style={[styles.dropdownText, { color: '#EF4444' }]}>
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

export default SuperAdminNavbar;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { zIndex: 100 },

  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  logo: {
    width: 120,
    height: 36,
  },

  notifBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(181, 0, 2, 0.05)',
    marginRight: 4,
    position: 'relative'
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

  userBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },

  userName: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 100,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
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
    zIndex: 1000,
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
    width,
    height,
    zIndex: 500,
  },
});
