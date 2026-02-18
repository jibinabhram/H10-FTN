import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { SnackbarType } from '../Common/Snackbar';

export interface AppNotification {
    id: string;
    message: string;
    type: SnackbarType;
    timestamp: number;
    read: boolean;
}

interface NotificationContextType {
    notifications: AppNotification[];
    addNotification: (message: string, type: SnackbarType) => void;
    clearNotifications: () => void;
    markAsRead: (id: string) => void;
    unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    const addNotification = (message: string, type: SnackbarType = 'info') => {
        const newNotif: AppNotification = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            message,
            type,
            timestamp: Date.now(),
            read: false,
        };
        setNotifications(prev => [newNotif, ...prev]);
    };

    const clearNotifications = () => {
        setNotifications([]);
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, clearNotifications, markAsRead, unreadCount }}>
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
