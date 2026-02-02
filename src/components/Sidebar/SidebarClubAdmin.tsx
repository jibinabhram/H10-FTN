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
  | 'TeamSettings';
const MENU_ITEMS: {
  key: ScreenType;
  label: string;
  icon: string;
}[] = [
    { key: 'Dashboard', label: 'Dashboard', icon: 'grid-outline' },
    { key: 'Event', label: 'Event', icon: 'calendar-outline' },
    { key: 'Compare', label: 'Compare', icon: 'git-compare-outline' },
    { key: 'Cycle', label: 'Cycle', icon: 'sync-outline' },
    { key: 'Advice', label: 'Advice', icon: 'chatbubble-ellipses-outline' },
    { key: 'Report', label: 'Report', icon: 'document-text-outline' },
    { key: 'Players', label: 'Players', icon: 'people-outline' }
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
  return (
    <View
      style={[
        styles.sidebar,
        { width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH },
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
            color="#FFFFFF"
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
              color={isActive ? '#FFFFFF' : '#9CA3AF'}
            />

            {!collapsed && (
              <Text style={[styles.text, isActive && styles.activeText]}>
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
    backgroundColor: '#050816',
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
    backgroundColor: '#1F2937',
  },
  text: {
    marginLeft: 14,
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
