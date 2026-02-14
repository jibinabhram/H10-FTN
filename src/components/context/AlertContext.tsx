import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomAlert from '../Common/CustomAlert';
import { useSnackbar } from './SnackbarContext';

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

// Wrapper hook that automatically routes to snackbar or alert
export const useAlert = () => {
    const context = useContext(AlertContext);
    const snackbarContext = useSnackbar();

    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }

    const showAlert = (config: AlertConfig) => {
        // If no buttons or only one button (simple notification), use snackbar
        const isSimpleNotification = !config.buttons || config.buttons.length <= 1;

        if (isSimpleNotification) {
            // Use snackbar for simple notifications
            snackbarContext.showSnackbar({
                message: normalizeText(config.message),
                type: config.type || 'info',
                duration: 3000,
            });

            // Execute the button callback if provided
            if (config.buttons && config.buttons[0]?.onPress) {
                config.buttons[0].onPress();
            }
        } else {
            // Use modal alert for confirmations (multiple buttons)
            context.showAlert(config);
        }
    };

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

    return { showAlert, hideAlert: context.hideAlert };
};
