import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CustomButton from "../../components/CustomButton";
import { registerSuperAdmin } from "../../api/auth";
import { STORAGE_KEYS } from "../../utils/constants";
import api from "../../api/axios";
import { useAuth } from "../../components/context/AuthContext";
import { useAlert } from "../../components/context/AlertContext";

const RegisterScreen = ({ navigation }: any) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { setAuth } = useAuth();
  const { showAlert } = useAlert();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get('/auth/has-super-admin');
        const exists = res.data?.data?.exists;

        if (exists) {
          navigation.replace('Login');
        }
      } catch {
        navigation.replace('Login');
      }
    };

    check();
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      return showAlert({
        title: "Error",
        message: "All fields are required",
        type: 'warning',
      });
    }

    if (password !== confirm) {
      return showAlert({
        title: "Error",
        message: "Passwords do not match",
        type: 'warning',
      });
    }

    try {
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
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.message?.message ||
        "Registration failed";

      showAlert({
        title: "Register failed",
        message: String(msg),
        type: 'error',
      });
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
          <Text style={styles.heading}>Create Super Admin</Text>
          <Text style={styles.subtitle}>Enter your details below</Text>

          {/* NAME */}
          <TextInput
            placeholder="Name"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor="#ddd"
          />

          {/* EMAIL */}
          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            placeholderTextColor="#ddd"
            keyboardType="email-address"
          />

          {/* PHONE */}
          <TextInput
            placeholder="Phone"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholderTextColor="#ddd"
            keyboardType="phone-pad"
          />

          {/* PASSWORD */}
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="Password"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#ddd"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={22}
                color="#ccc"
              />
            </TouchableOpacity>
          </View>

          {/* CONFIRM PASSWORD */}
          <View style={styles.passwordRow}>
            <TextInput
              placeholder="Confirm Password"
              secureTextEntry={!showConfirm}
              style={styles.passwordInput}
              value={confirm}
              onChangeText={setConfirm}
              placeholderTextColor="#ddd"
            />
            <TouchableOpacity
              onPress={() => setShowConfirm((prev) => !prev)}
            >
              <Ionicons
                name={showConfirm ? "eye-outline" : "eye-off-outline"}
                size={22}
                color="#ccc"
              />
            </TouchableOpacity>
          </View>

          <CustomButton title="Register" onPress={handleRegister} />

          <TouchableOpacity onPress={() => navigation.replace("Login")}>
            <Text style={styles.link}>← Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

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
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
  },

  subtitle: {
    color: "#ddd",
    marginBottom: 20,
    marginTop: 6,
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

  link: {
    color: "#fff",
    textAlign: "center",
    marginTop: 16,

  },
});

export default RegisterScreen;
