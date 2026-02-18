import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type SnackbarType = 'success' | 'error' | 'warning' | 'info';

interface SnackbarProps {
    visible: boolean;
    message: string;
    type?: SnackbarType;
    duration?: number;
    delay?: number;
    onDismiss: () => void;
}

const Snackbar: React.FC<SnackbarProps> = ({
    visible,
    message,
    type = 'info',
    duration = 3000,
    delay = 0,
    onDismiss,
}) => {
    const translateX = useRef(new Animated.Value(400)).current;
    const [isShowing, setIsShowing] = React.useState(false);

    useEffect(() => {
        if (visible) {
            const delayTimer = setTimeout(() => {
                setIsShowing(true);
                // Slide in from right
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8,
                }).start();

                // Auto dismiss after duration
                const dismissTimer = setTimeout(() => {
                    hideSnackbar();
                }, duration);

                return () => clearTimeout(dismissTimer);
            }, delay);

            return () => clearTimeout(delayTimer);
        } else {
            // Slide out to right
            Animated.timing(translateX, {
                toValue: 400,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setIsShowing(false);
            });
        }
    }, [visible, delay, duration]);

    const hideSnackbar = () => {
        Animated.timing(translateX, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setIsShowing(false);
            onDismiss();
        });
    };

    const getBackgroundColor = () => {
        switch (type) {
            case 'success':
                return '#10B981';
            case 'error':
                return '#EF4444';
            case 'warning':
                return '#F59E0B';
            case 'info':
                return '#3B82F6';
            default:
                return '#3B82F6';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'close-circle';
            case 'warning':
                return 'warning';
            case 'info':
                return 'information-circle';
            default:
                return 'information-circle';
        }
    };

    if (!isShowing) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: getBackgroundColor(),
                    transform: [{ translateX }],
                },
            ]}
        >
            <Ionicons name={getIcon()} size={20} color="#fff" style={styles.icon} />
            <Text style={styles.message} numberOfLines={2}>
                {message}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 62,
        right: 20,
        minWidth: 300,
        maxWidth: 400,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 9999,
    },
    icon: {
        marginRight: 10,
    },
    message: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 18,
    },
});

export default Snackbar;
