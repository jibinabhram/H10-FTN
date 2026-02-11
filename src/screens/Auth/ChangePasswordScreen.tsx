import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import SuperAdminNavbar from '../../components/Navbar/SuperAdminNavbar';
import SidebarSuperAdmin, {
  ScreenType,
} from '../../components/Sidebar/SidebarSuperAdmin';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';

const ChangePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === 'dark';

  /* SIDEBAR */
  const [activeScreen, setActiveScreen] =
    useState<ScreenType>('Settings');
  const [collapsed, setCollapsed] = useState(false);

  /* FORM */
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert({
        title: 'Error',
        message: 'All fields are required',
        type: 'warning',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        title: 'Error',
        message: 'Passwords do not match',
        type: 'warning',
      });
      return;
    }

    showAlert({
      title: 'Success',
      message: 'Password updated successfully',
      type: 'success',
      buttons: [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]
    });
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: isDark ? '#020617' : '#F1F5F9' },
      ]}
    >
      {/* NAVBAR */}
      <SuperAdminNavbar />

      <View style={styles.body}>
        {/* SIDEBAR */}
        <SidebarSuperAdmin
          active={activeScreen}
          setActive={setActiveScreen}
          collapsed={collapsed}
          toggleSidebar={() => setCollapsed(v => !v)}
        />

        {/* CONTENT */}
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { backgroundColor: isDark ? '#020617' : '#F1F5F9' },
          ]}
        >
          {/* HEADER ROW */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[
                styles.backBtn,
                {
                  backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="arrow-back"
                size={18}
                color={isDark ? '#E5E7EB' : '#020617'}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.pageTitle,
                { color: isDark ? '#E5E7EB' : '#020617' },
              ]}
            >
              Change Password
            </Text>
          </View>

          <Text
            style={[
              styles.pageSub,
              { color: isDark ? '#94A3B8' : '#64748b' },
            ]}
          >
            Update your account password
          </Text>

          {/* FORM CARD (FULL WIDTH) */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
            ]}
          >
            {/* CURRENT PASSWORD */}
            <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>
              Current Password
            </Text>
            <TextInput
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter current password"
              placeholderTextColor={isDark ? '#64748b' : '#94A3B8'}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#020617' : '#FFFFFF',
                  color: isDark ? '#E5E7EB' : '#020617',
                },
              ]}
            />

            {/* NEW PASSWORD */}
            <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>
              New Password
            </Text>
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={isDark ? '#64748b' : '#94A3B8'}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#020617' : '#FFFFFF',
                  color: isDark ? '#E5E7EB' : '#020617',
                },
              ]}
            />

            {/* CONFIRM PASSWORD */}
            <Text style={[styles.label, { color: isDark ? '#E5E7EB' : '#020617' }]}>
              Confirm New Password
            </Text>
            <TextInput
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={isDark ? '#64748b' : '#94A3B8'}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#020617' : '#FFFFFF',
                  color: isDark ? '#E5E7EB' : '#020617',
                },
              ]}
            />

            {/* BUTTON */}
            <TouchableOpacity
              style={styles.updateBtnSmall}
              onPress={handleChangePassword}
            >
              <Ionicons name="key-outline" size={16} color="#fff" />
              <Text style={styles.updateTextSmall}>Update Password</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default ChangePasswordScreen;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  root: { flex: 1 },

  body: {
    flex: 1,
    flexDirection: 'row',
  },

  content: {
    flexGrow: 1,
    padding: 24,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
  },

  pageSub: {
    fontSize: 14,
    marginBottom: 20,
  },

  formCard: {
    borderRadius: 18,
    padding: 24,
    width: '100%',

  },


  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },

  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },


  updateBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },

  updateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  updateBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },

  updateTextSmall: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

});
