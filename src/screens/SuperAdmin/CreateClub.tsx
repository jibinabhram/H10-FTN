import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Modal,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import api from '../../api/axios';
import { createClub } from '../../api/clubs';
import { getUnassignedPodHolders } from '../../api/clubs';


interface Props {
  goBack: () => void;
}

const CreateClub = ({ goBack }: Props) => {
  const handleGoBack = () => {
      goBack();
    };

  /* -------- CLUB -------- */
  const [clubName, setClubName] = useState('');
  const [sport, setSport] = useState('');
  const [address, setAddress] = useState('');
  const [clubImage, setClubImage] = useState<Asset | null>(null);

  /* -------- ADMIN -------- */
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  /* -------- POD HOLDERS -------- */
  const [podHolders, setPodHolders] = useState<any[]>([]);
  const [selectedPodHolders, setSelectedPodHolders] = useState<string[]>([]);
  const [showPodModal, setShowPodModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  /* ================= IMAGE PICKER ================= */

  const pickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (!result.didCancel && result.assets?.length) {
      setClubImage(result.assets[0]);
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
      return Alert.alert('Error', 'All fields are required');
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
      const res = await createClub(payload);

      // 2️⃣ EXTRACT ADMIN ID FROM RESPONSE
      // (adjust if your response shape differs)
      const adminId =
        res?.data?.club?.club_admins?.[0]?.admin_id ||
        res?.data?.admin?.admin_id;

      // 3️⃣ UPLOAD PROFILE IMAGE (SEPARATE REQUEST)
      if (clubImage && adminId) {
        const formData = new FormData();

        formData.append('file', {
          uri: clubImage.uri!,
          name: clubImage.fileName ?? `admin_${Date.now()}.jpg`,
          type: clubImage.type ?? 'image/jpeg',
        } as any);

        await api.patch(
          `/club-admin/${adminId}/image`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
      }

      // 4️⃣ DONE
      Alert.alert('Success', 'Club created successfully', [
        { text: 'OK', onPress: handleGoBack },
      ]);
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message || 'Server error',
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />
      }
    >
      {/* HEADER */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Create New Club</Text>
      </View>

      {/* CLUB INFO */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Club Information</Text>

        <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
          {clubImage ? (
            <Image source={{ uri: clubImage.uri }} style={styles.image} />
          ) : (
            <>
              <Ionicons name="image-outline" size={28} color="#94A3B8" />
              <Text style={styles.imageText}>Upload Club Image</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Club Name</Text>
            <TextInput style={styles.input} value={clubName} onChangeText={setClubName} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Sport</Text>
            <TextInput style={styles.input} value={sport} onChangeText={setSport} />
          </View>
        </View>

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Assign Pod Holders</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPodModal(true)}>
          <Text>
            {selectedPodHolders.length
              ? `${selectedPodHolders.length} selected`
              : 'Select pod holders'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ADMIN */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Credentials</Text>

        <Text style={styles.label}>Admin Name</Text>
        <TextInput style={styles.input} value={adminName} onChangeText={setAdminName} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={adminEmail} onChangeText={setAdminEmail} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              secureTextEntry
              style={styles.input}
              value={adminPassword}
              onChangeText={setAdminPassword}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.createBtn, loading && { opacity: 0.6 }]}
        disabled={loading}
        onPress={handleCreate}
      >
        <Text style={styles.createText}>
          {loading ? 'Creating...' : 'Create Club'}
        </Text>
      </TouchableOpacity>

      {/* POD HOLDER MODAL */}
      <Modal visible={showPodModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Select Pod Holders</Text>

            <ScrollView>
              {Array.isArray(podHolders) &&
                podHolders.map(ph => {
                  const selected = selectedPodHolders.includes(ph.pod_holder_id);
                  return (
                    <TouchableOpacity
                      key={`pod-holder-${ph.pod_holder_id}`}
                      style={styles.checkboxRow}
                      onPress={() =>
                        setSelectedPodHolders(prev =>
                          selected
                            ? prev.filter(id => id !== ph.pod_holder_id)
                            : [...prev, ph.pod_holder_id]
                        )
                      }
                    >
                      <View style={[styles.checkbox, selected && styles.checked]} />
                      <Text>{ph.serial_number}</Text>
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
  imageBox: { height: 140, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  image: { width: '100%', height: '100%', borderRadius: 12 },
  checkboxRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderRadius: 4 },
  checked: { backgroundColor: '#3B82F6' },
  createBtn: { backgroundColor: '#3B82F6', padding: 14, borderRadius: 12, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '70%', maxWidth: 500, maxHeight: '70%', alignSelf: 'center' },
  modalBtn: { marginTop: 12, backgroundColor: '#3B82F6', padding: 12, borderRadius: 10 },
  modalBtnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
