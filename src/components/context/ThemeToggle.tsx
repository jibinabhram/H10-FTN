import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from './ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <TouchableOpacity onPress={toggleTheme} style={{ marginRight: 16 }}>
      <Ionicons
        name={theme === 'dark' ? 'sunny' : 'moon'}
        size={22}
        color={theme === 'dark' ? '#FFFFFF' : '#020617'}
      />
    </TouchableOpacity>
  );
};

export default ThemeToggle;
