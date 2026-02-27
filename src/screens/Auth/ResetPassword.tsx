import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  StatusBar,
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { resetPassword } from "../../api/auth";
import { useAlert } from "../../components/context/AlertContext";
import { validatePassword, ValidationResult } from "../../utils/validation";
import PasswordRequirementList from "../../components/Auth/PasswordRequirementList";

const { width: SCR_WIDTH } = Dimensions.get("window");
const IS_WIDE = SCR_WIDTH > 800;
const PRIMARY_RED = "#DC2626";

export default function ResetPassword({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordValidation, setPasswordValidation] = useState<ValidationResult | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val) {
      const v = validatePassword(val);
      setPasswordValidation(v);
    } else {
      setPasswordValidation(null);
    }
  };

  const handleReset = async () => {
    if (!token || !password || !confirmPassword) {
      return showAlert({
        title: "Incomplete",
        message: "All fields are required",
        type: 'warning',
        skipNotification: true,
      });
    }

    if (passwordValidation && !passwordValidation.isValid) {
      return;
    }

    if (password !== confirmPassword) {
      return showAlert({
        title: "Error",
        message: "Passwords do not match",
        type: 'warning',
        skipNotification: true,
      });
    }

    try {
      setLoading(true);
      await resetPassword({
        token: token.trim().toUpperCase(),
        password,
      });

      showAlert({
        title: "Success",
        message: "Password updated successfully",
        type: 'success',
        skipNotification: true,
        buttons: [
          { text: "OK", onPress: () => navigation.replace("Login") },
        ]
      });
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err?.response?.data?.message || "Invalid or expired token",
        type: 'error',
        skipNotification: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent={false} backgroundColor="#000" />

      {/* 🟢 HERO SECTION (LEFT) */}
      {IS_WIDE && (
        <View style={styles.heroSide}>
          <ImageBackground
            source={require("../../assets/background.png")}
            style={styles.heroBg}
            resizeMode="cover"
          >
            <View style={styles.heroOverlay} />
            <View style={[styles.heroContent, { paddingTop: 60, paddingBottom: 30 }]}>
              {/* Logo Area - Top Left */}
              <View style={styles.logoRow}>
                <Image
                  source={require("../../assets/images/logo.png")}
                  style={styles.logoImageHero}
                  resizeMode="contain"
                />
              </View>

              {/* Central Content Area */}
              <View style={styles.centerContent}>
                <View style={styles.taglineBox}>
                  <Text style={styles.heroTitle}>MONITOR.{"\n"}ANALYSE.{"\n"}DOMINATE.</Text>
                </View>

                <Text style={styles.heroSubtitle}>
                  Real-time heart rate, GPS tracking and biometric data{"\n"}
                  for every player on your squad — all in one platform.
                </Text>
              </View>

              {/* Copyright at the very bottom */}
              <View style={styles.heroFooterRow}>
                <Text style={styles.heroFooterText}>© 2026 Developed by </Text>
                <Image
                  source={require("../../assets/IMG_0628.png")}
                  style={styles.footerLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </ImageBackground>
        </View>
      )}

      {/* 🔴 AUTH SECTION (RIGHT) */}
      <View style={styles.authSide}>
        <View style={[styles.authContentContainer, { paddingTop: insets.top, paddingBottom: insets.bottom || 20, justifyContent: 'center' }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            style={{ flex: 1, justifyContent: 'center' }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 60}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.formWrapper}>
                {!IS_WIDE && (
                  <View style={styles.logoRowMobile}>
                    <Image source={require("../../assets/images/logo.png")} style={styles.logoImageMobile} resizeMode="contain" />
                  </View>
                )}

                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>Complete the form below to reset your account password</Text>

                {/* TOKEN FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'token' && styles.focusedInput
                  ]}>
                    <Ionicons name="key-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { textTransform: 'uppercase' }]}
                      placeholder="Verification Code"
                      placeholderTextColor="#9CA3AF"
                      value={token}
                      onChangeText={setToken}
                      autoCapitalize="characters"
                      onFocus={() => setFocusedField('token')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* PASSWORD FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'password' && styles.focusedInput
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      value={password}
                      onChangeText={handlePasswordChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                  {passwordValidation ? <PasswordRequirementList requirements={passwordValidation.requirements} /> : null}
                </View>

                {/* CONFIRM PASSWORD FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'confirm' && styles.focusedInput
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleReset}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? "Resetting..." : "Reset Password"}</Text>
                  {!loading && <Ionicons name="arrow-forward-outline" size={18} color="#fff" style={{ marginLeft: 8 }} />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.replace("Login")}
                  style={styles.backToLoginBtn}
                >
                  <Ionicons name="arrow-back-outline" size={18} color={PRIMARY_RED} style={{ marginRight: 8 }} />
                  <Text style={styles.backToLoginText}>
                    Back to Login
                  </Text>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#fff" },

  heroSide: { flex: 1.1, height: "100%" },
  heroBg: { flex: 1, width: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  heroContent: { flex: 1, paddingHorizontal: 40, justifyContent: 'space-between' },

  logoRow: { flexDirection: "row", alignItems: "center", alignSelf: 'flex-start' },
  logoImageHero: { width: 140, height: 60 },

  centerContent: { flex: 1, justifyContent: 'center', marginTop: 33 },
  taglineBox: { marginBottom: 145 },
  heroTitle: { color: "#fff", fontSize: 44, fontWeight: "900", lineHeight: 68, letterSpacing: -1 },

  heroSubtitle: { color: "#E5E7EB", fontSize: 15, lineHeight: 24, opacity: 0.9, marginTop: 20, marginBottom: 39 },

  heroFooterRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  heroFooterText: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: '500' },
  footerLogo: { width: 80, height: 20, marginLeft: 2 },

  authSide: { flex: 1, backgroundColor: "#FFF" },
  authContentContainer: { flex: 1, paddingHorizontal: IS_WIDE ? 80 : 30 },
  formWrapper: { width: "100%", maxWidth: 600, alignSelf: "center", paddingVertical: 20 },

  logoRowMobile: { marginBottom: 30, alignItems: 'center' },
  logoImageMobile: { width: 140, height: 40 },

  formTitle: { fontSize: IS_WIDE ? 36 : 24, fontWeight: "800", color: PRIMARY_RED },
  formSubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 12 },

  inputGroup: { marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginBottom: 4 },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  filledInput: {
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  focusedInput: {
    borderColor: PRIMARY_RED,
    borderStyle: 'solid',
  },

  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, height: "100%", color: "#000" },

  primaryBtn: {
    backgroundColor: PRIMARY_RED,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  backToLoginBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 15 },
  backToLoginText: { color: PRIMARY_RED, fontWeight: '700', fontSize: 15 },

  legalText: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 15, lineHeight: 18 },
});
