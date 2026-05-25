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
