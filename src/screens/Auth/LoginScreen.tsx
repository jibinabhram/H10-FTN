import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ImageBackground,
} from "react-native";

import Ionicons from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CustomButton from "../../components/CustomButton";
import { loginUser, verifyLoginOtp } from "../../api/auth";
import { STORAGE_KEYS } from "../../utils/constants";
import { useAuth } from "../../components/context/AuthContext";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setAuth } = useAuth();

  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const safeAlert = (title: string, msg: string) => {
    requestAnimationFrame(() => {
      if (mounted.current && navigation.isFocused()) {
        Alert.alert(title, msg);
      }
    });
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  };

  useEffect(() => {
    if (otpStep && timer > 0) {
      const t = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
    if (timer === 0) setCanResend(true);
  }, [otpStep, timer]);

  const getErrorMessage = (err: any) => {
    const msg = err?.response?.data?.message;
    if (!msg) return "Something went wrong";
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg[0];
    if (msg?.message) return msg.message;
    return "Unexpected error";
  };

  const handleLogin = async () => {
    if (!email || !password)
      return safeAlert("Error", "Email & Password are required");

    if (!isValidEmail(email))
      return safeAlert("Invalid Email", "Enter a valid email");

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
      const status = err?.response?.status;
      const msg = getErrorMessage(err).toLowerCase();

      if (
        status === 401 ||
        msg.includes("invalid") ||
        msg.includes("not found")
      ) {
        safeAlert("Invalid Credentials", "Invalid username or password");
      } else {
        safeAlert("Login Failed", getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return safeAlert("Error", "Please enter OTP");

    try {
      setLoading(true);
      const res = await verifyLoginOtp({ email, otp });

      if (!res?.access_token)
        return safeAlert("Error", "Invalid login response");

      const clubId = res.club_id ?? res?.user?.club_id;

      await setAuth({
        role: res.role,
        token: res.access_token,
        clubId,
      });

      navigation.reset({
        index: 0,
        routes: [
          {
            name:
              res.role === "SUPER_ADMIN"
                ? "SuperAdminHome"
                : res.role === "CLUB_ADMIN"
                  ? "ClubAdminHome"
                  : "CoachHome",
          },
        ],
      });

    } catch (err: any) {
      const msg = getErrorMessage(err).toLowerCase();
      if (msg.includes("invalid") || msg.includes("expired")) {
        safeAlert("OTP Error", "OTP invalid or expired");
      } else {
        safeAlert("OTP Error", getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    try {
      const res = await loginUser({ email, password });
      if (res.needOtp) {
        setTimer(30);
        setCanResend(false);
        safeAlert("OTP Resent", "New OTP sent");
      }
    } catch (err: any) {
      safeAlert("Error", getErrorMessage(err));
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/loginbackground.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.heading}>Welcome Back 👋</Text>
          <Text style={styles.subtitle}>
            {otpStep ? "Enter your OTP" : "Login to continue"}
          </Text>

          {/* EMAIL */}
          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#ddd"
            editable={!otpStep}
            autoCapitalize="none"
          />

          {!otpStep && (
            <>
              <View style={styles.passwordRow}>
                <TextInput
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={22}
                    color="#ccc"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate("ForgotPassword")}
              >
                <Text style={styles.forgot}>Forgot Password?</Text>
              </TouchableOpacity>

              <CustomButton
                title={loading ? "Please wait..." : "Login"}
                onPress={handleLogin}
              />
            </>
          )}

          {otpStep && (
            <>
              <TextInput
                placeholder="Enter OTP"
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor="#ddd"
              />

              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={!canResend}
              >
                <Text
                  style={[
                    styles.resendText,
                    { color: canResend ? "#fff" : "#999" },
                  ]}
                >
                  {canResend ? "Resend OTP" : `Resend in ${timer}s`}
                </Text>
              </TouchableOpacity>

              <CustomButton
                title={loading ? "Please wait..." : "Verify OTP"}
                onPress={handleVerifyOtp}
              />

              <TouchableOpacity
                onPress={() => {
                  setOtp("");
                  setOtpStep(false);
                  setTimer(30);
                  setCanResend(false);
                }}
              >
                <Text style={styles.backText}>← Back to Login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 26,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  heading: {
    fontSize: 26,
    color: "#fff",
    fontWeight: "700",
  },
  subtitle: {
    color: "#ddd",
    marginVertical: 12,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    marginTop: 14,
  },
  passwordRow: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 14,
  },
  passwordInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 12,
  },
  iconBtn: {
    paddingLeft: 10,
  },
  forgot: {
    color: "#fff",
    textAlign: "right",
    marginTop: 8,

  },
  resendText: {
    textAlign: "center",
    marginTop: 10,
  },
  backText: {
    textAlign: "center",
    marginTop: 14,
    color: "#fff",

  },
});
