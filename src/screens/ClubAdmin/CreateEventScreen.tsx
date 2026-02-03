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
import { db } from "../../db/sqlite";

import { getEsp32Files } from "../../api/esp32Cache";
import { extractDateFromFilename } from "../../utils/fileDate";
import { useTheme } from "../../components/context/ThemeContext";

const PRIMARY = "#B50002";
const PLACEHOLDER_COLOR = "#94a3b8";

/* ================= STEPS ================= */

const EVENT_STEPS = [
  "Event Info",
  "Add Players",
  "Trim",
  "Add Exercises",
  "Cleanup",
];

const StepHeader = ({ current, isDark }: { current: number; isDark: boolean }) => {
  return (
    <View style={[stepStyles.wrapper, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: isDark ? '#1E293B' : '#e5e7eb' }]}>
      {EVENT_STEPS.map((label, index) => {
        const active = index === current;
        const done = index < current;

        return (
          <View key={label} style={stepStyles.step}>
            <View
              style={[
                stepStyles.circle,
                { backgroundColor: isDark ? (active || done ? PRIMARY : '#334155') : (active || done ? PRIMARY : '#e5e7eb') },
              ]}
            >
              <Text style={stepStyles.circleText}>
                {done ? "✓" : index + 1}
              </Text>
            </View>

            <Text
              style={[
                stepStyles.label,
                { color: isDark ? (active ? '#fff' : '#94A3B8') : (active ? '#000' : '#6b7280') }
              ]}
            >
              {label}
            </Text>

            {index !== EVENT_STEPS.length - 1 && (
              <View
                style={[
                  stepStyles.line,
                  { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                  done && stepStyles.lineActive,
                ]}
              />
            )}
          </View>
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
      <Text style={[styles.pageTitle, { color: isDark ? '#fff' : '#111827' }]}>{isEditMode ? "Edit Event" : "Create Event"}</Text>
      <Text style={[styles.pageSubtitle, { color: isDark ? '#94A3B8' : '#6b7280' }]}>
        {isEditMode ? "Update event details" : "Fill in the basic details to create a new event"}
      </Text>

      {/* EVENT NAME */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Event Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#d1d5db', color: isDark ? '#fff' : '#000' }]}
          value={eventName}
          onChangeText={setEventName}
          placeholder="Enter event name"
          placeholderTextColor={isDark ? '#94A3B8' : '#9ca3af'}
        />
      </View>

      {/* EVENT TYPE */}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Event Type</Text>
        <View style={styles.radioGroup}>
          {["match", "training"].map(type => (
            <TouchableOpacity
              key={type}
              style={styles.radioItem}
              onPress={() => setEventType(type as any)}
            >
              <View style={[styles.radioOuter, { borderColor: PRIMARY }]}>
                {eventType === type && <View style={[styles.radioInner, { backgroundColor: PRIMARY }]} />}
              </View>
              <Text style={{ color: isDark ? '#fff' : '#000' }}>{type === "match" ? "Match" : "Training"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* FIELD */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Field</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#d1d5db', color: isDark ? '#fff' : '#000' }]}
          value={field}
          onChangeText={setField}
          placeholder="Enter field name"
          placeholderTextColor={isDark ? '#94A3B8' : '#9ca3af'}
        />
      </View>

      {/* LOCATION */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Location</Text>
        <TextInput
          style={[styles.input, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#d1d5db', color: isDark ? '#fff' : '#000' }]}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter location"
          placeholderTextColor={isDark ? '#94A3B8' : '#9ca3af'}
        />
      </View>

      {/* NOTES */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 90, backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#d1d5db', color: isDark ? '#fff' : '#000' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          placeholderTextColor={isDark ? '#94A3B8' : '#9ca3af'}
          multiline
        />
      </View>

      {/* DATE */}
      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Select Date *</Text>
        <TouchableOpacity
          style={[styles.dropdown, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#d1d5db' }, isEditMode && { backgroundColor: isDark ? '#334155' : '#f3f4f6' }]}
          onPress={() => !isEditMode && setDatePickerOpen(true)}
          disabled={isEditMode} // Disable date change in update mode? Usually safer to avoid detaching from CSV date
        >
          <Text style={{ color: isDark ? '#fff' : (isEditMode ? '#6b7280' : '#000') }}>
            {selectedDate || "Select date"}
            {isEditMode && " (Cannot change date)"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CSV SECTION (Hide in Edit Mode) */}
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
      {/* ===== TOP BAR ===== */}
      <View>
        <View style={[styles.topBar, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: isDark ? '#1E293B' : '#e5e7eb' }]}>
          <TouchableOpacity onPress={goBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "How to use",
                "1. Connect Podholder\n2. Select Date\n3. Choose File\n4. Fill Info\n5. Next"
              )
            }
          >
            <Text style={styles.helpText}>How to use?</Text>
          </TouchableOpacity>
        </View>

        {/* STEPS */}
        <StepHeader current={0} isDark={isDark} />

        {/* ALERT */}
        {!checkingEsp32 && !esp32Connected && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Podholder not connected</Text>
            <Text style={styles.alertText}>
              Connect phone to Podholder Wi-Fi to continue
            </Text>
          </View>
        )}
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

      {/* ===== FIXED BOTTOM BAR ===== */}
      <View style={[styles.bottomBar, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: isDark ? '#1E293B' : '#e5e7eb' }]}>
        <View style={styles.bottomBarRight}>
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !canProceed && [styles.nextBtnDisabled, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }],
            ]}
            onPress={onNext}
            disabled={!canProceed}
          >
            <Text
              style={[
                styles.nextText,
                !canProceed && styles.nextTextDisabled,
              ]}
            >
              {isEditMode ? "UPDATE EVENT" : "NEXT"}
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
    backgroundColor: "#fff",
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  backText: {
    color: PRIMARY,
    fontWeight: "700",
  },

  helpText: {
    color: PRIMARY,
    fontWeight: "700",
  },

  /* ===== FORM CARD ===== */

  formCard: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
    color: "#111827",
  },

  pageSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 24,
  },

  /* ===== FORM FIELDS ===== */

  fieldBlock: {
    marginBottom: 20,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
  },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
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
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
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
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },

  bottomBarRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  nextBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 140, // desktop-like button width
  },

  nextBtnDisabled: {
    backgroundColor: "#e5e7eb",
  },

  nextText: {
    color: "#fff",
    fontWeight: "700",
  },

  nextTextDisabled: {
    color: "#9ca3af",
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
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  step: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },

  circleActive: {
    backgroundColor: PRIMARY,
  },

  circleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  label: {
    marginLeft: 6,
    fontSize: 12,
    color: "#6b7280",
  },

  labelActive: {
    color: PRIMARY,
    fontWeight: "700",
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 6,
  },

  lineActive: {
    backgroundColor: PRIMARY,
  },
});
