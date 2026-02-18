import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable, TouchableOpacity, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import SidebarClubAdmin, {
  ScreenType,
} from '../../components/Sidebar/SidebarClubAdmin';
import ClubAdminNavbar from '../../components/Navbar/ClubAdminNavbar';
import ProfileEditScreen from '../SuperAdmin/ProfileEditScreen';
import PerformanceScreen from './PerformanceScreen';
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
import PodHolderManagementScreen from './PodHolderManagementScreen';

import { useTheme } from '../../components/context/ThemeContext';
import ComingSoonScreen from '../../screens/ComingSoonScreen';


const ClubAdminHome = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeScreen, setActiveScreen] =
    useState<ScreenType>('Dashboard');
  const [tabHistory, setTabHistory] = useState<Partial<Record<ScreenType, ScreenType>>>({
    'ManageEvents': 'ManageEvents',
    'Dashboard': 'Dashboard',
    'Event': 'Event',
    'Cycle': 'Cycle',
    'Advice': 'Advice',
    'Report': 'Report',
    'Players': 'Players',
    'PodHolders': 'PodHolders',
  });

  const SCREEN_TO_TAB: Record<string, ScreenType> = {
    'CreateEvent': 'ManageEvents',
    'AssignPlayers': 'ManageEvents',
    'TrimSession': 'ManageEvents',
    'AddExercise': 'ManageEvents',
    'ImportFromESP32': 'ManageEvents',
    'ManageEvents': 'ManageEvents',
    'Dashboard': 'Dashboard',
    'Event': 'Event',
    'Cycle': 'Cycle',
    'Advice': 'Advice',
    'Report': 'Report',
    'Players': 'Players',
    'PodHolders': 'PodHolders',
    'CreatePlayer': 'Players',
    'EditPlayer': 'Players',
  };

  const handleSetScreen = (screen: ScreenType) => {
    // 1. Identify which "Main Tab" this screen belongs to
    const tab = SCREEN_TO_TAB[screen];

    if (tab) {
      // 2. Save this screen as the last page for that tab
      setTabHistory(prev => ({ ...prev, [tab]: screen }));
    }

    // 3. Update the global active screen
    setActiveScreen(screen);
  };

  const handleSidebarClick = (menuKey: ScreenType) => {
    // If we have a stored last-page for this tab, go there. Otherwise, go to root.
    const lastPage = tabHistory[menuKey] || menuKey;
    setActiveScreen(lastPage);
  };

  const [popupScreen, setPopupScreen] =
    useState<'ProfileEdit' | 'ManageEvents' | 'TeamSettings' | 'ManagePlayers' | 'Zones' | null>(null);
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

    setPopupScreen(action);
  };

  /* ================= MODAL RENDER ================= */

  const renderPopupContent = () => {
    if (!popupScreen) return null;

    switch (popupScreen) {
      case 'ProfileEdit':
        return <ProfileEditScreen goBack={() => setPopupScreen(null)} />;
      case 'ManageEvents':
        return (
          <ManageEventsScreen
            openCreateEvent={() => {
              setImportParams(null);
              setPopupScreen(null);
              handleSetScreen('CreateEvent');
            }}
            onEditEvent={(event) => {
              setImportParams({ initialEventData: event });
              setPopupScreen(null);
              handleSetScreen('CreateEvent');
            }}
          />
        );
      case 'ManagePlayers':
        return <ManagePlayersScreen />;
      case 'TeamSettings':
        return <TeamSettingsScreen />;
      case 'Zones':
        return <ZoneSettingsScreen />;
      default:
        return null;
    }
  };

  const GenericProfileModal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => {
    return (
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Ionicons name="close-outline" size={24} color={isDark ? '#FFFFFF' : '#020617'} />
          </TouchableOpacity>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : Dimensions.get('window').height * 0.075}
          >
            <View style={[styles.modalInner, { paddingTop: 0 }]}>
              {children}
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    );
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
        return <PerformanceScreen />;

      case 'TeamSettings':
        return <TeamSettingsScreen />;

      case 'ManageEvents':
        return (
          <ManageEventsScreen
            openCreateEvent={() => {
              setImportParams(null);
              handleSetScreen('CreateEvent');
            }}
            onEditEvent={(event) => {
              console.log("Editing event:", event);
              setImportParams({ initialEventData: event });
              handleSetScreen('CreateEvent');
            }}
          />
        );

      case 'CreateEvent':
        return (
          <CreateEventScreen
            initialData={importParams?.eventDraft ? { ...importParams.eventDraft, file: importParams?.file } : importParams?.initialEventData}
            onUpdateDraft={(draft: any) => {
              setImportParams((prev: any) => ({ ...prev, eventDraft: { ...prev?.eventDraft, ...draft } }));
            }}
            goBack={() => handleSetScreen('ManageEvents')}
            goNext={(params: any) => {
              setImportParams((prev: any) => ({ ...prev, ...params }));
              handleSetScreen('AssignPlayers');
            }}
          />
        );

      /* ================= ASSIGN PLAYERS ================= */
      case 'AssignPlayers': {
        const sId = importParams.sessionId || importParams.file?.replace('.csv', '') || importParams.initialEventData?.session_id;
        return (
          <AssignPlayersForSessionScreen
            file={importParams.file}
            sessionId={sId}
            eventDraft={importParams.eventDraft || importParams.initialEventData}
            initialSearch={importParams?.search}
            goBack={(params: any) => {
              if (params) setImportParams((prev: any) => ({ ...prev, ...params }));
              handleSetScreen('CreateEvent');
            }}
            goNext={(params: any) => {
              const nextParams = { ...params, sessionId: sId };
              setImportParams((prev: any) => ({ ...prev, ...nextParams }));
              handleSetScreen('TrimSession');
            }}
          />
        );
      }

      /* ================= TRIM SESSION ================= */
      case 'TrimSession': {
        const sId = importParams.sessionId || importParams.file?.replace('.csv', '') || importParams.initialEventData?.session_id;
        return (
          <TrimSessionScreen
            file={importParams.file}
            sessionId={sId}
            goBack={() => {
              console.log("[ClubAdminHome] Back from TrimSession -> AssignPlayers");
              handleSetScreen('AssignPlayers');
            }}
            goNext={(params: any) => {
              setImportParams({
                ...importParams,
                sessionId: sId,
                trimStartTs: params.trimStartTs,
                trimEndTs: params.trimEndTs,
              });
              handleSetScreen('AddExercise');
            }}
          />
        );
      }

      /* ================= ADD EXERCISE ================= */
      case 'AddExercise': {
        const sId = importParams.sessionId || importParams.file?.replace('.csv', '') || importParams.initialEventData?.session_id;
        return (
          <AddExerciseScreen
            sessionId={sId}
            trimStartTs={importParams.trimStartTs}
            trimEndTs={importParams.trimEndTs}
            initialListingSearch={importParams?.listingSearch}
            initialModalSearch={importParams?.modalSearch}
            initialModalSelected={importParams?.modalSelected}
            initialExerciseType={importParams?.exerciseType}
            initialMStartRatio={importParams?.mStartRatio}
            initialMEndRatio={importParams?.mEndRatio}
            goBack={(params: any) => {
              if (params) setImportParams((prev: any) => ({ ...prev, ...params }));
              handleSetScreen('TrimSession');
            }}
            goNext={() => handleSetScreen('ManageEvents')}
          />
        );
      }

      /* ================= IMPORT ================= */
      case 'ImportFromESP32':
        return (
          <ImportFromESP32
            {...importParams}
            goBack={() => handleSetScreen('AssignPlayers')}
          />
        );

      /* ================= PLAYERS ================= */
      case 'Players':
        return <ManagePlayersScreen />;

      case 'Zones':
        return (
          <ZoneSettingsScreen />
        );

      case 'PodHolders':
        return <PodHolderManagementScreen />;

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
            active={SCREEN_TO_TAB[activeScreen] || activeScreen as ScreenType}
            setActive={handleSidebarClick}
            collapsed={collapsed}
            toggleSidebar={() => setCollapsed(v => !v)}
          />

          <View style={[styles.content, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
            {renderScreen()}
          </View>
        </View>

        {popupScreen && (
          <GenericProfileModal onClose={() => setPopupScreen(null)}>
            {renderPopupContent()}
          </GenericProfileModal>
        )}
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

  /* ================= MODAL STYLES ================= */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', // Dark semi-transparent
  },
  modalContent: {
    width: Dimensions.get('window').width * 0.9,
    height: Dimensions.get('window').height * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.58,
    shadowRadius: 16.0,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12, // Moved to right to avoid overlap with titles/back buttons on the left
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 6,
    borderRadius: 20,
  },
  modalInner: {
    flex: 1,
    paddingTop: 0, // Removed to eliminate top bar effect
  },
});
