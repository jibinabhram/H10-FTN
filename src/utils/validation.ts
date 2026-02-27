export interface Requirement {
    label: string;
    isMet: boolean;
}

export interface ValidationResult {
    isValid: boolean;
    requirements: Requirement[];
}

/**
 * Validates a password based on specific requirements and returns detailed status for each.
 */
export const validatePassword = (password: string): ValidationResult => {
    const requirements: Requirement[] = [
        {
            label: "At least 8 characters",
            isMet: password.length >= 8,
        },
        {
            label: "At least one uppercase letter (A-Z)",
            isMet: /[A-Z]/.test(password),
        },
        {
            label: "At least one special character (@ # $ % & * !)",
            isMet: /[@#$%&*!]/.test(password),
        },
    ];

    const isValid = requirements.every((req) => req.isMet);

    return {
        isValid,
        requirements,
    };
};
