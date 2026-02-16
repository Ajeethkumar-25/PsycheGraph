import api from './api';

const AllLoginService = {
    login: async (credentials) => {
        const response = await api.post('/auth/token', credentials);
        return response.data;
    },

    loginHospital: async (credentials) => {
        const response = await api.post('/auth/token', credentials);
        return response.data;
    },

    loginDoctor: async (credentials) => {
        const response = await api.post('/auth/token', credentials);
        return response.data;
    },

    loginReceptionist: async (credentials) => {
        const response = await api.post('/auth/token', credentials);
        return response.data;
    },

    register: async (userData) => {
        // This is a generic registration, usually maps to /users if it exists
        const response = await api.post('/users', userData);
        return response.data;
    },

    registerHospital: async (userData) => {
        const response = await api.post('/auth/register/hospital', userData);
        return response.data;
    },

    registerDoctor: async (userData) => {
        const response = await api.post('/auth/register/doctor', userData);
        return response.data;
    },

    registerReceptionist: async (userData) => {
        const response = await api.post('/auth/register/receptionist', userData);
        return response.data;
    }
};

export default AllLoginService;
