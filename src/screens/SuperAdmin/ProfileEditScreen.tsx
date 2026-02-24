import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  fetchProfile,
  updateSuperAdminProfile,
  uploadSuperAdminImage,
  updateClubAdminProfile,
  uploadClubAdminImage,
} from '../../api/auth';
import { API_BASE_URL } from '../../utils/constants';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';

/* ================= TYPES ================= */
type PickedImage = {
  uri: string;
  name: string;
  type: string;
};

type Role = 'SUPER_ADMIN' | 'CLUB_ADMIN';

interface Props {
  goBack: () => void;
}

/* ================= CONSTANTS ================= */

const PROFILE_CACHE_KEY = 'CACHED_PROFILE';

/* ================= COMPONENT ================= */

const ProfileEditScreen = ({ goBack }: Props) => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === 'dark';
  const isMounted = useRef(true);

  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  //   /* ===== SIDEBAR STATE ===== */
  //   const [activeScreen, setActiveScreen] =
  //     useState<ScreenType>('ProfileEdit');
  //   const [collapsed, setCollapsed] = useState(false);

  /* ===== FORM STATE ===== */
  //   const [superAdminId, setSuperAdminId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  /* ================= HELPERS ================= */

  useEffect(() => {
    if (photoUri) setPhotoError(false); // Reset error when URI changes (e.g. new photo picked)
  }, [photoUri]);

  const hydrateProfile = (profile: any) => {
    if (!profile) return;

    setRole(profile.role);

    if (profile.role === 'SUPER_ADMIN') {
      setUserId(profile.super_admin_id);
    } else {
      setUserId(profile.admin_id);
    }

    setName(profile.name ?? '');
    setEmail(profile.email ?? '');
    setPhone(profile.phone ?? '');

    if (profile.profile_image) {
      setPhotoUri(`${API_BASE_URL}/uploads/${profile.profile_image}`);
    }
  };

  const loadCachedProfile = async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (raw) {
        hydrateProfile(JSON.parse(raw));
      }
    } catch (e) {
      console.log('❌ Failed to load cached profile....', e);
    }
  };

  const saveProfileToCache = async (profile: any) => {
    try {
      await AsyncStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify(profile),
      );
    } catch (e) {
      console.log('❌ Failed to save profile cache', e);
    }
  };

  /* ================= LOAD PROFILE ================= */
  /* ===== CLEANUP ===== */
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /* ===== LOAD PROFILE ===== */
  useEffect(() => {
    let active = true;

    (async () => {
      // 1️⃣ Load cached profile first (OFFLINE SUPPORT)
      await loadCachedProfile();

      // 2️⃣ Check internet
      const net = await NetInfo.fetch();
      if (!net.isConnected) return;

      // 3️⃣ Fetch latest from server
      try {
        const profile = await fetchProfile();
        if (!active || !profile) return;

        hydrateProfile(profile);
        await saveProfileToCache(profile);
      } catch (err) {
        console.log('PROFILE LOAD ERROR', err);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /* ================= IMAGE PICKER ================= */

  const handleChoosePhoto = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      response => {
        if (response.didCancel || response.errorCode) return;

        const asset = response.assets?.[0];
        if (!asset?.uri) return;

        setPhoto({
          uri: asset.uri,
          name: asset.fileName ?? `profile_${Date.now()}.jpg`,
          type: asset.type ?? 'image/jpeg',
        });

        setPhotoUri(asset.uri);
      },
    );
  };

  /* ================= SAVE PROFILE ================= */

  const handleSave = async () => {
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      showAlert({
        title: 'Offline',
        message: 'You are offline. Profile updates require internet.',
        type: 'warning',
      });
      return;
    }

    if (!userId || !role) {
      showAlert({
        title: 'Error',
        message: 'User not found. Please re-login.',
        type: 'error',
      });
      return;
    }

    try {
      // ✅ 1. UPDATE BACKEND
      if (role === 'SUPER_ADMIN') {
        await updateSuperAdminProfile(userId, { name, email, phone });
        if (photo) await uploadSuperAdminImage(userId, photo);
      }

      if (role === 'CLUB_ADMIN') {
        await updateClubAdminProfile(userId, { name, email, phone });
        if (photo) await uploadClubAdminImage(userId, photo);
      }

      // ✅ 2. UPDATE CACHE (THIS WAS MISSING)
      const existing = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};

      const updatedProfile = {
        ...parsed,
        name,
        email,
        phone,
        role,
        profile_image:
          photo
            ? photo.name // optimistic (navbar updates instantly)
            : parsed.profile_image,
      };

      await saveProfileToCache(updatedProfile);

      // ✅ 3. NOTIFY OTHER COMPONENTS (NAVBAR)
      DeviceEventEmitter.emit('PROFILE_UPDATED');

      // ✅ 4. GO BACK
      showAlert({
        title: 'Success',
        message: 'Profile updated successfully',
        type: 'success',
        buttons: [{ text: 'OK', onPress: goBack }],
      });

    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to update profile. Please check your internet connection',
        type: 'error',
      });
    }
  };

  /* ================= UI ================= */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', paddingBottom: 80 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* BACK */}
        <TouchableOpacity style={styles.backRow} onPress={goBack}>
          <Ionicons
            name="arrow-back-outline"
            size={20}
            color={isDark ? '#E5E7EB' : '#020617'}
          />
          <Text
            style={[
              styles.backText,
              { color: isDark ? '#E5E7EB' : '#020617' },
            ]}
          >
            Back
          </Text>
        </TouchableOpacity>

        {/* CARD */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
          ]}
        >
          <Text
            style={[
              styles.title,
              { color: isDark ? '#E5E7EB' : '#020617' },
            ]}
          >
            Edit Profile
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            Manage your personal information
          </Text>

          {/* AVATAR */}
          <TouchableOpacity onPress={handleChoosePhoto}>
            {photoUri && !photoError ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatar}
                onError={() => setPhotoError(true)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={36} color="#9ca3af" />
              </View>
            )}
          </TouchableOpacity>

          {/* FORM */}
          <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>
            Full Name
          </Text>
          <TextInput
            style={[styles.input, { color: isDark ? '#E5E7EB' : '#020617', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
            value={name}
            onChangeText={setName}
            placeholderTextColor={isDark ? '#9CA3AF' : '#D1D5DB'}
          />

          <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>
            Email Address
          </Text>
          <TextInput
            style={[styles.input, { color: isDark ? '#E5E7EB' : '#020617', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
            value={email}
            onChangeText={setEmail}
            placeholderTextColor={isDark ? '#9CA3AF' : '#D1D5DB'}
          />

          <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>
            Phone Number
          </Text>
          <TextInput
            style={[styles.input, { color: isDark ? '#E5E7EB' : '#020617', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
            value={phone}
            onChangeText={setPhone}
            placeholderTextColor={isDark ? '#9CA3AF' : '#D1D5DB'}
          />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ProfileEditScreen;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 24,
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  backText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
  },

  card: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
  },

  subtitle: {
    fontSize: 13,
    marginBottom: 20,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 20,
  },

  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  label: {
    fontSize: 13,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
  },

  saveButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },

  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
