export interface CommentPayload {
  name: string;
  phone: string;
  board: string;
  comment: string;
  pagePath: string;
}

export async function submitComment(payload: CommentPayload) {
  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to submit comment');
  return data;
}

export async function sendAdminOtp(phone: string) {
  const response = await fetch('/api/comments/admin/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
  return data;
}

export async function verifyAdminOtp(phone: string, otp: string) {
  const response = await fetch('/api/comments/admin/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to verify OTP');
  return data;
}

export async function getAdminComments(token: string) {
  const response = await fetch('/api/comments', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch comments');
  return data;
}
