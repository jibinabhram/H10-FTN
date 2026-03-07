import api from './axios';
import { API_BASE_URL } from '../utils/constants';

/* =====================================================
   GET ALL PODS
   ===================================================== */

export async function fetchPods(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/pods`);

    if (!res.ok) {
      console.error(' fetchPods HTTP error:', res.status);
      return [];
    }

    const json = await res.json();

    // Case 1: { data: Pod[] }
    if (Array.isArray(json?.data)) {
      return json.data;
    }

    // Case 2: { data: { data: Pod[] } }
    if (Array.isArray(json?.data?.data)) {
      return json.data.data;
    }

    console.warn(' fetchPods: unexpected payload shape', json);
    return [];
  } catch (err) {
    console.error(' fetchPods failed:', err);
    return [];
  }
}

/* =====================================================
   GET AVAILABLE PODS (FOR POD HOLDER REGISTER)
   ===================================================== */

export const getAvailablePods = async (): Promise<any[]> => {
  try {
    const res = await api.get('/pod-holders/available');

    // Backend response: { data: Pod[] }
    if (Array.isArray(res.data?.data)) {
      return res.data.data;
    }

    console.warn(
      '⚠ getAvailablePods: unexpected payload shape',
      res.data,
    );
    return [];
  } catch (err) {
    console.error(' getAvailablePods failed:', err);
    return [];
  }
};

/* =====================================================
   CREATE POD HOLDER
   ===================================================== */

export const createPodHolder = async (payload: {
  model: string;
  podIds: string[];
}) => {
  const res = await api.post('/pod-holders', payload);
  return res.data;
};

/* =====================================================
   CREATE PODS BATCH
   ===================================================== */

export async function createPodsBatch(
  count: number,
  model?: string,
): Promise<{ batch_id: string; created: number }> {
  try {
    const res = await api.post('/pods/batch', {
      count,
      model,
    });

    return res.data?.data;
  } catch (err) {
    // axios.ts already converts offline → { isOffline: true }
    throw err;
  }
}


/* =====================================================
   UPDATE POD STATUS
   ===================================================== */

export async function updatePodStatus(
  podId: string,
  status:
    | 'ACTIVE'
    | 'MAINTENANCE'
    | 'DAMAGED'
    | 'LOST'
    | 'REPAIRED'
    | 'SCRAP',
) {
  const res = await fetch(`${API_BASE_URL}/pods/${podId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error('Failed to update pod status');
  }

  return res.json();
}
