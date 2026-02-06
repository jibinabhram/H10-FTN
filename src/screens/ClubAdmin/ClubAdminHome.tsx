import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import SidebarClubAdmin, {
  ScreenType,
} from '../../components/Sidebar/SidebarClubAdmin';
import ClubAdminNavbar from '../../components/Navbar/ClubAdminNavbar';
import ProfileEditScreen from '../SuperAdmin/ProfileEditScreen';

import EventsScreen from './EventsScreen';
import CreateEventScreen from './CreateEventScreen';
import AssignPlayersForSessionScreen from '../events/AssignPlayersForSessionScreen';
import TrimSessionScreen from './TrimSessionScreen';
import AddExerciseScreen from './AddExerciseScreen';
import ImportFromESP32 from './ImportFromESP32';

import ManagePlayersScreen from './Players/ManagePlayersScreen';
import ZoneSettingsScreen from './ZoneSettingsScreen';
import { logout } from '../../utils/logout';

import ManageEventsScreen from './ManageEventsScreen';
import TeamSettingsScreen from './TeamSettingsScreen';

import { useTheme } from '../../components/context/ThemeContext';
import ComingSoonScreen from '../../screens/ComingSoonScreen';


const ClubAdminHome = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeScreen, setActiveScreen] =
    useState<ScreenType>('Dashboard');
  const [showProfileEdit, setShowProfileEdit] =
    useState(false);
  const [importParams, setImportParams] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);

  const navigation = useNavigation<any>();

  /* ================= NAV ACTIONS ================= */

  const handleNavigate = (action: 'ProfileEdit' | 'Logout' | 'ManageEvents' | 'TeamSettings' | 'ManagePlayers' | 'Zones') => {
    if (action === 'Logout') {
      (async () => {
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      })();
      return;
    }

    if (action === 'ProfileEdit') {
      setShowProfileEdit(true);
      return; // Ensure we don't switch screen underneath overlay if that's how it behaves, though ProfileEditScreen seems to replace content
    }

    if (action === 'ManageEvents') {
      setActiveScreen('ManageEvents');
      setShowProfileEdit(false); // Close profile edit overlay if open
    }

    if (action === 'TeamSettings') {
      setActiveScreen('TeamSettings');
      setShowProfileEdit(false);
    }
    if (action === 'ManagePlayers') {
      setActiveScreen('Players');
      setShowProfileEdit(false);
    }
    if (action === 'Zones') {
      setActiveScreen('Zones');
    }
  };

  /* ================= SCREEN RENDER ================= */

  const renderScreen = () => {
    switch (activeScreen) {
      case 'Dashboard':
        return <ComingSoonScreen title="Dashboard" />;

      case 'Compare':
        return <ComingSoonScreen title="Compare" />;

      case 'Cycle':
        return <ComingSoonScreen title="Cycle" />;

      case 'Advice':
        return <ComingSoonScreen title="Advice" />;

      case 'Report':
        return <ComingSoonScreen title="Report" />;

      case 'Event':
        return (
          <EventsScreen
            openCreateEvent={() => setActiveScreen('CreateEvent')}
          />
        );

      case 'TeamSettings':
        return <TeamSettingsScreen />;

      case 'ManageEvents':
        return (
          <ManageEventsScreen
            openCreateEvent={() => {
              setImportParams(null);
              setActiveScreen('CreateEvent');
            }}
            onEditEvent={(event) => {
              console.log("Editing event:", event);
              setImportParams({ initialEventData: event });
              setActiveScreen('CreateEvent');
            }}
          />
        );

      case 'CreateEvent':
        return (
          <CreateEventScreen
            initialData={importParams?.initialEventData}
            goBack={() => setActiveScreen('ManageEvents')}
            goNext={(params: any) => {
              setImportParams((prev: any) => ({ ...prev, ...params }));
              setActiveScreen('AssignPlayers');
            }}
          />
        );

      case 'AssignPlayers':
        return (
          <AssignPlayersForSessionScreen
            file={importParams.file}
            sessionId={importParams.file.replace('.csv', '')}
            eventDraft={importParams.eventDraft}
            goBack={() => setActiveScreen('CreateEvent')}
            goNext={(params: any) => {
              setImportParams((prev: any) => ({ ...prev, ...params }));
              setActiveScreen('TrimSession');
            }}
          />
        );

      /* ================= TRIM SESSION ================= */
      case 'TrimSession':
        return (
          <TrimSessionScreen
            file={importParams.file}
            sessionId={importParams.sessionId}
            eventDraft={importParams.eventDraft}
            goBack={() => {
              console.log("[ClubAdminHome] Back from TrimSession -> AssignPlayers");
              setActiveScreen('AssignPlayers');
            }}
            goNext={(params: any) => {
              setImportParams({
                ...importParams,
                sessionId: importParams.file.replace('.csv', ''),
                trimStartTs: params.trimStartTs,
                trimEndTs: params.trimEndTs,
              });
              setActiveScreen('AddExercise');
            }}
          />
        );

      /* ================= ADD EXERCISE ================= */
      case 'AddExercise':
        return (
          <AddExerciseScreen
            sessionId={importParams.sessionId}
            trimStartTs={importParams.trimStartTs}
            trimEndTs={importParams.trimEndTs}
            goBack={() => setActiveScreen('TrimSession')}
            goNext={() => setActiveScreen('Event')}
          />
        );

      /* ================= IMPORT ================= */
      case 'ImportFromESP32':
        return (
          <ImportFromESP32
            {...importParams}
            goBack={() => setActiveScreen('AssignPlayers')}
          />
        );

      /* ================= PLAYERS ================= */
      case 'Players':
        return <ManagePlayersScreen />;

      case 'Zones':
        return (
          <ZoneSettingsScreen />
        );

      default:
        return <ComingSoonScreen title={activeScreen} />;
    }
  };

  /* ================= ROOT ================= */

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]} edges={['top']}>
      <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
        <View style={styles.navbarWrapper}>
          <ClubAdminNavbar
            title={activeScreen}
            onNavigate={handleNavigate}
          />
        </View>

        <View style={styles.body}>
          <SidebarClubAdmin
            active={activeScreen as ScreenType}
            setActive={setActiveScreen}
            collapsed={collapsed}
            toggleSidebar={() => setCollapsed(v => !v)}
          />

          <View style={[styles.content, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
            {showProfileEdit ? (
              <ProfileEditScreen
                goBack={() => setShowProfileEdit(false)}
              />
            ) : (
              renderScreen()
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ClubAdminHome;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  root: { flex: 1 },
  navbarWrapper: { height: 56, zIndex: 10 },
  body: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
