import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Requirement } from '../../utils/validation';

interface Props {
    requirements: Requirement[];
}

const PasswordRequirementList = ({ requirements }: Props) => {
    return (
        <View style={styles.container}>
            {requirements.map((req, index) => (
                <View key={index} style={styles.row}>
                    <Ionicons
                        name={req.isMet ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={req.isMet ? "#10B981" : "#9CA3AF"}
                        style={styles.icon}
                    />
                    <Text
                        style={[
                            styles.text,
                            { color: req.isMet ? "#10B981" : "#6B7280" }
                        ]}
                    >
                        {req.label}
                    </Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    icon: {
        marginRight: 8,
    },
    text: {
        fontSize: 12,
        fontWeight: '500',
    },
});

export default PasswordRequirementList;
