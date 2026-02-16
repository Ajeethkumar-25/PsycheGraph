import api from './api';

const PatientService = {
    fetchPatients: async () => {
        const response = await api.get('/patients');
        return response.data;
    },

    createPatient: async (patientData) => {
        const response = await api.post('/patients/', patientData);
        return response.data;
    },

    updatePatient: async (patient_id, data) => {
        const response = await api.put(`/patients/${patient_id}`, data);
        return response.data;
    },

    deletePatient: async (patient_id) => {
        await api.delete(`/patients/${patient_id}`);
        return patient_id;
    }
};

export default PatientService;
