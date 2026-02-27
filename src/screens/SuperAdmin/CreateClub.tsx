import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../../api/axios';
import { createClub } from '../../api/clubs';
import { getUnassignedPodHolders } from '../../api/clubs';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';
import { validatePassword, ValidationResult } from '../../utils/validation';
import PasswordRequirementList from '../../components/Auth/PasswordRequirementList';


interface Props {
  goBack: () => void;
}

const CreateClub = ({ goBack }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showAlert } = useAlert();

  const handleGoBack = () => {
    goBack();
  };

  /* -------- CLUB -------- */
  const [clubName, setClubName] = useState('');
  const [sport, setSport] = useState('');
  const [address, setAddress] = useState('');

  /* -------- ADMIN -------- */
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<ValidationResult | null>(null);

  const handleAdminPasswordChange = (val: string) => {
    setAdminPassword(val);
    if (val) {
      const v = validatePassword(val);
      setPasswordValidation(v);
    } else {
      setPasswordValidation(null);
    }
  };

  /* -------- POD HOLDERS -------- */
  const [podHolders, setPodHolders] = useState<any[]>([]);
  const [selectedPodHolders, setSelectedPodHolders] = useState<string[]>([]);
  const [showPodModal, setShowPodModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* ===== KEYBOARD VISIBILITY ===== */
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  /* ================= LOAD UNASSIGNED POD HOLDERS ================= */

  useEffect(() => {
    loadUnassignedPodHolders();
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadUnassignedPodHolders();
    } finally {
      setRefreshing(false);
    }
  };

  const loadUnassignedPodHolders = async () => {
    try {
      const res = await api.get('/pod-holders/unassigned');


      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

      setPodHolders(list);
    } catch (e) {
      console.log('Failed to load pod holders', e);
      setPodHolders([]);
    }
  };

  /* ================= CREATE CLUB ================= */

  const handleCreate = async () => {
    if (
      !clubName ||
      !sport ||
      !address ||
      !adminName ||
      !adminEmail ||
      !adminPassword
    ) {
      return showAlert({ title: 'Error', message: 'All fields are required', type: 'error' });
    }

    if (passwordValidation && !passwordValidation.isValid) {
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ CREATE CLUB (JSON ONLY)
      const payload = {
        club_name: clubName,
        sport,
        address,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        pod_holder_ids: selectedPodHolders,
      };

      // 🔴 THIS LINE WAS `await createClub(payload);`
      await createClub(payload);

      // 4️⃣ DONE
      showAlert({
        title: 'Success',
        message: 'Club created successfully',
        type: 'success',
        buttons: [{ text: 'OK', onPress: handleGoBack }],
      });
    } catch (e: any) {
      showAlert({
        title: 'Error',
        message: e?.response?.data?.message || 'Server error',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#F8FAFC" : "#0F172A"}
          />
        }
      >
        {/* HEADER - Hide when keyboard is open to save space */}
        {!isKeyboardVisible && (
          <View style={styles.pageHeader}>
            <TouchableOpacity onPress={handleGoBack}>
              <Ionicons
                name="arrow-back"
                size={22}
                color={isDark ? "#F8FAFC" : "#0F172A"}
              />
            </TouchableOpacity>
            <Text style={[styles.title, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>
              Create New Club
            </Text>
          </View>
        )}

        {/* CLUB INFO */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? "#1E293B" : "#fff" },
          ]}
        >
          <Text
            style={[styles.cardTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
          >
            Club Information
          </Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94A3B8" : "#6B7280" },
                ]}
              >
                Club Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                value={clubName}
                onChangeText={setClubName}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94A3B8" : "#6B7280" },
                ]}
              >
                Sport
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                value={sport}
                onChangeText={setSport}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: isDark ? "#94A3B8" : "#6B7280" }]}>
            Address
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                color: isDark ? "#F8FAFC" : "#0F172A",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
            multiline
            value={address}
            onChangeText={setAddress}
          />

          <Text
            style={[styles.label, { color: isDark ? "#94A3B8" : "#6B7280" }]}
          >
            Assign Pod Holders
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              { borderColor: isDark ? "#334155" : "#E2E8F0" },
            ]}
            onPress={() => setShowPodModal(true)}
          >
            <Text style={{ color: isDark ? "#F8FAFC" : "#0F172A" }}>
              {selectedPodHolders.length
                ? `${selectedPodHolders.length} selected`
                : "Select pod holders"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ADMIN */}
        <View
          style={[
            styles.card,
            { backgroundColor: isDark ? "#1E293B" : "#fff" },
          ]}
        >
          <Text
            style={[styles.cardTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
          >
            Admin Credentials
          </Text>

          <Text
            style={[styles.label, { color: isDark ? "#94A3B8" : "#6B7280" }]}
          >
            Admin Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? "#F8FAFC" : "#0F172A",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
            value={adminName}
            onChangeText={setAdminName}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94A3B8" : "#6B7280" },
                ]}
              >
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                value={adminEmail}
                onChangeText={setAdminEmail}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94A3B8" : "#6B7280" },
                ]}
              >
                Password
              </Text>
              <TextInput
                secureTextEntry
                style={[
                  styles.input,
                  {
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                value={adminPassword}
                onChangeText={handleAdminPasswordChange}
              />
              {passwordValidation ? <PasswordRequirementList requirements={passwordValidation.requirements} /> : null}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={handleCreate}
        >
          <Text style={styles.createText}>
            {loading ? "Creating..." : "Create Club"}
          </Text>
        </TouchableOpacity>

        {/* POD HOLDER MODAL */}
        <Modal visible={showPodModal} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: isDark ? "#1E293B" : "#fff" },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                Select Pod Holders
              </Text>

              <ScrollView>
                {Array.isArray(podHolders) &&
                  podHolders.map((ph) => {
                    const selected = selectedPodHolders.includes(
                      ph.pod_holder_id
                    );
                    return (
                      <TouchableOpacity
                        key={`pod-holder-${ph.pod_holder_id}`}
                        style={styles.checkboxRow}
                        onPress={() =>
                          setSelectedPodHolders((prev) =>
                            selected
                              ? prev.filter((id) => id !== ph.pod_holder_id)
                              : [...prev, ph.pod_holder_id]
                          )
                        }
                      >
                        <View
                          style={[
                            styles.checkbox,
                            selected && styles.checked,
                            { borderColor: isDark ? "#334155" : "#E2E8F0" },
                          ]}
                        />
                        <Text style={{ color: isDark ? "#F8FAFC" : "#0F172A" }}>
                          {ph.serial_number}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setShowPodModal(false)}
              >
                <Text style={styles.modalBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default CreateClub;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#F8FAFC' },
  pageHeader: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12, marginBottom: 14 },
  textArea: { height: 80 },
  checkboxRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderRadius: 4 },
  checked: { backgroundColor: '#DC2626' },
  createBtn: { backgroundColor: '#DC2626', padding: 14, borderRadius: 12, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '70%', maxWidth: 500, maxHeight: '70%', alignSelf: 'center' },
  modalBtn: { marginTop: 12, backgroundColor: '#DC2626', padding: 12, borderRadius: 10 },
  modalBtnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  validationError: {
    color: '#DC2626',
    fontSize: 10,
    marginTop: 4,
    marginBottom: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
});
