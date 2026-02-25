import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

/* ================= MENU CONFIG ================= */

const MENU_ITEMS = [
  {
    key: 'Dashboard',
    label: 'Dashboard',
    icon: 'grid-outline',
  },
  {
    key: 'ClubManagement',
    label: 'Club Management',
    icon: 'business-outline',
  },
  {
    key: 'PodholderManagement',
    label: 'Podholder Management',
    icon: 'people-outline',
  },
  {
    key: 'PodManagement',
    label: 'Pod Management',
    icon: 'hardware-chip-outline',
  },
  {
    key: 'Payment',
    label: 'Payment',
    icon: 'card-outline',
  },
  {
    key: 'SupportTickets',
    label: 'Support Tickets',
    icon: 'help-circle-outline',
  },
  // {
  //   key: 'Settings',
  //   label: 'Settings',
  //   icon: 'settings-outline',
  // },
] as const;


/* ================= TYPES ================= */

export type ScreenType = typeof MENU_ITEMS[number]['key'] | 'ProfileEdit';

interface Props {
  active: ScreenType;
  setActive: (v: ScreenType) => void;
  collapsed: boolean;
  toggleSidebar: () => void;
}

/* ================= COMPONENT ================= */

const SidebarSuperAdmin: React.FC<Props> = ({
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

      {/* MENU ITEMS */}
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

export default SidebarSuperAdmin;

/* ================= STYLES ================= */

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
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
