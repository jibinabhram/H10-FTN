import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { SnackbarType } from '../Common/Snackbar';

export interface AppNotification {
    id: string;
    message: string;
    type: SnackbarType;
    timestamp: number;
    read: boolean;
    accountId: string; // Composite key like role:clubId or just role
}

interface NotificationContextType {
    notifications: AppNotification[];
    addNotification: (message: string, type: SnackbarType) => void;
    clearNotifications: () => void;
    markAsRead: (id: string) => void;
    unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const NOTIF_STORAGE_KEY = 'APP_NOTIFICATIONS';

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { role, clubId, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // Determine current account identifier
    const currentAccountId = isAuthenticated ? (clubId ? `${role}:${clubId}` : role || 'ANONYMOUS') : 'GUEST';

    // Load notifications for current account
    useEffect(() => {
        const loadNotifs = async () => {
            try {
                const stored = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
                if (stored) {
                    const allNotifs: AppNotification[] = JSON.parse(stored);
                    // We keep all but only set state for current user? 
                    // No, it's better to filter when rendering or managing.
                    setNotifications(allNotifs);
                }
            } catch (e) {
                console.error('Failed to load notifications', e);
            }
        };
        loadNotifs();
    }, []);

    // Save notifications to storage whenever they change
    useEffect(() => {
        AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifications));
    }, [notifications]);

    // Memory clean up on logout logic - actually the state is filtered by accountId below

    const addNotification = (message: string, type: SnackbarType = 'info') => {
        const newNotif: AppNotification = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            message,
            type,
            timestamp: Date.now(),
            read: false,
            accountId: currentAccountId,
        };
        setNotifications(prev => [newNotif, ...prev]);
    };

    const clearNotifications = () => {
        // Clear only notifications for the current account
        setNotifications(prev => prev.filter(n => n.accountId !== currentAccountId));
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    // Only show notifications for the current account
    const filteredNotifications = notifications.filter(n => n.accountId === currentAccountId);

    const unreadCount = filteredNotifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            notifications: filteredNotifications,
            addNotification,
            clearNotifications,
            markAsRead,
            unreadCount
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

// Global reference for services
let globalAddNotification: (message: string, type: SnackbarType) => void = () => { };

export const addGlobalNotification = (message: string, type: SnackbarType) => {
    globalAddNotification(message, type);
};

// Internal hook-like setter for the provider to register the global function
export const useRegisterGlobalNotification = () => {
    const { addNotification } = useNotifications();
    useEffect(() => {
        globalAddNotification = addNotification;
    }, [addNotification]);
};
