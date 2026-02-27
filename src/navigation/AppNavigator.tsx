import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../utils/constants';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPassword from '../screens/Auth/ForgotPassword';
import ResetPassword from '../screens/Auth/ResetPassword';

import SuperAdminHome from '../screens/SuperAdmin/SuperAdminHome';
import ClubAdminHome from '../screens/ClubAdmin/ClubAdminHome';
import CoachHome from '../screens/Coach/CoachHome';
import AuthLoadingScreen from '../screens/Auth/AuthLoadingScreen';
import ClubStatusGuard from '../components/Common/ClubStatusGuard';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <ClubStatusGuard />
      <Stack.Navigator
        initialRouteName="AuthLoadingScreen"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="AuthLoadingScreen" component={AuthLoadingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="ResetPassword" component={ResetPassword} />

        {/* SUPER ADMIN */}
        <Stack.Screen
          name="SuperAdminHome"
          component={SuperAdminHome}
        />

        {/* OTHER ROLES */}
        <Stack.Screen name="ClubAdminHome" component={ClubAdminHome} />
        <Stack.Screen name="CoachHome" component={CoachHome} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
