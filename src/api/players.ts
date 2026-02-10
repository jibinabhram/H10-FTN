import api from './axios';

/* ================= CREATE PLAYER ================= */
export const createPlayer = async (payload: {
  player_name: string;
  age: number;
  jersey_number: number;
  position: string;
  phone?: string;
  pod_holder_id?: string;
  pod_id?: string;
  heartrate?: number;
  height?: number;
  weight?: number;
}) => {
  const res = await api.post('/players', payload);
  return res.data?.data ?? res.data;
};

/* ================= GET CLUB PLAYERS ================= */
export const getMyClubPlayers = async () => {
  const res = await api.get('/players');
  return res.data.data ?? [];
};

export const updatePlayer = async (playerId: string, payload: any) => {
  const res = await api.patch(`/players/${playerId}`, payload);
  return res.data?.data ?? res.data;
};

/* ================= GET POD HOLDERS (CLUB) ================= */
export const getMyPodHolders = async () => {
  const res = await api.get('/pod-holders'); // already club-filtered in backend
  return res.data?.data ?? res.data;
};

/* ================= GET PODS BY HOLDER ================= */
export const getPodsByHolder = async (podHolderId: string) => {
  const res = await api.get(`/pod-holders/${podHolderId}`);
  const data = res.data?.data ?? res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.pods)) return data.pods;
  if (Array.isArray(res.data?.pods)) return res.data.pods;
  return [];
};

export const assignPodHolderToPlayer = async (
  playerId: string,
  podHolderId: string,
) => {
  return api.post(`/players/${playerId}/assign-pod-holder`, {
    pod_holder_id: podHolderId,
  });
};

export const assignPodToPlayer = async (
  playerId: string,
  podId: string,
) => {
  const res = await api.post(`/players/${playerId}/assign-pod`, {
    pod_id: podId,
  });
  return res.data?.data ?? res.data;
};

export const unassignPodFromPlayer = async (playerId: string) => {
  const res = await api.post(`/players/${playerId}/unassign-pod`);
  return res.data?.data ?? res.data;
};

/* ================= GET PODS FOR LOGGED-IN CLUB ================= */
export const getMyClubPods = async () => {
  const res = await api.get('/pods/my-club');
  console.log('Pods API response:', res.data);
  // res.data structure: { status, statusCode, timestamp, data: Array }
  const podsArray = res.data?.data ?? [];
  console.log('Extracted pods array:', podsArray);
  return podsArray;
};

export const deletePlayer = async (playerId: string) => {
  const res = await api.delete(`/players/${playerId}`);
  return res.data;
};
