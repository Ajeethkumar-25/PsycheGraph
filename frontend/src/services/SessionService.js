import api from './api';

const SessionService = {
    fetchSessions: async (patientId = null) => {
        const url = patientId ? `/sessions?patient_id=${patientId}` : '/sessions';
        const response = await api.get(url);
        return response.data;
    },

    createSession: async (formData) => {
        const response = await api.post('/sessions', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    updateSession: async (session_id, data) => {
        const response = await api.put(`/sessions/${session_id}`, data);
        return response.data;
    },

    deleteSession: async (session_id) => {
        await api.delete(`/sessions/${session_id}`);
        return session_id;
    }
};

export default SessionService;
