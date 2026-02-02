// OTP generation and validation utilities

export function generateOTP(): string {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function validateOTP(inputOTP: string, actualOTP: string): boolean {
  return inputOTP === actualOTP;
}

export async function sendOTP(email: string, otp: string): Promise<boolean> {
  try {
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to send OTP:', error);
    return false;
  }
}