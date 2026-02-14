import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from "react";
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from "@react-native-community/netinfo";

import { ThemeProvider } from './src/components/context/ThemeContext';
import { AuthProvider } from './src/components/context/AuthContext';
import { AlertProvider } from './src/components/context/AlertContext';
import { SnackbarProvider } from './src/components/context/SnackbarContext';
import AppNavigator from './src/navigation/AppNavigator';
import { initDB } from "./src/db/schema";
import { syncPendingMetrics } from "./src/services/syncMetrics.service";

const App = () => {

  // 🔹 1️⃣ INIT DB ON APP START (ONLY ONCE)
  useEffect(() => {
    initDB();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <SnackbarProvider>
            <AlertProvider>
              <StatusBar barStyle="light-content" />
              <AppNavigator />
            </AlertProvider>
          </SnackbarProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default App;
