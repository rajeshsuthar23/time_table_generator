import axios from 'axios';

const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
});

export const fetchMasterData = async () => {
  const res = await api.get('/master-data');
  return res.data;
};

export const generateTimetable = async (weekStartDate: string, adHocHolidays: any[]) => {
  const res = await api.post('/timetable/generate', { weekStartDate, adHocHolidays });
  return res.data;
};

export const fetchWeek = async (id: number) => {
  const res = await api.get(`/timetable/week/${id}`);
  return res.data;
};

export const fetchWeeks = async () => {
  const res = await api.get('/timetable/weeks');
  return res.data;
};

export const updateEntry = async (id: number, payload: any) => {
  const res = await api.put(`/timetable/entry/${id}`, payload);
  return res.data;
};

export const deleteWeek = async (id: number) => {
  const res = await api.delete(`/timetable/week/${id}`);
  return res.data;
};

export const fetchFortnightCoverage = async (weekId: number) => {
  const res = await api.get(`/timetable/fortnight-coverage/${weekId}`);
  return res.data;
};

export const fetchFortnights = async () => {
  const res = await api.get('/timetable/fortnights');
  return res.data;
};

export const fetchFortnightCoverageById = async (id: number) => {
  const res = await api.get(`/timetable/fortnight-coverage-by-id/${id}`);
  return res.data;
};
