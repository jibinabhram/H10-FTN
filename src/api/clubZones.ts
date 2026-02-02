import api from './axios';

export const getClubZoneDefaults = async () => {
  try {
    const response = await api.get('/club-zones/defaults');
    return response.data || [];
  } catch (error: any) {
    console.error('Failed to get club zone defaults:', error);
    throw error;
  }
};

export const setClubZoneDefaults = async (zones: any[]) => {
  try {
    const response = await api.post('/club-zones/defaults', { zones });
    return response.data || [];
  } catch (error: any) {
    console.error('Failed to set club zone defaults:', error);
    throw error;
  }
};
