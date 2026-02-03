import React, { useState } from 'react';
import {
  View,
  TextInput,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import api from '../../api/axios';
import { useTheme } from '../../components/context/ThemeContext';

const CreateCoach = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async () => {
    if (!form.name || !form.username || !form.password || !form.confirmPassword) {
      return Alert.alert('Error', 'All fields are required');
    }

    if (form.password !== form.confirmPassword) {
      return Alert.alert('Error', 'Passwords do not match');
    }

    try {
      const payload = {
        coach_name: form.name,
        email: form.username,
        password: form.password,
      };

      console.log('✅ CREATE COACH PAYLOAD:', payload);

      const res = await api.post('/coaches', payload);
      console.log('✅ CREATE COACH RESPONSE:', res.data);

      Alert.alert('Success', 'Coach created successfully');

      setForm({
        name: '',
        username: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      const apiError = err?.response?.data;

      console.log('❌ CREATE COACH ERROR FULL:', apiError || err);

      let message = 'Failed to create coach';

      if (typeof apiError?.message === 'object') {
        message = Object.values(apiError.message).join('\n');
      } else if (typeof apiError?.message === 'string') {
        message = apiError.message;
      } else if (err?.message) {
        message = err.message;
      }

      Alert.alert('Error', message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF', flex: 1 }]}>
      <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Create Coach</Text>

      <TextInput
        placeholder="Coach Name"
        placeholderTextColor={isDark ? '#94A3B8' : '#9CA3AF'}
        style={[styles.input, {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E5E7EB',
          color: isDark ? '#FFFFFF' : '#000000'
        }]}
        value={form.name}
        onChangeText={v => setForm({ ...form, name: v })}
      />

      <TextInput
        placeholder="Username (Email)"
        placeholderTextColor={isDark ? '#94A3B8' : '#9CA3AF'}
        style={[styles.input, {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E5E7EB',
          color: isDark ? '#FFFFFF' : '#000000'
        }]}
        autoCapitalize="none"
        value={form.username}
        onChangeText={v => setForm({ ...form, username: v })}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor={isDark ? '#94A3B8' : '#9CA3AF'}
        style={[styles.input, {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E5E7EB',
          color: isDark ? '#FFFFFF' : '#000000'
        }]}
        secureTextEntry
        value={form.password}
        onChangeText={v => setForm({ ...form, password: v })}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor={isDark ? '#94A3B8' : '#9CA3AF'}
        style={[styles.input, {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E5E7EB',
          color: isDark ? '#FFFFFF' : '#000000'
        }]}
        secureTextEntry
        value={form.confirmPassword}
        onChangeText={v =>
          setForm({ ...form, confirmPassword: v })
        }
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.btnText}>Create Coach</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default CreateCoach;
