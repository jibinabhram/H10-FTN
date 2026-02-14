import React, { createContext, useContext, useState, ReactNode } from 'react';
import Snackbar, { SnackbarType } from '../Common/Snackbar';

interface SnackbarConfig {
    message: string;
    type?: SnackbarType;
    duration?: number;
}

interface SnackbarContextType {
    showSnackbar: (config: SnackbarConfig) => void;
    hideSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider = ({ children }: { children: ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<SnackbarConfig>({
        message: '',
        type: 'info',
        duration: 3000,
    });

    const showSnackbar = (newConfig: SnackbarConfig) => {
        setConfig({
            message: newConfig.message,
            type: newConfig.type || 'info',
            duration: newConfig.duration || 3000,
        });
        setVisible(true);
    };

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
