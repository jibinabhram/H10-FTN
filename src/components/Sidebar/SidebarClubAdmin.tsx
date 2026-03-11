import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { STORAGE_KEYS } from '../../utils/constants';
import { useTheme } from '../context/ThemeContext';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

export type ScreenType =
  | 'Dashboard'
  | 'Players'
  | 'Event'
  | 'CreateEvent'
  | 'AssignPlayers'
  | 'ImportFromESP32'
  | 'Compare'
  | 'Cycle'
  | 'Advice'
  | 'Report'
  | 'ManageEvents'
  | 'TeamSettings'
  | 'TeamSettings'
  | 'Zones'
  | 'TrimSession'
  | 'AddExercise'
  | 'CreatePlayer'
  | 'EditPlayer'
  | 'PodHolders';
const MENU_ITEMS: {
  key: ScreenType;
  label: string;
  icon: string;
}[] = [
    { key: 'Dashboard', label: 'Dashboard', icon: 'grid-outline' },
    { key: 'ManageEvents', label: 'Session', icon: 'calendar-outline' },
    { key: 'Event', label: 'Analyze', icon: 'git-compare-outline' },
    { key: 'Cycle', label: 'Period', icon: 'sync-outline' },
    { key: 'Advice', label: 'Pointers', icon: 'chatbubble-ellipses-outline' },
    { key: 'Report', label: 'Report', icon: 'document-text-outline' },
  ];

interface Props {
  active: ScreenType;
  setActive: (v: ScreenType) => void;
  collapsed: boolean;
  toggleSidebar: () => void;
}

const SidebarClubAdmin: React.FC<Props> = ({
  active,
  setActive,
  collapsed,
  toggleSidebar,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
          backgroundColor: isDark ? '#050816' : '#F3F4F6',
        },
      ]}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          collapsed ? styles.headerCollapsed : styles.headerExpanded,
        ]}
      >
        <TouchableOpacity onPress={toggleSidebar}>
          <Ionicons
            name={collapsed ? 'menu' : 'close'}
            size={22}
            color={isDark ? '#FFFFFF' : '#4B5563'}
          />
        </TouchableOpacity>
      </View>

      {/* MENU */}
      {MENU_ITEMS.map(item => {
        const isActive = active === item.key;

        return (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.item,
              collapsed && styles.itemCollapsed,
              isActive && styles.activeItem,
            ]}
            onPress={() => setActive(item.key)}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={isActive ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')}
            />

            {!collapsed && (
              <Text style={[
                styles.text,
                { color: isActive ? '#FFFFFF' : (isDark ? '#E5E7EB' : '#4B5563') },
                isActive && styles.activeText
              ]}>
                {item.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default SidebarClubAdmin;

/* ===== STYLES ===== */

const styles = StyleSheet.create({
  sidebar: {
    height: '100%',
    paddingTop: 6,
  },
  header: {
    height: 44,
    marginBottom: 10,
  },
  headerExpanded: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  headerCollapsed: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    width: '90%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
  },
  itemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  activeItem: {
    backgroundColor: '#DC2626',
  },
  text: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  activeText: {
    fontWeight: '700',
  },
});
