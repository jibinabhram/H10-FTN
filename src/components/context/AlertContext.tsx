import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomAlert from '../Common/CustomAlert';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
    title: string;
    message: string;
    buttons?: AlertButton[];
    type?: AlertType;
}

interface AlertContextType {
    showAlert: (config: AlertConfig) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig>({
        title: '',
        message: '',
        type: 'info',
    });

    const normalizeText = (value: unknown) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            const anyVal = value as any;
            if (typeof anyVal.message === 'string') return anyVal.message;
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }
        return String(value);
    };

    const showAlert = (newConfig: AlertConfig) => {
        setConfig({
            ...newConfig,
            title: normalizeText(newConfig.title),
            message: normalizeText(newConfig.message),
        });
        setVisible(true);
    };

    const hideAlert = () => {
        setVisible(false);
    };

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <CustomAlert
                visible={visible}
                title={config.title}
                message={config.message}
                type={config.type || 'info'}
                buttons={config.buttons || [{ text: 'OK', onPress: hideAlert }]}
                onClose={hideAlert}
            />
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};
