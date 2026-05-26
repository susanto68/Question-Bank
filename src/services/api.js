import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 300000,
});

export async function generateQuestions(payload) {
  const { data } = await api.post('/api/questions/generate', payload);
  return data;
}

export async function getHealth() {
  const { data } = await api.get('/api/health');
  return data;
}

export async function submitComment(payload) {
  const { data } = await api.post('/api/comments', payload);
  return data;
}

export async function getAdminComments(accessToken) {
  const { data } = await api.get('/api/comments/admin', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
}
