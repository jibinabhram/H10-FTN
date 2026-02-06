import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Ionicons from "react-native-vector-icons/Ionicons";
import { db } from "../../db/sqlite";

import { getEsp32Files } from "../../api/esp32Cache";
import { extractDateFromFilename } from "../../utils/fileDate";
import { useTheme } from "../../components/context/ThemeContext";

const PRIMARY = "#B50002";
const PLACEHOLDER_COLOR = "#94a3b8";

/* ================= STEPS ================= */

const EVENT_STEPS = [
  { label: "Event Details", icon: "document-text-outline" },
  { label: "Add Players", icon: "people-outline" },
  { label: "Trim", icon: "cut-outline" },
  { label: "Add Exercise", icon: "fitness-outline" },
  { label: "Cleanup", icon: "checkmark-done-outline" },
];

const StepHeader = ({ current, isDark }: { current: number; isDark: boolean }) => {
  return (
    <View style={[stepStyles.wrapper, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
      {EVENT_STEPS.map((step, index) => {
        const active = index === current;
        const done = index < current;

        return (
          <React.Fragment key={step.label}>
            <View style={stepStyles.step}>
              <View
                style={[
                  stepStyles.circle,
                  {
                    backgroundColor: isDark ? (active || done ? PRIMARY : '#1E293B') : (active || done ? '#FEE2E2' : '#F1F5F9'),
                    borderColor: (active || done) ? PRIMARY : 'transparent',
                    borderWidth: (active || done) ? 1.5 : 0
                  },
                ]}
              >
                <Ionicons
                  name={step.icon as any}
                  size={16}
                  color={
                    active || done
                      ? (isDark ? '#FFFFFF' : PRIMARY)
                      : (isDark ? '#64748B' : '#94A3B8')
                  }
                />
              </View>

              <Text
                style={[
                  stepStyles.label,
                  { color: isDark ? (active ? '#fff' : '#64748B') : (active ? '#B50002' : '#64748B'), fontWeight: active ? '700' : '500' }
                ]}
              >
                {step.label}
              </Text>
            </View>
            {index !== EVENT_STEPS.length - 1 && (
              <View
                style={[
                  stepStyles.line,
                  { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* ================= SCREEN ================= */

export default function CreateEventScreen({
  goBack,
  goNext,
  initialData, // 🆕 Added prop
}: {
  goBack: () => void;
  goNext: (payload: any) => void;
  initialData?: any;
}) {
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState<"training" | "match">("match");
  const [location, setLocation] = useState("");
  const [field, setField] = useState("");
  const [notes, setNotes] = useState("");

  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filesForDate, setFilesForDate] = useState<string[]>([]);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [eventTypePickerOpen, setEventTypePickerOpen] = useState(false); // 🆕 Drodown state
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [checkingEsp32, setCheckingEsp32] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ===== INIT FROM PROPS (EDIT MODE) ===== */
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const isEditMode = !!initialData; // 🆕 Check if editing

  /* ===== INIT FROM PROPS (EDIT MODE) ===== */
  useEffect(() => {
    if (initialData) {
      setEventName(initialData.event_name || "");
      setEventType(initialData.event_type || "match");
      setLocation(initialData.location || "");
      setField(initialData.field || "");
      setNotes(initialData.notes || "");
      setSelectedDate(initialData.event_date || null);

      // In edit mode, we mimic connection/file valid so user can save
      setEsp32Connected(true);
      setSelectedFile("EXISTING_FILE");
    }
  }, [initialData]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        // Skip ESP32 check if editing
        if (isEditMode) {
          setCheckingEsp32(false);
          return;
        }

        setCheckingEsp32(true);
        try {
          const files = await getEsp32Files();
          if (cancelled) return;

          setEsp32Connected(true);
          setAllFiles(files);

          const marks: Record<string, any> = {};
          files.forEach((file) => {
            const date = extractDateFromFilename(file);
            if (date) marks[date] = { marked: true, dotColor: PRIMARY };
          });

          setMarkedDates(marks);
        } catch {
          setEsp32Connected(false);
        } finally {
          setCheckingEsp32(false);
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [isEditMode])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      // Reload ESP32 files and dates
      if (!isEditMode) {
        const files = await getEsp32Files();
        setEsp32Connected(true);
        setAllFiles(files);

        const marks: Record<string, any> = {};
        files.forEach((file) => {
          const date = extractDateFromFilename(file);
          if (date) marks[date] = { marked: true, dotColor: PRIMARY };
        });

        setMarkedDates(marks);
      }
    } catch {
      setEsp32Connected(false);
    } finally {
      setRefreshing(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!selectedDate || isEditMode) return; // Skip if edit mode

    const filtered = allFiles.filter(
      (f) => extractDateFromFilename(f) === selectedDate
    );

    setFilesForDate(filtered);
    setSelectedFile(null);
  }, [selectedDate, allFiles, isEditMode]);



  const canProceed =
    eventName.trim() &&
    selectedDate &&
    selectedFile &&
    esp32Connected;

  /* ===== ACTION HANDLER ===== */
  const onNext = async () => {
    if (!canProceed) {
      Alert.alert("Incomplete", "Fill all required fields");
      return;
    }

    /* 🟢 UPDATE MODE */
    if (isEditMode) {
      try {
        // 1. Update SQLite
        await db.execute(
          `UPDATE sessions 
             SET event_name = ?, event_type = ?, location = ?, field = ?, notes = ?, event_date = ?
             WHERE session_id = ?`,
          [eventName, eventType, location, field, notes, selectedDate, initialData.session_id]
        );

        // 2. Try Backend Sync (Optional, log error if fails)
        // TODO: Call backend update API here if needed
        // await api.put(\`/events/\${initialData.session_id}\`, { ... });

        Alert.alert("Success", "Event updated successfully");
        goBack(); // Return to ManageEvents
      } catch (err) {
        console.error("Update failed", err);
        Alert.alert("Error", "Failed to update event");
      }
      return;
    }

    /* 🔵 CREATE MODE */
    goNext({
      step: "AssignPlayers",
      file: selectedFile,
      eventDraft: {
        eventName,
        eventType,
        eventDate: selectedDate,
        location,
        field,
        notes,
      },
    });
  };


  const renderForm = () => (
    <View style={[styles.formCard, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
      <View style={styles.formRow}>
        {/* EVENT NAME */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Event Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
            value={eventName}
            onChangeText={setEventName}
            placeholder="Eg. Morning Training"
            placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          />
        </View>

        {/* EVENT TYPE */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Event Type *</Text>
          <TouchableOpacity
            style={[styles.dropdown, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
            onPress={() => setEventTypePickerOpen(true)}
          >
            <Text style={{ color: isDark ? '#fff' : (eventType ? '#000' : '#94A3B8') }}>
              {eventType === 'match' ? 'Match' : 'Training'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formRow}>
        {/* FIELD */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Field</Text>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
            value={field}
            onChangeText={setField}
            placeholder="Enter your Field"
            placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          />
        </View>

        {/* LOCATION */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Location</Text>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Enter your Location"
            placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          />
        </View>
      </View>

      {/* DATE */}
      <View style={styles.fieldBlockFull}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Date</Text>
        <TouchableOpacity
          style={[styles.dropdown, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }, isEditMode && { opacity: 0.6 }]}
          onPress={() => !isEditMode && setDatePickerOpen(true)}
          disabled={isEditMode}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color="#64748B" />
            <Text style={{ color: isDark ? '#fff' : (isEditMode ? '#64748B' : '#000') }}>
              {selectedDate || "Select Date"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* NOTES */}
      <View style={[styles.fieldBlockFull, { marginTop: 12 }]}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top', backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Enter notes..."
          placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          multiline
        />
      </View>

      {/* CSV SECTION (Bypass fetch logic) */}
      {!isEditMode && selectedDate && renderCsvSection()}
    </View>
  );


  const renderCsvSection = () => {
    if (filesForDate.length === 0) {
      return (
        <Text style={{ color: "#6b7280" }}>
          No CSV files for this date
        </Text>
      );
    }

    // ✅ CSV SELECTED → SHOW ONLY SELECTED
    if (selectedFile) {
      return (
        <TouchableOpacity
          style={styles.selectedFile}
          onPress={() => setSelectedFile(null)}
        >
          <Text style={styles.fileTextSelected}>
            {selectedFile}
          </Text>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      );
    }

    // ✅ NO CSV SELECTED → SHOW LIST (MAX 6)
    return (
      <View style={[styles.fileBox, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#e5e7eb' }]}>
        <FlatList
          data={filesForDate}          // ✅ FULL LIST
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          style={{ maxHeight: 240 }}   // ✅ SHOW ~6 ITEMS VISUALLY
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.fileOption, { borderColor: isDark ? '#334155' : '#e5e7eb' }]}
              onPress={() => setSelectedFile(item)}
            >
              <Text numberOfLines={1} style={{ color: isDark ? '#E2E8F0' : '#000' }}>{item}</Text>
            </TouchableOpacity>
          )}
        />

      </View>

    );
  };


  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
      <View style={styles.header}>
        <View style={[styles.topBar, { backgroundColor: isDark ? '#020617' : '#FFFFFF', borderBottomWidth: 0 }]}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
            <Text style={[styles.backText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Back to comparison</Text>
          </TouchableOpacity>
        </View>

        {/* STEPS */}
        <StepHeader current={0} isDark={isDark} />
      </View>

      <View style={styles.content}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PRIMARY}
              />
            }
          >
            {renderForm()}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ===== FIXED BOTTOM BAR (MOCKUP STYLE) ===== */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? '#020617' : '#FFFFFF', borderTopWidth: 1, borderTopColor: isDark ? '#1E293B' : '#E2E8F0', borderStyle: 'dashed' }]}>
        <View style={styles.bottomBarRight}>
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
            onPress={goBack}
          >
            <Text style={[styles.cancelText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              !canProceed && [styles.nextBtnDisabled, { opacity: 0.5 }],
            ]}
            onPress={onNext}
            disabled={!canProceed}
          >
            <Text style={styles.nextText}>
              {isEditMode ? "UPDATE EVENT" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* ===== DATE MODAL ===== */}
      <Modal
        visible={datePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Calendar
              markedDates={{
                ...markedDates,
                ...(selectedDate && {
                  [selectedDate]: {
                    selected: true,
                    selectedColor: PRIMARY,
                  },
                }),
              }}
              onDayPress={(d) => {
                setSelectedDate(d.dateString);
                setDatePickerOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ===== EVENT TYPE PICKER MODAL ===== */}
      <Modal
        visible={eventTypePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEventTypePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEventTypePickerOpen(false)}
        >
          <View style={[styles.modalContent, { minHeight: undefined, padding: 0, overflow: 'hidden' }]}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: isDark ? '#334155' : '#e5e7eb', backgroundColor: isDark ? '#1E293B' : '#fff' }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: isDark ? '#fff' : '#000' }}>Select Event Type</Text>
            </View>
            <TouchableOpacity
              style={{ padding: 16, borderBottomWidth: 1, borderColor: isDark ? '#334155' : '#e5e7eb', backgroundColor: isDark ? '#0F172A' : '#fff' }}
              onPress={() => { setEventType('match'); setEventTypePickerOpen(false); }}
            >
              <Text style={{ color: isDark ? '#fff' : '#000' }}>Match</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ padding: 16, backgroundColor: isDark ? '#0F172A' : '#fff' }}
              onPress={() => { setEventType('training'); setEventTypePickerOpen(false); }}
            >
              <Text style={{ color: isDark ? '#fff' : '#000' }}>Training</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  /* ===== SCREEN LAYOUT ===== */
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  /* Top + Steps + Alert live here */
  header: {
    // Background handled in component for theme responsiveness
  },

  /* Scrollable middle area */
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  scrollContent: {
    paddingVertical: 16,
    alignItems: "center",
  },

  /* ===== TOP BAR ===== */

  topBar: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  backText: {
    color: PRIMARY,
    fontWeight: "700",
  },

  helpText: {
    color: PRIMARY,
    fontWeight: "700",
  },

  /* ===== MOCKUP HEADER ===== */
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  mainSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  /* ===== FORM CARD ===== */
  formCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginTop: 10,
  },

  formRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },

  fieldBlockHalf: {
    flex: 1,
  },

  fieldBlockFull: {
    width: '100%',
    marginBottom: 20,
  },

  /* ===== FORM FIELDS ===== */

  fieldBlock: {
    marginBottom: 20,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
  },

  /* ===== RADIO ===== */

  radioGroup: {
    flexDirection: "row",
    gap: 24,
  },

  radioItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: PRIMARY,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY,
  },

  /* ===== DROPDOWN ===== */

  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* ===== FILE LIST ===== */

  fileBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 6,
    maxHeight: 240,
    overflow: "hidden",
  },


  fileOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  fileOptionSelected: {
    backgroundColor: "#fde8e8",
  },

  fileTextSelected: {
    color: PRIMARY,
    fontWeight: "700",
  },

  /* ===== ALERT ===== */

  alertBox: {
    backgroundColor: "#fef3c7",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#fde68a",
  },

  alertTitle: {
    fontWeight: "700",
    color: "#92400e",
  },

  alertText: {
    color: "#92400e",
  },

  /* ===== FIXED BOTTOM BAR ===== */

  bottomBar: {
    padding: 20,
  },

  bottomBarRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },

  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: 'center',
    minWidth: 120,
  },

  cancelText: {
    fontWeight: "700",
    fontSize: 15,
  },

  nextBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: 'center',
    minWidth: 120,
  },

  nextBtnDisabled: {
    backgroundColor: "#e5e7eb",
  },

  nextText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  /* ===== MODAL ===== */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    minHeight: 360,
  },

  selectedFile: {
    padding: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 10,
    backgroundColor: "#fde8e8",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  changeText: {
    color: PRIMARY,
    fontWeight: "700",
  },

});

/* ================= STEP STYLES ================= */

const stepStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  step: {
    alignItems: "center",
    gap: 6,
  },

  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    fontSize: 11,
    textAlign: 'center',
  },

  line: {
    flex: 1,
    height: 1.5,
    marginBottom: 20, // Align with circles
  },
});
