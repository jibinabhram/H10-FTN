import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../components/context/ThemeContext';
import SidebarSuperAdmin, {
  ScreenType,
} from '../../components/Sidebar/SidebarSuperAdmin';
import SuperAdminNavbar from '../../components/Navbar/SuperAdminNavbar';

/* ===== SCREENS ===== */
import CreateClub from './CreateClub';
import ClubManagementScreen from './ClubManagementScreen';
import PodManagementScreen from './PodManagementScreen';
import PodholderManagementScreen from './PodholderManagementScreen';
import SettingsScreen from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import DashboardScreen from './DashboardScreen';
import PaymentScreen from './PaymentScreen';
import SupportTicketsScreen from './SupportTicketsScreen';

const SuperAdminHome = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeScreen, setActiveScreen] =
    useState<ScreenType>('Dashboard');

  const [collapsed, setCollapsed] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'Dashboard':
        return <DashboardScreen onNavigate={setActiveScreen} />;

      case 'ClubManagement':
        return (
          <ClubManagementScreen
            openCreateClub={() => setActiveScreen('CreateClub')}
          />
        );

      case 'CreateClub':
        return (
          <CreateClub
            goBack={() => setActiveScreen('ClubManagement')}
          />
        );

      case 'PodholderManagement':
        return <PodholderManagementScreen />;

      case 'PodManagement':
        return <PodManagementScreen />;

      case 'Payment':
        return <PaymentScreen />;

      case 'SupportTickets':
        return <SupportTicketsScreen />;

      case 'Settings':
        return (
          <SettingsScreen
            goBack={() => setActiveScreen('Dashboard')}
          />
        );

      case 'ProfileEdit':
        return (
          <ProfileEditScreen
            goBack={() => {
              setProfileRefreshKey(prev => prev + 1); // 🔥 THIS LINE
              setActiveScreen('Dashboard');
            }}
          />
        );

      default:
        return <DashboardScreen onNavigate={setActiveScreen} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]} edges={['top']}>
      <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
        {/* ===== NAVBAR ===== */}
        <View style={styles.navbarWrapper}>
          <SuperAdminNavbar
            key={profileRefreshKey}
            toggleSidebar={() => setCollapsed(v => !v)}
            onNavigate={setActiveScreen}
            profileRefreshKey={profileRefreshKey}
          />
        </View>

        {/* ===== BODY ===== */}
        <View style={styles.body}>
          {/* ===== SIDEBAR ===== */}
          <SidebarSuperAdmin
            active={activeScreen}
            setActive={setActiveScreen}
            collapsed={collapsed}
            toggleSidebar={() => setCollapsed(v => !v)}
          />

          {/* ===== CONTENT ===== */}
          <View style={[styles.content, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
            {renderScreen()}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SuperAdminHome;

/* ===== STYLES ===== */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  navbarWrapper: {
    height: 56,
    zIndex: 10,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
});
