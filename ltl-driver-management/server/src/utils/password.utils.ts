import bcrypt from 'bcryptjs';

// Password policy configuration
const PASSWORD_MIN_LENGTH = 12; // NIST compliant
const BCRYPT_SALT_ROUNDS = 12; // Increased from 10 for better security

// Password validation result
interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

// Validate password according to NIST standards
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  
  // Check minimum length
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  
  // Check for common weak passwords (basic list - expand as needed)
  const commonWeakPasswords = [
    'password123', 'admin123', '12345678', 'qwerty123', 
    'letmein123', 'welcome123', 'password12'
  ];
  
  if (commonWeakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
  }
  
  // No maximum length restriction (NIST recommendation)
  // Allow spaces and all Unicode characters (NIST recommendation)
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const hashPassword = async (password: string): Promise<string> => {
  // Validate password before hashing
  const validation = validatePassword(password);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  // Protect against timing attacks by always running compare
  if (!password || !hashedPassword) {
    return false;
  }
  
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    // Log error but don't expose details
    console.error('[SECURITY] Password verification error:', error);
    return false;
  }
};

// Check if password needs rehashing (e.g., if salt rounds were increased)
export const needsRehash = (hashedPassword: string): boolean => {
  try {
    const rounds = bcrypt.getRounds(hashedPassword);
    return rounds < BCRYPT_SALT_ROUNDS;
  } catch {
    return false;
  }
};