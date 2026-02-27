import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { fetchProfile } from '../../api/auth';
import api from '../../api/axios';
import { useNavigation } from '@react-navigation/native';

const ClubStatusGuard = () => {
    const { isAuthenticated, role, logout, clubId: contextClubId } = useAuth();
    const { showAlert } = useAlert();
    const navigation = useNavigation<any>();

    useEffect(() => {
        if (!isAuthenticated || role === 'SUPER_ADMIN') {
            console.log('[ClubStatusGuard] Skipping check:', { isAuthenticated, role });
            return;
        }

        const forceLogout = async () => {
            await logout();
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        };

        const checkStatus = async () => {
            try {
                console.log('[ClubStatusGuard] Checking status...');
                const profile = await fetchProfile();

                // Inspecting profile structure
                let rawStatus =
                    profile.club_status ??
                    profile.club?.status ??
                    profile.status ??
                    (profile.user?.club?.status);

                let clubStatus = String(rawStatus || '').toUpperCase();
                console.log('[ClubStatusGuard] profile.role:', profile.role);
                console.log('[ClubStatusGuard] Detected Status (initial):', clubStatus);

                // Fallback: If status is missing from profile, try direct club check
                if (!clubStatus) {
                    const cid = contextClubId || profile.club_id || profile.user?.club_id;
                    if (cid) {
                        try {
                            const clubRes = await api.get(`/clubs/${cid}`);
                            const fetchedStatus = clubRes.data?.data?.status || clubRes.data?.status;
                            if (fetchedStatus) {
                                clubStatus = String(fetchedStatus).toUpperCase();
                                console.log('[ClubStatusGuard] Fallback status:', clubStatus);
                            }
                        } catch (e: any) {
                            console.log('[ClubStatusGuard] Fallback check failed:', e.message);
                        }
                    }
                }

                console.log('[ClubStatusGuard] Detected Status (final):', clubStatus);

                if (clubStatus === 'INACTIVE') {
                    console.log('[ClubStatusGuard] ALERT: Club is INACTIVE. Forcing logout.');
                    showAlert({
                        title: 'Account Inactive',
                        message: 'Your club is inactive. Please contact the admin.',
                        type: 'error',
                        buttons: [{ text: 'OK', onPress: forceLogout }]
                    });
                } else {
                    console.log('[ClubStatusGuard] Club is active:', clubStatus);
                }
            } catch (err: any) {
                console.log('[ClubStatusGuard] Check failed:', err?.message);

                // If we get a 403 Forbidden or 401 Unauthorized, it likely means the club is inactive or token is invalid
                if (err?.response?.status === 403 || err?.response?.status === 401) {
                    console.log('[ClubStatusGuard] Auth error (401/403). Forcing logout...');
                    showAlert({
                        title: 'Session Expired',
                        message: 'Your session has expired or your account is inactive. Please log in again.',
                        type: 'error',
                        buttons: [{ text: 'OK', onPress: forceLogout }]
                    });
                }
            }
        };

        // Check on mount and then every 30 seconds
        const interval = setInterval(checkStatus, 30000);
        checkStatus();

        return () => clearInterval(interval);
    }, [isAuthenticated, role, contextClubId]);

    return null;
};

export default ClubStatusGuard;
