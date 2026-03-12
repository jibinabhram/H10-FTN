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
  Keyboard,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Ionicons from "react-native-vector-icons/Ionicons";
import { db } from "../../db/sqlite";
import api from "../../api/axios";

import { getEsp32Files } from "../../api/esp32Cache";
import { extractDateFromFilename } from "../../utils/fileDate";
import { useTheme } from "../../components/context/ThemeContext";
import { useAlert } from "../../components/context/AlertContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../utils/constants";

const PRIMARY = "#B50002";
const PLACEHOLDER_COLOR = "#94a3b8";

/* ================= STEPS ================= */

const EVENT_STEPS = [
  { label: "Session Details", icon: "document-text-outline" },
  { label: "Add Players", icon: "people-outline" },
  { label: "Trim", icon: "cut-outline" },
  { label: "Add Session", icon: "walk-outline" },
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
  initialData,
  onUpdateDraft, // 🆕 Add this prop
}: {
  goBack: () => void;
  goNext: (payload: any) => void;
  initialData?: any;
  onUpdateDraft?: (draft: any) => void; // 🆕
}) {
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState<"training" | "match" | null>(null);
  const [location, setLocation] = useState("");
  const [field, setField] = useState("");
  const [notes, setNotes] = useState("");

  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);
  const [showLocSuggestions, setShowLocSuggestions] = useState(false);
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);

  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filesForDate, setFilesForDate] = useState<string[]>([]);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  /* 🟢 AUTO-SAVE TO PARENT (PRESERVE DRAFT) */
  const draftRef = React.useRef<any>({});

  useEffect(() => {
    draftRef.current = {
      eventName,
      eventType,
      location,
      field,
      notes,
      eventDate: selectedDate,
      file: selectedFile,
    };
    // Optional: could debounce and call onUpdateDraft here if you want real-time save
  }, [eventName, eventType, location, field, notes, selectedDate, selectedFile]);

  useEffect(() => {
    return () => {
      // Save to parent when unmounting (e.g. sidebar click)
      if (onUpdateDraft) {
        onUpdateDraft(draftRef.current);
      }
    };
  }, []);

  /* ===== INIT FROM PROPS (EDIT MODE) ===== */
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === 'dark';

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [checkingEsp32, setCheckingEsp32] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ===== INIT FROM PROPS (EDIT MODE) ===== */
  const isEditMode = !!(initialData?.session_id || initialData?.event_id); // 🆕 Check if editing existing session

  /* ===== INIT FROM PROPS (EDIT MODE) ===== */
  useEffect(() => {
    if (initialData) {
      setEventName(initialData.eventName || initialData.event_name || "");
      setEventType(initialData.eventType || initialData.event_type || null);
      setLocation(initialData.location || "");
      setField(initialData.field || "");
      setNotes(initialData.notes || "");
      setSelectedDate(initialData.eventDate || initialData.event_date || null);

      // In edit mode or if coming back with a file, mark as connected
      setEsp32Connected(true);

      // If we have a previous file selection, use it, otherwise use placeholder for edit mode
      if (initialData.file) {
        setSelectedFile(initialData.file);
      } else if (isEditMode) {
        setSelectedFile("EXISTING_FILE");
      }
    }
  }, [initialData, isEditMode]);

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

      // Load Suggestions from SQLite
      const loadSuggestions = async () => {
        try {
          const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);

          let locRes, fieldsRes;
          if (clubId) {
            locRes = db.execute(`SELECT DISTINCT location FROM sessions WHERE club_id = ? AND location IS NOT NULL AND location != '' ORDER BY location ASC`, [clubId]);
            fieldsRes = db.execute(`SELECT DISTINCT field FROM sessions WHERE club_id = ? AND field IS NOT NULL AND field != '' ORDER BY field ASC`, [clubId]);
          } else {
            locRes = db.execute(`SELECT DISTINCT location FROM sessions WHERE location IS NOT NULL AND location != '' ORDER BY location ASC`);
            fieldsRes = db.execute(`SELECT DISTINCT field FROM sessions WHERE field IS NOT NULL AND field != '' ORDER BY field ASC`);
          }

          const locs = (locRes as any)?.rows?._array || [];
          const fields = (fieldsRes as any)?.rows?._array || [];

          setLocationSuggestions(locs.map((l: any) => l.location));
          setFieldSuggestions(fields.map((f: any) => f.field));
        } catch (e) {
          console.log("Suggestions error:", e);
        }
      };
      loadSuggestions();

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
    eventType &&
    selectedDate &&
    selectedFile &&
    esp32Connected;

  /* ===== ACTION HANDLER ===== */
  const onNext = async () => {
    if (!canProceed) {
      showAlert({
        title: "Incomplete",
        message: "Fill all required fields",
        type: 'warning',
      });
      return;
    }

    /* 🟢 UPDATE MODE */
    if (isEditMode) {
      try {
        // 1. Update SQLite
        const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
        await db.execute(
          `UPDATE sessions 
             SET event_name = ?, event_type = ?, location = ?, field = ?, notes = ?, event_date = ?, club_id = ?
             WHERE session_id = ?`,
          [eventName, eventType, location, field, notes, selectedDate, clubId, initialData.session_id]
        );

        // Mark as pending sync until backend confirms
        await db.execute(`UPDATE sessions SET synced_backend = 0 WHERE session_id = ?`, [initialData.session_id]);

        // 2. Try Backend Update
        try {
          await api.patch(`/events/session/${initialData.session_id}`, {
            event_name: eventName,
            event_type: eventType,
            event_date: selectedDate,
            location,
            field,
            ground_name: field,
            notes,
          });
          await db.execute(`UPDATE sessions SET synced_backend = 1 WHERE session_id = ?`, [initialData.session_id]);
        } catch (apiErr) {
          console.warn("⚠️ Backend update failed, will sync later:", apiErr);
        }

        showAlert({
          title: "Success",
          message: "Event updated successfully",
          type: 'success',
        });
        goBack(); // Return to ManageEvents
      } catch (err) {
        console.error("Update failed", err);
        showAlert({
          title: "Error",
          message: "Failed to update event",
          type: 'error',
        });
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


  /* ===== EVENT TYPE INLINE DROPDOWN ===== */
  const [isEventTypeOpen, setIsEventTypeOpen] = useState(false);

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

        {/* EVENT TYPE - INLINE DROPDOWN */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Event Type *</Text>
          <TouchableOpacity
            style={[styles.dropdown, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
            onPress={() => setIsEventTypeOpen(!isEventTypeOpen)}
          >
            <Text style={{ color: isDark ? '#fff' : (eventType ? '#000' : '#94A3B8'), textTransform: 'capitalize' }}>
              {eventType || 'Select Type'}
            </Text>
            <Ionicons name={isEventTypeOpen ? "chevron-up" : "chevron-down"} size={18} color="#94A3B8" />
          </TouchableOpacity>

          {isEventTypeOpen && (
            <View style={[styles.inlineDropdown, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: isDark ? '#334155' : '#E2E8F0', zIndex: 1000 }]}>
              <TouchableOpacity
                style={styles.dropdownOption}
                onPress={() => { setEventType('match'); setIsEventTypeOpen(false); }}
              >
                <Text style={{ color: isDark ? '#fff' : '#000' }}>Match</Text>
                {eventType === 'match' && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dropdownOption, { borderBottomWidth: 0 }]}
                onPress={() => { setEventType('training'); setIsEventTypeOpen(false); }}
              >
                <Text style={{ color: isDark ? '#fff' : '#000' }}>Training</Text>
                {eventType === 'training' && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.formRow, { zIndex: 500 }]}>
        {/* LOCATION WITH SUGGESTIONS */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Location</Text>
          <View>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
              value={location}
              onChangeText={(txt) => {
                setLocation(txt);
                setShowLocSuggestions(true);
              }}
              onFocus={() => setShowLocSuggestions(true)}
              placeholder="Enter or select location"
              placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
            />
            {showLocSuggestions && locationSuggestions.filter(s => s.toLowerCase().includes(location.toLowerCase())).length > 0 && (
              <View style={[styles.suggestionList, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                  {locationSuggestions
                    .filter(s => s.toLowerCase().includes(location.toLowerCase()))
                    .map((item, idx) => (
                      <TouchableOpacity
                        key={`loc-${idx}`}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setLocation(item);
                          setShowLocSuggestions(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={{ color: isDark ? '#fff' : '#000' }}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* GROUND NAME WITH SUGGESTIONS */}
        <View style={styles.fieldBlockHalf}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Ground Name</Text>
          <View>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
              value={field}
              onChangeText={(txt) => {
                setField(txt);
                setShowFieldSuggestions(true);
              }}
              onFocus={() => setShowFieldSuggestions(true)}
              placeholder="Enter or select ground"
              placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
            />
            {showFieldSuggestions && fieldSuggestions.filter(s => s.toLowerCase().includes(field.toLowerCase())).length > 0 && (
              <View style={[styles.suggestionList, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                  {fieldSuggestions
                    .filter(s => s.toLowerCase().includes(field.toLowerCase()))
                    .map((item, idx) => (
                      <TouchableOpacity
                        key={`field-${idx}`}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setField(item);
                          setShowFieldSuggestions(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={{ color: isDark ? '#fff' : '#000' }}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>
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
          <Ionicons name="chevron-down" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* CSV SECTION */}
      {!isEditMode && selectedDate && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Available Performance Files</Text>
          {renderCsvSection()}
        </View>
      )}

      {/* NOTES */}
      <View style={[styles.fieldBlockFull, { marginTop: 12 }]}>
        <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#374151' }]}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#fff' : '#000' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Enter notes..."
          placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
          multiline
        />
      </View>
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

    // ✅ NO CSV SELECTED → SHOW LIST (FIXED SIZE, 4 ITEMS MAX VISIBLE AT A TIME)
    return (
      <View style={[styles.fileBox, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#e5e7eb' }]}>
        <ScrollView style={{ height: 180 }} nestedScrollEnabled>
          {filesForDate.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.fileOption, { borderColor: isDark ? '#334155' : '#e5e7eb', height: 45, justifyContent: 'center' }]}
              onPress={() => setSelectedFile(item)}
            >
              <Text numberOfLines={1} style={{ color: isDark ? '#E2E8F0' : '#000' }}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

      </View>

    );
  };


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


  return (
    <TouchableOpacity
      activeOpacity={1}
      style={{ flex: 1 }}
      onPress={() => {
        setShowLocSuggestions(false);
        setShowFieldSuggestions(false);
        setIsEventTypeOpen(false);
        Keyboard.dismiss();
      }}
    >
      <View style={[styles.screen, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
        {/* MAIN CONTENT AREA */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          {/* HEADER - Conditionally show based on keyboard status */}
          {!isKeyboardVisible && (
            <View style={styles.header}>
              <View style={[styles.topBar, { backgroundColor: isDark ? '#020617' : '#FFFFFF', borderBottomWidth: 0 }]}>
                <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                  <Text style={[styles.backText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Back to sessions</Text>
                </TouchableOpacity>
              </View>

              {/* STEPS */}
              <StepHeader current={0} isDark={isDark} />
            </View>
          )}

          {/* TOP BAR REPLACEMENT FOR WHEN KEYBOARD IS OPEN */}
          {isKeyboardVisible && (
            <View style={[styles.topBar, { backgroundColor: isDark ? '#020617' : '#FFFFFF', borderBottomWidth: 1, borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
              <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                <Text style={[styles.backText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Back</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: '700', color: isDark ? '#fff' : '#000' }}>Session Details</Text>
              <View style={{ width: 40 }} />
            </View>
          )}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.content}
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

          {/* ===== FIXED BOTTOM BAR (INSIDE KAV TO MOVE WITH KEYBOARD) ===== */}
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
                  {isEditMode ? "UPDATE SESSION" : "Next"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>


        <Modal
          visible={datePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDatePickerOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDatePickerOpen(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}
            >
              <Calendar
                theme={{
                  calendarBackground: isDark ? '#1E293B' : '#fff',
                  textSectionTitleColor: isDark ? '#E2E8F0' : '#2d4150',
                  selectedDayBackgroundColor: PRIMARY,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: PRIMARY,
                  dayTextColor: isDark ? '#fff' : '#2d4150',
                  textDisabledColor: isDark ? '#475569' : '#d9e1e8',
                  monthTextColor: isDark ? '#fff' : '#2d4150',
                  arrowColor: PRIMARY,
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                }}
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
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </TouchableOpacity>
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

  inlineDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  dropdownOption: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },

  suggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    zIndex: 5000,
    elevation: 15,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
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
    width: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
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
