import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../../api/axios';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';
import { logout } from '../../utils/logout';

interface Props {
  goBack: () => void;
}

const SettingsScreen = ({ goBack }: Props) => {
  const { theme, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  const { showAlert } = useAlert();

  const isDark = theme === 'dark';

  /* SETTINGS STATES */
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [alertSound, setAlertSound] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  /* CHANGE PASSWORD MODAL */
  const [openPassword, setOpenPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const bg = isDark ? '#020617' : '#F1F5F9';
  const cardBg = isDark ? '#0F172A' : '#FFFFFF';
  const text = isDark ? '#E5E7EB' : '#020617';
  const sub = '#64748b';

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert({ title: 'Error', message: 'All fields are required', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({ title: 'Error', message: 'Passwords do not match', type: 'error' });
      return;
    }

    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });

      showAlert({ title: 'Success', message: 'Password updated successfully', type: 'success' });
      setOpenPassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error?.response?.data?.message || 'Failed to update password',
        type: 'error'
      });
    }
  };


  const handleLogout = () => {
    showAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();


            navigation.reset({
              index: 0,
              routes: [{ name: 'AuthLoadingScreen' }],
            });
          },
        },
      ],
    });
  };




  return (
    <>
      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: bg }]}>
        {/* BACK */}
        {/* <TouchableOpacity style={styles.backRow} onPress={goBack}>
          <Ionicons name="arrow-back-outline" size={20} color={text} />
          <Text style={[styles.backText, { color: text }]}>Back</Text>
        </TouchableOpacity> */}

        <Text style={[styles.pageTitle, { color: text }]}>Settings</Text>
        <Text style={styles.pageSub}>Manage your preferences</Text>

        {/* APPEARANCE */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>Appearance</Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Dark Mode</Text>
            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>
        </View>

        {/* NOTIFICATIONS */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>Notifications</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Email</Text>
            <Switch value={emailNotif} onValueChange={setEmailNotif} />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Push</Text>
            <Switch value={pushNotif} onValueChange={setPushNotif} />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Alert Sounds</Text>
            <Switch value={alertSound} onValueChange={setAlertSound} />
          </View>
        </View>

        {/* SECURITY */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>Security</Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: text }]}>Two-Factor Auth</Text>
            <Switch value={twoFA} onValueChange={setTwoFA} />
          </View>

          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setOpenPassword(true)}
          >
            <Ionicons name="key-outline" size={14} color="#fff" />
            <Text style={styles.smallBtnText}>Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* SIGN OUT */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={14} color="#fff" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CHANGE PASSWORD MODAL */}
      <Modal transparent visible={openPassword} animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: text }]}>
              Change Password
            </Text>

            <TextInput
              placeholder="Current Password"
              placeholderTextColor={sub}
              secureTextEntry
              style={[styles.input, { color: text }]}
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <TextInput
              placeholder="New Password"
              placeholderTextColor={sub}
              secureTextEntry
              style={[styles.input, { color: text }]}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor={sub}
              secureTextEntry
              style={[styles.input, { color: text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setOpenPassword(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.updateBtn]}
                onPress={handleUpdatePassword}
              >
                <Text style={styles.updateText}>Update</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </>
  );
};

export default SettingsScreen;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  content: { padding: 24 },

  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { marginLeft: 6, fontSize: 15, fontWeight: '600' },

  pageTitle: { fontSize: 26, fontWeight: '800' },
  pageSub: { color: '#64748b', marginBottom: 24 },

  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  label: { fontSize: 14, fontWeight: '600' },

  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
    marginTop: 6,
  },

  smallBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#991b1b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },

  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },

  modalCard: {
    width: '85%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 16,
    padding: 20,
  },


  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 14,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },

  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },

  cancelBtn: {
    backgroundColor: '#334155', // dark gray
  },

  cancelText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },

  updateBtn: {
    backgroundColor: '#DC2626', // blue
  },

  updateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

});
