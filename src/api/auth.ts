import api from './axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
// UNWRAP CORRECT LEVEL: res.data.data
const unwrap = (res: any) => res.data?.data || res.data;

// REGISTER SUPER ADMIN
export const registerSuperAdmin = async (payload) => {
  const res = await api.post('/auth/register', payload);
  return unwrap(res);
};

// LOGIN
export const loginUser = async (payload) => {
  const res = await api.post('/auth/login', payload);
  return unwrap(res); // returns { needOtp, email, message }
};

// VERIFY OTP
export const verifyLoginOtp = async (payload) => {
  const res = await api.post('/auth/verify-login-otp', payload);
  return unwrap(res);
};

// PROFILE
export const fetchProfile = async () => {
  const res = await api.get('/auth/profile');

  // BACKEND FORMAT: { role, user }
  if (!res.data?.data?.user) {
    throw new Error('Invalid profile response');
  }

  return {
    role: res.data.data.role,
    ...res.data.data.user, // ← FLATTEN
  };
};


// FORGOT PASSWORD
export const forgotPassword = async (email) => {
  const res = await api.post('/auth/forgot-password', { email });
  return unwrap(res);
};

// RESET PASSWORD
export const resetPassword = async (payload) => {
  const res = await api.post('/auth/reset-password', payload);
  return unwrap(res);
};

// CHANGE PASSWORD (authenticated — requires old password)
export const changePassword = async (payload: { oldPassword: string; newPassword: string }) => {
  const res = await api.post('/auth/change-password', payload);
  return unwrap(res);
};

export async function updateSuperAdminProfile(
  id: string,
  payload: { name?: string; email?: string; phone?: string },
) {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

  const res = await api.patch(
    `${API_BASE_URL}/super-admin/${id}`,
    payload,
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    },
  );

  return res.data;
}

type UploadImageFile = {
  uri: string;
  name: string;
  type: string;
};

export const uploadSuperAdminImage = async (id: string, file: UploadImageFile) => {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any); // React Native FormData file

  const res = await api.patch(`${API_BASE_URL}/super-admin/${id}/profile_image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data;
};

export const updateClubAdminProfile = async (
  id: string,
  payload: { name?: string; email?: string; phone?: string },
) => {
  const res = await api.patch(`/club-admin/${id}`, payload);
  return res.data;
};

export const uploadClubAdminImage = async (
  id: string,
  file: { uri: string; name: string; type: string },
) => {
  const formData = new FormData();
  formData.append('file', file as any);

  const res = await api.patch(
    `/club-admin/${id}/image`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return res.data;
};
