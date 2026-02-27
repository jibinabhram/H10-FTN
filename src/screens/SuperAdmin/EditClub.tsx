import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { updateClub } from '../../api/clubs';
import { updateAdminByClub } from '../../api/admin';
import api from '../../api/axios';
import { useAlert } from '../../components/context/AlertContext';

const EditClub = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { showAlert } = useAlert();

  const { clubId } = route.params;

  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [clubName, setClubName] = useState('');
  const [address, setAddress] = useState('');
  const [sport, setSport] = useState('');

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  const [podHolders, setPodHolders] = useState<any[]>([]);
  const [selectedPodHolders, setSelectedPodHolders] = useState<string[]>([]);


  const [showPodDropdown, setShowPodDropdown] = useState(false);

  const [availablePodHolders, setAvailablePodHolders] = useState<any[]>([]);



  useEffect(() => {
    loadClub();
    loadAvailablePodHolders();
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadClub(), loadAvailablePodHolders()]);
    } finally {
      setRefreshing(false);
    }
  };


  useEffect(() => {
    if (!club) return;

    const assignedIds =
      club.pod_holders?.map((p: any) => p.pod_holder_id) || [];

    setAvailablePodHolders(
      podHolders.filter((p: any) => !assignedIds.includes(p.pod_holder_id))
    );
  }, [club, podHolders]);



  const loadClub = async () => {
    try {
      const res = await api.get(`/clubs/${clubId}`);
      const clubData = res.data?.data;
      console.log('🔍 CLUB FROM BACKEND:', res.data);
      setClub(clubData);


      setClubName(clubData.club_name);
      setAddress(clubData.address);
      setSport(clubData.sport);

      const admin = clubData.admin;
      setAdminName(admin?.name || '');
      setAdminEmail(admin?.email || '');
      setAdminPhone(admin?.phone || '');
    } catch {
      showAlert({ title: 'Error', message: 'Failed to load club', type: 'error' });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePodHolders = async () => {
    try {
      const res = await api.get('/pod-holders/available');
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
      setPodHolders(list);
    } catch {
      showAlert({ title: 'Error', message: 'Failed to load pod holders', type: 'error' });
      setAvailablePodHolders([]);
    }
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);

      await updateClub(clubId, {
        club_name: clubName,
        address,
        sport,
      });

      for (const podHolderId of selectedPodHolders) {
        await api.patch(`/pod-holders/${podHolderId}/assign/${clubId}`);
      }
      await updateAdminByClub(clubId, {
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
      });
      showAlert({
        title: 'Success',
        message: 'Club updated successfully',
        type: 'success',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              setSelectedPodHolders([]);
              setShowPodDropdown(false);
              navigation.goBack();
            },
          },
        ],
      });
    } catch (err: any) {
      console.log('❌ UPDATE ERROR:', err?.response?.data || err);
      showAlert({
        title: 'Error',
        message: err?.response?.data?.message || 'Update failed',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };


  if (loading || !club) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Edit Club</Text>

        <Text style={styles.sectionTitle}>Club Admin Details</Text>

        <TextInput style={styles.input} value={clubName} onChangeText={setClubName} />
        <TextInput style={styles.input} value={address} onChangeText={setAddress} />
        <TextInput style={styles.input} value={sport} onChangeText={setSport} />

        <TextInput
          style={styles.input}
          placeholder="Admin Name"
          value={adminName}
          onChangeText={setAdminName}
        />

        <TextInput
          style={styles.input}
          placeholder="Admin Email"
          value={adminEmail}
          onChangeText={setAdminEmail}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Admin Phone"
          value={adminPhone}
          onChangeText={setAdminPhone}
          keyboardType="phone-pad"
        />

        {/* ASSIGNED POD HOLDERS */}
        <Text style={styles.sectionTitle}>Assigned Pod Holders</Text>

        {club.pod_holders?.length > 0 ? (
          club.pod_holders.map((p: any) => (
            <View key={p.pod_holder_id} style={styles.assignedRow}>
              <Text style={{ flex: 1 }}>• {p.serial_number}</Text>

              <TouchableOpacity
                onPress={() => {
                  showAlert({
                    title: 'Remove Pod Holder',
                    message: 'Are you sure you want to unassign this pod holder?',
                    type: 'warning',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await api.patch(
                              `/pod-holders/${p.pod_holder_id}/unassign`
                            );


                            await loadClub();
                            await loadAvailablePodHolders();
                          } catch {
                            showAlert({ title: 'Error', message: 'Failed to unassign pod holder', type: 'error' });
                          }
                        },
                      },
                    ]
                  });
                }}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No pod holders assigned</Text>
        )}


        {/* ADD POD HOLDERS DROPDOWN */}
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setShowPodDropdown(prev => !prev)}
        >
          <Text style={styles.sectionTitle}>Add Pod Holders</Text>
          <Text>{showPodDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showPodDropdown &&
          (availablePodHolders.length === 0 ? (
            <Text style={styles.emptyText}>No available pod holders</Text>
          ) : (
            availablePodHolders.map((p: any) => {
              const selected = selectedPodHolders.includes(p.pod_holder_id);
              return (
                <TouchableOpacity
                  key={p.pod_holder_id}
                  style={styles.checkboxRow}
                  onPress={() => {
                    setSelectedPodHolders(prev =>
                      selected
                        ? prev.filter(id => id !== p.pod_holder_id)
                        : [...prev, p.pod_holder_id],
                    );
                  }}
                >
                  <View style={[styles.checkbox, selected && styles.checkedBox]} />
                  <Text>{p.serial_number}</Text>
                </TouchableOpacity>
              );
            })
          ))}

        {/* SAVE BUTTON OUTSIDE DROPDOWN */}
        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontWeight: '700', marginTop: 20 },
  assignedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  removeText: { color: 'red' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#64748B',
    marginRight: 10,
    borderRadius: 4,
  },
  checkedBox: {
    backgroundColor: '#DC2626',
  },
  btn: { backgroundColor: '#DC2626', padding: 16, marginTop: 20 },
  btnText: { color: '#fff', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748B', paddingVertical: 10, fontStyle: 'italic' },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
});

export default EditClub;
