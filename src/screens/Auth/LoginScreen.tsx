import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  Keyboard,
  Image,
  StatusBar,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { loginUser, verifyLoginOtp } from "../../api/auth";
import { useAuth } from "../../components/context/AuthContext";
import { useAlert } from "../../components/context/AlertContext";

const { width: SCR_WIDTH } = Dimensions.get("window");
const IS_WIDE = SCR_WIDTH > 800;
const PRIMARY_RED = "#DC2626";

export default function LoginScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const { setAuth } = useAuth();
  const { showAlert } = useAlert();

  const [otpStep, setOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (otpStep && timer > 0) {
      const t = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
    if (timer === 0) setCanResend(true);
  }, [otpStep, timer]);

  const safeAlert = (title: string, msg: string) => {
    let type: 'error' | 'success' | 'warning' | 'info' = 'info';
    const t = title.toLowerCase();
    if (t.includes('error') || t.includes('fail') || t.includes('invalid')) type = 'error';
    if (t.includes('sent') || t.includes('success') || t.includes('resent')) type = 'success';
    if (t.includes('incomplete') || t.includes('missing')) type = 'warning';

    showAlert({ title, message: msg, type, skipNotification: true });
  };

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());

  const handleLogin = async () => {
    if (!email || !password) return safeAlert("Error", "Email & Password are required");
    if (!isValidEmail(email)) return safeAlert("Invalid Email", "Enter a valid email");

    try {
      setLoading(true);
      const res = await loginUser({ email, password });
      if (res.needOtp) {
        setOtpStep(true);
        setTimer(30);
        setCanResend(false);
        safeAlert("OTP Sent", "Please check your email");
        return;
      }
      safeAlert("Error", "Unexpected server response");
    } catch (err: any) {
      safeAlert("Login Failed", err?.response?.data?.message || err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return safeAlert("Error", "Please enter OTP");
    try {
      setLoading(true);
      const res = await verifyLoginOtp({ email, otp });
      if (!res?.access_token) return safeAlert("Error", "Invalid login response");

      const clubId = res.club_id ?? res?.user?.club_id;
      await setAuth({ role: res.role, token: res.access_token, clubId });

      navigation.reset({
        index: 0,
        routes: [{ name: res.role === "SUPER_ADMIN" ? "SuperAdminHome" : res.role === "CLUB_ADMIN" ? "ClubAdminHome" : "CoachHome" }],
      });
    } catch (err: any) {
      safeAlert("OTP Error", err?.response?.data?.message || "Invalid or expired OTP");
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
                {/* Developer Logo */}
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

                <Text style={styles.formTitle}>Sign In</Text>
                <Text style={styles.formSubtitle}>Access your squad's performance dashboard</Text>

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
                      editable={!otpStep}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* PASSWORD FIELD */}
                {!otpStep && (
                  <>
                    <View style={styles.inputGroup}>
                      <View style={styles.labelRow}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
                          <Text style={styles.linkTextSmall}>Forgot password?</Text>
                        </TouchableOpacity>
                      </View>
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

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                      <Ionicons name="arrow-forward-outline" size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  </>
                )}

                {/* OTP FIELD */}
                {otpStep && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Enter OTP</Text>
                      <View style={[styles.inputWrapper, styles.filledInput]}>
                        <Ionicons name="key-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="000000"
                          placeholderTextColor="#9CA3AF"
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      </View>
                      <TouchableOpacity onPress={() => console.log("resend")} disabled={!canResend} style={{ marginTop: 8 }}>
                        <Text style={{ color: canResend ? PRIMARY_RED : "#9CA3AF", fontSize: 13 }}>
                          {canResend ? "Resend OTP" : `Resend in ${timer}s`}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOtp} disabled={loading}>
                      <Text style={styles.primaryBtnText}>Verify OTP</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setOtpStep(false)} style={{ marginTop: 20, alignSelf: 'center' }}>
                      <Text style={{ color: "#6B7280" }}>← Back to Login</Text>
                    </TouchableOpacity>
                  </>
                )}




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

  pulseContainer: { height: 100, justifyContent: 'center', marginVertical: 10, position: 'relative' },
  mainLine: { height: 2, backgroundColor: PRIMARY_RED, width: "100%", opacity: 0.5 },
  pulseIcon: { position: 'absolute', left: 40, bottom: -10 },

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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280" },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  dottedInput: {
    borderColor: PRIMARY_RED,
    borderStyle: 'dashed',
    backgroundColor: "#fff",
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
  linkTextSmall: { color: PRIMARY_RED, fontSize: 14, fontWeight: "600" },

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

  footerLinks: { flexDirection: "row", justifyContent: "center", marginTop: 35 },
  linkTextInner: { color: PRIMARY_RED, fontWeight: "800", textDecorationLine: 'underline' },
  legalText: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginTop: 15, lineHeight: 18 },
});
