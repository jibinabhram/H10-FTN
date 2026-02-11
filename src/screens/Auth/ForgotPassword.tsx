import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ImageBackground,
  TouchableOpacity,
} from "react-native";
import CustomButton from "../../components/CustomButton";
import { forgotPassword } from "../../api/auth";
import { useAlert } from "../../components/context/AlertContext";

const ForgotPassword = ({ navigation }: any) => {
  const [email, setEmail] = useState("");
  const { showAlert } = useAlert();

  const handleSubmit = async () => {
    if (!email) {
      return showAlert({
        title: "Error",
        message: "Enter email",
        type: 'error',
      });
    }

    try {
      await forgotPassword(email);

      showAlert({
        title: "Success",
        message: "If an account with this email exists, a reset code was sent.",
        type: 'success',
        buttons: [
          {
            text: "OK",
            onPress: () => navigation.navigate("ResetPassword"),
          },
        ]
      });
    } catch {
      showAlert({
        title: "Error",
        message: "Something went wrong",
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
          <Text style={styles.heading}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your email to receive reset instructions
          </Text>

          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#ddd"
            autoCapitalize="none"
          />

          <CustomButton title="Submit" onPress={handleSubmit} />

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
    maxWidth: 420, // Same fixed size as Login / Register / Reset
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
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
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

  link: {
    color: "#fff",
    textAlign: "center",
    marginTop: 16,

  },
});

export default ForgotPassword;
