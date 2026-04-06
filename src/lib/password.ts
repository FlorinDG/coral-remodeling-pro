import bcrypt from 'bcryptjs';

/**
 * Password Requirements:
 * - Minimum 6 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * - No repeating characters (3+ in a row)
 */

export interface PasswordValidation {
    valid: boolean;
    errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];

    if (password.length < 6) {
        errors.push('Minimum 6 characters required');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('At least one uppercase letter required');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('At least one lowercase letter required');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('At least one number required');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
        errors.push('At least one special character required');
    }
    if (/(.)\1{2,}/.test(password)) {
        errors.push('No repeating characters (3+ in a row)');
    }

    return { valid: errors.length === 0, errors };
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
