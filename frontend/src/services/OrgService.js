import api from './api';

const OrgService = {
    fetchOrganizations: async () => {
        const response = await api.get('/admin/organizations');
        return response.data;
    },

    createOrganization: async (orgData) => {
        const response = await api.post('/admin/organizations', orgData);
        return response.data;
    },

    updateOrganization: async (org_id, data) => {
        const response = await api.put(`/admin/organizations/${org_id}`, data);
        return response.data;
    },

    deleteOrganization: async (org_id) => {
        await api.delete(`/admin/organizations/${org_id}`);
        return org_id;
    }
};

export default OrgService;
