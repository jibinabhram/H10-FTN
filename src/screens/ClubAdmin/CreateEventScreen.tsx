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
} from "react-native";
import { Calendar } from "react-native-calendars";

import { getEsp32Files } from "../../api/esp32Cache";
import { extractDateFromFilename } from "../../utils/fileDate";

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

const StepHeader = ({ current }: { current: number }) => {
  return (
    <View style={stepStyles.wrapper}>
      {EVENT_STEPS.map((label, index) => {
        const active = index === current;
        const done = index < current;

        return (
          <View key={label} style={stepStyles.step}>
            <View
              style={[
                stepStyles.circle,
                (active || done) && stepStyles.circleActive,
              ]}
            >
              <Text style={stepStyles.circleText}>
                {done ? "✓" : index + 1}
              </Text>
            </View>

            <Text
              style={[
                stepStyles.label,
                active && stepStyles.labelActive,
              ]}
            >
              {label}
            </Text>

            {index !== EVENT_STEPS.length - 1 && (
              <View
                style={[
                  stepStyles.line,
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
}: {
  goBack: () => void;
  goNext: (payload: any) => void;
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
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
    }, [])
  );

  useEffect(() => {
    if (!selectedDate) return;

    const filtered = allFiles.filter(
      (f) => extractDateFromFilename(f) === selectedDate
    );

    setFilesForDate(filtered);
    setSelectedFile(null);
  }, [selectedDate, allFiles]);



  const canProceed =
    eventName.trim() &&
    selectedDate &&
    selectedFile &&
    esp32Connected;

  const onNext = () => {
    if (!canProceed) {
      Alert.alert("Incomplete", "Fill all required fields");
      return;
    }

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
    <View style={styles.formCard}>
      <Text style={styles.pageTitle}>Create Event</Text>
      <Text style={styles.pageSubtitle}>
        Fill in the basic details to create a new event
      </Text>

      {/* EVENT NAME */}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Event Name *</Text>
        <TextInput
          style={styles.input}
          value={eventName}
          onChangeText={setEventName}
          placeholder="Enter event name"
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
              <View style={styles.radioOuter}>
                {eventType === type && <View style={styles.radioInner} />}
              </View>
              <Text>{type === "match" ? "Match" : "Training"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* FIELD */}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Field</Text>
        <TextInput
          style={styles.input}
          value={field}
          onChangeText={setField}
          placeholder="Enter field name"
        />
      </View>

      {/* LOCATION */}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter location"
        />
      </View>

      {/* NOTES */}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 90 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          multiline
        />
      </View>

      {/* DATE */}
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Select Date *</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setDatePickerOpen(true)}
        >
          <Text>{selectedDate || "Select date"}</Text>
        </TouchableOpacity>
      </View>

      {/* CSV SECTION */}
      {selectedDate && renderCsvSection()}
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
      <View style={styles.fileBox}>
        <FlatList
          data={filesForDate}          // ✅ FULL LIST
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          style={{ maxHeight: 240 }}   // ✅ SHOW ~6 ITEMS VISUALLY
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.fileOption}
              onPress={() => setSelectedFile(item)}
            >
              <Text numberOfLines={1}>{item}</Text>
            </TouchableOpacity>
          )}
        />

      </View>

    );
  };


  return (
    <View style={styles.screen}>
      {/* ===== TOP BAR ===== */}
      <View>
        <View style={styles.topBar}>
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
        <StepHeader current={0} />

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
          >
            {renderForm()}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ===== FIXED BOTTOM BAR ===== */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarRight}>
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !canProceed && styles.nextBtnDisabled,
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
              NEXT
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
    backgroundColor: "#f5f7fa",
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
