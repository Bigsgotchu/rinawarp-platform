export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): {
  isValid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number',
    };
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character (!@#$%^&*)',
    };
  }

  return { isValid: true };
}

export function validateUsername(username: string): {
  isValid: boolean;
  message?: string;
} {
  if (username.length < 3) {
    return {
      isValid: false,
      message: 'Username must be at least 3 characters long',
    };
  }

  if (username.length > 30) {
    return {
      isValid: false,
      message: 'Username cannot be longer than 30 characters',
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      isValid: false,
      message: 'Username can only contain letters, numbers, underscores, and hyphens',
    };
  }

  return { isValid: true };
}

export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  // Remove any HTML tags
  input = input.replace(/<[^>]*>?/gm, '');
  
  // Convert special characters to HTML entities
  input = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return input;
}

export function validatePhoneNumber(phone: string): boolean {
  // Basic international phone number validation
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
}

export function validateJSON(json: string): boolean {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

export function validateDate(date: string): boolean {
  const timestamp = Date.parse(date);
  return !isNaN(timestamp);
}

export function validateIPAddress(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    return ip.split('.').every(num => parseInt(num) <= 255);
  }

  // IPv6 validation
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

export function validateCreditCard(number: string): boolean {
  // Remove spaces and dashes
  number = number.replace(/[\s-]/g, '');
  
  // Check if contains only digits
  if (!/^\d+$/.test(number)) return false;
  
  // Luhn algorithm (mod 10)
  let sum = 0;
  let isEven = false;
  
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

export function validateStrongPassword(password: string): {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  message?: string;
} {
  let score = 0;
  const minLength = 8;
  
  if (password.length < minLength) {
    return {
      isValid: false,
      strength: 'weak',
      message: `Password must be at least ${minLength} characters long`,
    };
  }
  
  // Award points for length
  score += Math.min(2, Math.floor(password.length / 8));
  
  // Award points for complexity
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score += 2;
  
  // Award points for mixing characters
  if (/[A-Z].*[0-9]|[0-9].*[A-Z]/.test(password)) score++;
  if (/[!@#$%^&*].*[0-9]|[0-9].*[!@#$%^&*]/.test(password)) score++;
  
  let strength: 'weak' | 'medium' | 'strong';
  let isValid = true;
  let message;
  
  if (score < 4) {
    strength = 'weak';
    isValid = false;
    message = 'Password is too weak. Add numbers, special characters, and mixed case letters.';
  } else if (score < 6) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }
  
  return { isValid, strength, message };
}
