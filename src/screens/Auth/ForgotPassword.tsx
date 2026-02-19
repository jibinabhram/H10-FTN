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

import { forgotPassword } from "../../api/auth";
import { useAlert } from "../../components/context/AlertContext";

const { width: SCR_WIDTH } = Dimensions.get("window");
const IS_WIDE = SCR_WIDTH > 800;
const PRIMARY_RED = "#DC2626";

export default function ForgotPassword({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const handleSubmit = async () => {
    if (!email) {
      return showAlert({
        title: "Error",
        message: "Please enter your email address",
        type: 'error',
      });
    }

    try {
      setLoading(true);
      await forgotPassword(email);

      showAlert({
        title: "Success",
        message: "If an account with this email exists, a reset code was sent.",
        type: 'success',
        skipNotification: true,
        buttons: [
          {
            text: "OK",
            onPress: () => navigation.navigate("ResetPassword"),
          },
        ]
      });
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err?.response?.data?.message || "Something went wrong",
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

                <Text style={styles.formTitle}>Forgot Password</Text>
                <Text style={styles.formSubtitle}>Enter your email to receive reset instructions</Text>

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
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? "Sending..." : "Submit"}</Text>
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
