import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import Snackbar, { SnackbarType } from '../Common/Snackbar';
import { useNotifications, useRegisterGlobalNotification, addGlobalNotification } from './NotificationContext';

interface SnackbarConfig {
    message: string;
    type?: SnackbarType;
    duration?: number;
    delay?: number;
}

interface SnackbarContextType {
    showSnackbar: (config: SnackbarConfig) => void;
    hideSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

// Define a global reference for the snackbar function to allow calls from non-react files (services)
let globalShowSnackbar: (config: SnackbarConfig) => void = () => {
    console.warn("Snackbar: Global showSnackbar called before initialization");
};

export const showGlobalSnackbar = (config: SnackbarConfig) => {
    globalShowSnackbar(config);
};

export const SnackbarProvider = ({ children }: { children: ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<SnackbarConfig>({
        message: '',
        type: 'info',
        duration: 3000,
        delay: 0,
    });

    const { addNotification } = useNotifications();
    useRegisterGlobalNotification(); // Register globalAddNotification

    const showSnackbar = (newConfig: SnackbarConfig) => {
        const type = newConfig.type || 'info';
        setConfig({
            message: newConfig.message,
            type: type,
            duration: newConfig.duration || 3000,
            delay: newConfig.delay ?? 0,
        });
        setVisible(true);

        // Also add to global notification list
        addNotification(newConfig.message, type);
    };

    // Register globally
    globalShowSnackbar = showSnackbar;

    const hideSnackbar = () => {
        setVisible(false);
    };

    return (
        <SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
            {children}
            <Snackbar
                visible={visible}
                message={config.message}
                type={config.type}
                duration={config.duration}
                delay={config.delay}
                onDismiss={hideSnackbar}
            />
        </SnackbarContext.Provider>
    );
};

export const useSnackbar = () => {
    const context = useContext(SnackbarContext);
    if (!context) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
};
