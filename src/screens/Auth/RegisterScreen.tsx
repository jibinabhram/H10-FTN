import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Image,
  StatusBar,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import api from "../../api/axios";
import { registerSuperAdmin } from "../../api/auth";
import { useAuth } from "../../components/context/AuthContext";
import { useAlert } from "../../components/context/AlertContext";

const { width: SCR_WIDTH } = Dimensions.get("window");
const IS_WIDE = SCR_WIDTH > 800;
const PRIMARY_RED = "#DC2626";

export default function RegisterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { setAuth } = useAuth();
  const { showAlert } = useAlert();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get('/auth/has-super-admin');
        if (res.data?.data?.exists) {
          navigation.replace('Login');
        }
      } catch {
        navigation.replace('Login');
      }
    };
    check();
  }, [navigation]);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      return showAlert({
        title: "Incomplete",
        message: "All fields are required",
        type: 'warning',
        skipNotification: true,
      });
    }

    if (password !== confirm) {
      return showAlert({
        title: "Error",
        message: "Passwords do not match",
        type: 'warning',
        skipNotification: true,
      });
    }

    try {
      setLoading(true);
      const data = await registerSuperAdmin({
        name,
        email,
        phone,
        password,
      });

      await setAuth({
        role: data.role,
        token: data.access_token,
      });

      navigation.replace("SuperAdminHome");
    } catch (error: any) {
      showAlert({
        title: "Register Failed",
        message: error?.response?.data?.message || "Registration failed",
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
        <View style={[styles.authContentContainer, { paddingTop: insets.top + 30 }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 80}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.formWrapper}>
                {!IS_WIDE && (
                  <View style={styles.logoRowMobile}>
                    <Image source={require("../../assets/images/logo.png")} style={styles.logoImageMobile} resizeMode="contain" />
                  </View>
                )}

                <Text style={styles.formTitle}>Register</Text>
                <Text style={styles.formSubtitle}>Create a Super Admin account to get started</Text>

                {/* NAME FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'name' && styles.focusedInput
                  ]}>
                    <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#9CA3AF"
                      value={name}
                      onChangeText={setName}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* EMAIL FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'email' && styles.focusedInput
                  ]}>
                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* PHONE FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'phone' && styles.focusedInput
                  ]}>
                    <Ionicons name="call-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number"
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* PASSWORD FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'password' && styles.focusedInput
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CONFIRM PASSWORD FIELD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={[
                    styles.inputWrapper,
                    styles.filledInput,
                    focusedField === 'confirm' && styles.focusedInput
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showConfirm}
                      value={confirm}
                      onChangeText={setConfirm}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                      <Ionicons name={showConfirm ? "eye-outline" : "eye-off-outline"} size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Register"}</Text>
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
  scrollContent: { flexGrow: 1 },
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

  backToLoginBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 15, marginBottom: 40 },
  backToLoginText: { color: PRIMARY_RED, fontWeight: '700', fontSize: 15 },

  legalText: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 15, lineHeight: 18 },
});
