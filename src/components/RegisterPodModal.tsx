import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { createPodsBatch } from '../api/pods';
import { useTheme } from './context/ThemeContext';



type Props = {
  visible: boolean;
  onClose: () => void;
  onRegistered: () => void;
};

const RegisterPodModal = ({ visible, onClose, onRegistered }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [count, setCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  const registerBatch = async () => {
    if (!count || Number(count) <= 0) {
      setError('Enter valid pod count');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await createPodsBatch(Number(count));
      setSuccess(result);
    } catch (e) {
      setError('Pod registration failed.Please turn on your internet');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setCount('');
    setSuccess(null);
    setError(null);
    onClose();
    onRegistered();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Register Pods</Text>

              {!success && (
                <>
                  <TextInput
                    placeholder="Enter Number of pods"
                    placeholderTextColor={isDark ? '#94A3B8' : '#9CA3AF'}
                    keyboardType="numeric"
                    value={count}
                    onChangeText={setCount}
                    style={[{ color: isDark ? '#F8FAFC' : '#0F172A', borderColor: isDark ? '#334155' : '#E5E7EB', borderWidth: 1, padding: 8, marginTop: 12, borderRadius: 8 }]}
                  />

                  {error && <Text style={styles.error}>{error}</Text>}

                  {loading ? (
                    <ActivityIndicator />
                  ) : (
                    <View style={styles.actionRow}>
                      {/* Cancel */}
                      <TouchableOpacity onPress={onClose}>
                        <Text style={[styles.cancelBtn, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Cancel</Text>
                      </TouchableOpacity>

                      {/* Register */}
                      <TouchableOpacity onPress={registerBatch}>
                        <Text style={styles.btn}>Register</Text>
                      </TouchableOpacity>
                    </View>

                  )}
                </>
              )}

              {success && (
                <>
                  <Text style={styles.success}>
                    {count} Pods Registered Successfully 🎉
                  </Text>
                  <View style={styles.btnRow}>
                    <TouchableOpacity onPress={close}>
                      <Text style={styles.btn}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

  );
};

export default RegisterPodModal;


/* ================= STYLES ================= */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000060',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 320,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
  },
  title: { fontSize: 18, fontWeight: '700' },
  label: { marginTop: 10, color: '#6B7280' },
  value: { fontWeight: '700', marginTop: 4 },
  waitText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#9CA3AF',
  },
  error: {
    marginTop: 16,
    textAlign: 'center',
    color: '#EF4444',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  register: { fontWeight: '700' },

  batch: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },

  success: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },

  btn: {
    fontWeight: '700',
    color: '#DC2626',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  cancelBtn: {
    fontWeight: '700',
    color: '#6B7280',
  },

});