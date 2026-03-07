import api from './api';

const OrgService = {
    fetchOrganizations: async () => {
        const response = await api.get('/admin/organizations');
        return response.data;
    },

    createOrganization: async (orgData) => {
        const response = await api.post('/admin/organizations/register', orgData);
        return response.data;
    },

    updateOrganization: async (org_id, data) => {
        const response = await api.put(`/admin/organizations/${org_id}`, data);
        return response.data;
    },

    deleteOrganization: async (org_id) => {
        await api.delete(`/admin/organizations/${org_id}`);
        return org_id;
    },

    getWorkingHours: async (org_id) => {
        const response = await api.get(`/organizations/${org_id}/working-hours`);
        return response.data;
    },

    setWorkingHours: async (org_id, data) => {
        const response = await api.put(`/organizations/${org_id}/working-hours`, data);
        return response.data;
    },

    getHospitalProfile: async () => {
        const response = await api.get('/admin/hospital/profile');
        return response.data;
    },

    updateHospitalProfile: async (data) => {
        const response = await api.put('/admin/hospital/profile', data);
        return response.data;
    }
};

export default OrgService;
