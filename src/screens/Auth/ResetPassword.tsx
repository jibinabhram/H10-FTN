import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ImageBackground,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/CustomButton";
import { resetPassword } from "../../api/auth";
import { useAlert } from "../../components/context/AlertContext";

const ResetPassword = ({ navigation }: any) => {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const { showAlert } = useAlert();

  React.useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleReset = async () => {
    if (!token || !password || !confirmPassword) {
      return showAlert({
        title: "Error",
        message: "All fields are required",
        type: 'warning',
      });
    }

    if (password !== confirmPassword) {
      return showAlert({
        title: "Error",
        message: "Passwords do not match",
        type: 'warning',
      });
    }

    try {
      await resetPassword({
        token: token.trim().toUpperCase(),
        password,
      });

      showAlert({
        title: "Success",
        message: "Password updated successfully",
        type: 'success',
        buttons: [
          { text: "OK", onPress: () => navigation.replace("Login") },
        ]
      });
    } catch (err: any) {
      const msg =
        typeof err?.response?.data?.message === "string"
          ? err.response.data.message
          : "Invalid or expired token";

      showAlert({
        title: "Error",
        message: msg,
        type: 'error',
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <ImageBackground
        source={require("../../assets/loginbackground.png")}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: isKeyboardVisible ? "flex-start" : "center",
              paddingBottom: isKeyboardVisible ? 40 : 0
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.root}>
                <View style={[styles.card, { marginTop: isKeyboardVisible ? 10 : 0 }]}>
                  {isKeyboardVisible ? (
                    <Text style={[styles.heading, { fontSize: 18, marginBottom: 8 }]}>Reset Password</Text>
                  ) : (
                    <Text style={styles.heading}>Reset Password</Text>
                  )}

                  <TextInput
                    placeholder="Verification Code"
                    value={token}
                    onChangeText={setToken}
                    style={styles.input}
                    placeholderTextColor="#ddd"
                    autoCapitalize="characters"
                  />

                  <TextInput
                    placeholder="New Password"
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                    secureTextEntry
                    placeholderTextColor="#ddd"
                  />

                  <TextInput
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.input}
                    secureTextEntry
                    placeholderTextColor="#ddd"
                  />

                  <CustomButton title="Reset Password" onPress={handleReset} />

                  <TouchableOpacity
                    onPress={() => navigation.replace("Login")}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backText}>← Back to Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  card: {
    width: "100%",
    maxWidth: 420, // same as Login & Register
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
    marginBottom: 16,
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

  backBtn: {
    marginTop: 16,
    alignSelf: "center",
  },

  backText: {
    color: "#fff",
    fontSize: 15,

  },
});

export default ResetPassword;
