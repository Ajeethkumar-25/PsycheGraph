import api from './api';

const SessionService = {
    fetchSessions: async (patientId = null) => {
        const url = patientId ? `/sessions?patient_id=${patientId}` : '/sessions';
        const response = await api.get(url);
        return response.data;
    },

    fetchLanguages: async () => {
        const response = await api.get('/sessions/languages');
        return response.data;
    },

    createSession: async (formData) => {
        const response = await api.post('/sessions/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    createSoapNote: async ({ patient_id, doctor_id, appointment_id, soap_notes }) => {
        const response = await api.post('/sessions/', {
            patient_id,
            doctor_id,
            appointment_id,
            soap_notes
        });
        return response.data;
    },

    fetchSessionById: async (session_id) => {
        const response = await api.get(`/sessions/${session_id}`);
        return response.data;
    },

    updateSession: async (session_id, data) => {
        const response = await api.put(`/sessions/${session_id}`, data);
        return response.data;
    },

    deleteSession: async (session_id) => {
        await api.delete(`/sessions/${session_id}/`);
        return session_id;
    },

    fetchTranscript: async (appointment_id) => {
        const response = await api.post(`/sessions/${appointment_id}/fetch-transcript/`);
        return response.data;
    }
};

export default SessionService;
