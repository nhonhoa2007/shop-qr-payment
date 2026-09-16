export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
  return trimmed.length >= 9 && phoneRegex.test(trimmed);
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
