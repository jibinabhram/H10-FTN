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
  PermissionsAndroid,
  Modal,
  ActivityIndicator,
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
  forgotPassword,
  changePassword,
  resetPassword,
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

  /* ===== FORM STATE ===== */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  /* ===== PASSWORD MODAL STATE ===== */
  const [modalType, setModalType] = useState<'CHANGE' | 'RESET' | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  /* ================= HELPERS ================= */

  useEffect(() => {
    if (photoUri) setPhotoError(false);
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
      const url = profile.profile_image.startsWith('http')
        ? profile.profile_image
        : `${API_BASE_URL}/uploads/${profile.profile_image}`;
      setPhotoUri(url);
      setPhotoError(false);
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
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.log('❌ Failed to save profile cache', e);
    }
  };

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      await loadCachedProfile();

      const net = await NetInfo.fetch();
      if (!net.isConnected) return;

      try {
        const profile = await fetchProfile();
        if (!active || !profile) return;

        hydrateProfile(profile);
        await saveProfileToCache(profile);
      } catch (err) {
        console.log('PROFILE LOAD ERROR', err);
      }
    })();

    return () => { active = false; };
  }, []);

  /* ================= IMAGE PICKER ================= */

  const handleChoosePhoto = async () => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = parseInt(Platform.Version as string, 10);
        if (androidVersion >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            {
              title: 'Photo Access Required',
              message: 'This app needs access to your photos to set a profile picture.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            showAlert({ title: 'Permission Denied', message: 'Photo access is required to upload a profile picture.', type: 'warning' });
            return;
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: 'Photo Access Required',
              message: 'This app needs access to your photos to set a profile picture.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            showAlert({ title: 'Permission Denied', message: 'Photo access is required to upload a profile picture.', type: 'warning' });
            return;
          }
        }
      } catch (err) {
        console.warn('Permission request error:', err);
      }
    }

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
      showAlert({ title: 'Offline', message: 'You are offline. Profile updates require internet.', type: 'warning' });
      return;
    }

    if (!userId || !role) {
      showAlert({ title: 'Error', message: 'User not found. Please re-login.', type: 'error' });
      return;
    }

    try {
      if (role === 'SUPER_ADMIN') {
        await updateSuperAdminProfile(userId, { name, email, phone });
        if (photo) await uploadSuperAdminImage(userId, photo);
      } else {
        await updateClubAdminProfile(userId, { name, email, phone });
        if (photo) await uploadClubAdminImage(userId, photo);
      }

      const existing = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};

      const updatedProfile = {
        ...parsed,
        name,
        email,
        phone,
        role,
        profile_image: photo ? photo.name : parsed.profile_image,
      };

      await saveProfileToCache(updatedProfile);
      DeviceEventEmitter.emit('PROFILE_UPDATED');

      showAlert({
        title: 'Success',
        message: 'Profile updated successfully',
        type: 'success',
        buttons: [{ text: 'OK', onPress: goBack }],
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to update profile.',
        type: 'error',
      });
    }
  };

  /* ================= PASSWORD ACTIONS ================= */

  const openModal = (type: 'CHANGE' | 'RESET') => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    setModalType(type);
  };

  const handleApplyPassword = async () => {
    if (modalType === 'CHANGE' && !oldPassword.trim()) {
      showAlert({ title: 'Required', message: 'Please enter your current password.', type: 'warning' });
      return;
    }
    if (modalType === 'RESET' && !resetToken.trim()) {
      showAlert({ title: 'Required', message: 'Please enter the reset code sent to your email.', type: 'warning' });
      return;
    }
    if (newPassword.length < 6) {
      showAlert({ title: 'Too Short', message: 'New password must be at least 6 characters.', type: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({ title: 'Mismatch', message: 'Passwords do not match.', type: 'warning' });
      return;
    }

    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      showAlert({ title: 'Offline', message: 'Internet connection required.', type: 'warning' });
      return;
    }

    setIsPending(true);
    try {
      if (modalType === 'CHANGE') {
        await changePassword({ oldPassword, newPassword });
      } else {
        await resetPassword({
          token: resetToken.trim().toUpperCase(),
          password: newPassword
        });
      }
      setModalType(null);
      showAlert({ title: 'Success', message: 'Password updated successfully!', type: 'success' });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err?.response?.data?.message || 'Action failed. Please try again.',
        type: 'error',
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleTriggerForgot = async () => {
    if (!email.trim()) {
      showAlert({ title: 'Unknown Email', message: 'Please enter an email address first.', type: 'warning' });
      return;
    }
    setForgotLoading(true);
    try {
      await forgotPassword(email);
      showAlert({ title: 'Sent', message: `Reset link sent to ${email}. If you already have the code, you can use Reset Password.`, type: 'success' });
      // Transition to reset mode automatically if they were in CHANGE mode
      if (modalType === 'CHANGE') setModalType('RESET');
    } catch (err: any) {
      showAlert({ title: 'Error', message: 'Failed to send reset email.', type: 'error' });
    } finally {
      setForgotLoading(false);
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
        <TouchableOpacity style={styles.backRow} onPress={goBack}>
          <Ionicons name="arrow-back-outline" size={20} color={isDark ? '#E5E7EB' : '#020617'} />
          <Text style={[styles.backText, { color: isDark ? '#E5E7EB' : '#020617' }]}>Back</Text>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#020617' }]}>Edit Profile</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Manage your personal information</Text>

          <TouchableOpacity onPress={handleChoosePhoto}>
            {photoUri && !photoError ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} onError={() => setPhotoError(true)} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={36} color="#9ca3af" />
              </View>
            )}
            <View style={styles.cameraOverlay}><Ionicons name="camera" size={14} color="#fff" /></View>
          </TouchableOpacity>

          <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { color: isDark ? '#E5E7EB' : '#020617', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
            value={name} onChangeText={setName} placeholderTextColor={isDark ? '#9CA3AF' : '#D1D5DB'}
          />

          <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>Email Address</Text>
          <TextInput
            style={[styles.input, { color: isDark ? '#E5E7EB' : '#020617', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
            value={email} onChangeText={setEmail} placeholderTextColor={isDark ? '#9CA3AF' : '#D1D5DB'} keyboardType="email-address" autoCapitalize="none"
          />

          <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>Phone Number</Text>
          <TextInput
            style={[styles.input, { color: isDark ? '#E5E7EB' : '#020617', backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }]}
            value={phone} onChangeText={setPhone} placeholderTextColor={isDark ? '#9CA3AF' : '#D1D5DB'} keyboardType="phone-pad"
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: isDark ? '#334155' : '#E2E8F0' }]} onPress={() => openModal('CHANGE')}>
              <Ionicons name="key-outline" size={16} color={isDark ? '#94A3B8' : '#475569'} />
              <Text style={[styles.secondaryBtnText, { color: isDark ? '#94A3B8' : '#475569' }]}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: isDark ? '#334155' : '#E2E8F0' }]} onPress={() => openModal('RESET')}>
              <Ionicons name="refresh-outline" size={16} color={isDark ? '#94A3B8' : '#475569'} />
              <Text style={[styles.secondaryBtnText, { color: isDark ? '#94A3B8' : '#475569' }]}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ====== PASSWORD MODAL ====== */}
      <Modal visible={!!modalType} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2' }]}>
                  <Ionicons name={modalType === 'CHANGE' ? "lock-closed" : "refresh-circle"} size={24} color="#EF4444" />
                </View>
                <TouchableOpacity onPress={() => setModalType(null)}><Ionicons name="close" size={24} color={isDark ? '#94A3B8' : '#64748B'} /></TouchableOpacity>
              </View>

              <Text style={[styles.modalTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {modalType === 'CHANGE' ? 'Change Password' : 'Reset Password'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {modalType === 'CHANGE' ? 'Enter current and new password' : 'Enter the code from your email to reset password'}
              </Text>

              {modalType === 'CHANGE' ? (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>Current Password</Text>
                  <View style={[styles.pwdRow, { backgroundColor: isDark ? '#0F172A' : '#F9FAFB', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <TextInput style={[styles.pwdInput, { color: isDark ? '#F1F5F9' : '#0F172A' }]} value={oldPassword} onChangeText={setOldPassword} secureTextEntry={!showOld} placeholder="Current Password" />
                    <TouchableOpacity onPress={() => setShowOld(!showOld)}><Ionicons name={showOld ? "eye-off" : "eye"} size={20} color="#94A3B8" /></TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>Reset Code (Token)</Text>
                  <View style={[styles.pwdRow, { backgroundColor: isDark ? '#0F172A' : '#F9FAFB', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <TextInput style={[styles.pwdInput, { color: isDark ? '#F1F5F9' : '#0F172A' }]} value={resetToken} onChangeText={setResetToken} placeholder="Enter Code" />
                  </View>
                </>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>New Password</Text>
              <View style={[styles.pwdRow, { backgroundColor: isDark ? '#0F172A' : '#F9FAFB', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <TextInput style={[styles.pwdInput, { color: isDark ? '#F1F5F9' : '#0F172A' }]} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNew} placeholder="New Password" />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}><Ionicons name={showNew ? "eye-off" : "eye"} size={20} color="#94A3B8" /></TouchableOpacity>
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Confirm New Password</Text>
              <View style={[styles.pwdRow, { backgroundColor: isDark ? '#0F172A' : '#F9FAFB', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <TextInput style={[styles.pwdInput, { color: isDark ? '#F1F5F9' : '#0F172A' }]} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} placeholder="Confirm" />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}><Ionicons name={showConfirm ? "eye-off" : "eye"} size={20} color="#94A3B8" /></TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.savePwdBtn, isPending && { opacity: 0.7 }]} onPress={handleApplyPassword} disabled={isPending}>
                {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.savePwdText}>Update Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotBtn} onPress={handleTriggerForgot} disabled={forgotLoading}>
                {forgotLoading ? <ActivityIndicator size="small" color="#EF4444" /> : <Text style={styles.forgotText}>Forgot password? Send email code</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default ProfileEditScreen;

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { marginLeft: 6, fontSize: 15, fontWeight: '600' },
  card: { borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 6 },
  avatarPlaceholder: { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  cameraOverlay: { position: 'absolute', bottom: 8, left: 68, width: 26, height: 26, borderRadius: 13, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  saveButton: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  secondaryBtnText: { fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  modalIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  pwdRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48 },
  pwdInput: { flex: 1, fontSize: 14 },
  savePwdBtn: { backgroundColor: '#EF4444', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  savePwdText: { color: '#fff', fontWeight: '700' },
  forgotBtn: { marginTop: 15, alignItems: 'center' },
  forgotText: { color: '#EF4444', fontSize: 13, fontWeight: '600' }
});
