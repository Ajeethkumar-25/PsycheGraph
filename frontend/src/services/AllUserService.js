import api from './api';

const AllUserService = {
    fetchDoctors: async () => {
        try {
            const response = await api.get('/admin/doctors');
            return response.data;
        } catch (error) {
            console.error('Error fetching doctors:', error.response?.data || error);
            return [];
        }
    },

    fetchReceptionists: async () => {
        try {
            const response = await api.get('/admin/receptionists');
            return response.data;
        } catch (error) {
            console.error('Error fetching receptionists:', error);
            return [];
        }
    },

    fetchHospitals: async () => {
        try {
            const response = await api.get('/admin/hospitals');
            return response.data;
        } catch (error) {
            if (error.response?.status === 403) return [];
            throw error;
        }
    },

    fetchUsers: async () => {
        try {
            const [doctors, receptionists] = await Promise.all([
                api.get('/admin/doctors').catch(error => {
                    console.error('Failed to fetch doctors in combined list:', error);
                    return { data: [] };
                }),
                api.get('/admin/receptionists').catch(error => {
                    console.error('Failed to fetch receptionists in combined list:', error);
                    return { data: [] };
                })
            ]);
            return [...(doctors?.data || []), ...(receptionists?.data || [])];
        } catch (error) {
            console.error('Error in combined user fetching:', error);
            return [];
        }
    },

    fetchUserById: async (id, role) => {
        let endpoint = `/users/${id}`;
        if (role === 'DOCTOR') endpoint = `/admin/doctors/${id}`;
        else if (role === 'RECEPTIONIST') endpoint = `/admin/receptionists/${id}`;
        else if (role === 'HOSPITAL') endpoint = `/admin/hospitals/${id}`;

        const response = await api.get(endpoint);
        return response.data;
    },

    createUser: async (role, userData) => {
        let endpoint = '/auth/register/user'; // Default placeholder
        if (role === 'DOCTOR') endpoint = '/admin/doctors';
        else if (role === 'RECEPTIONIST') endpoint = '/admin/receptionists';
        else if (role === 'HOSPITAL') endpoint = '/auth/register/hospital';

        // Strip fields not allowed by backend schemas
        const { role: r, organization_id, ...cleanData } = userData;

        const response = await api.post(endpoint, cleanData);
        return response.data;
    },

    updateUser: async (user_id, data, role) => {
        let endpoint = `/users/${user_id}`;
        if (role === 'DOCTOR') endpoint = `/admin/doctors/${user_id}`;
        else if (role === 'RECEPTIONIST') endpoint = `/admin/receptionists/${user_id}`;
        else if (role === 'HOSPITAL') endpoint = `/admin/hospitals/${user_id}`;

        // Strip fields not allowed by backend schemas
        const { role: r, organization_id, ...cleanData } = data;

        const response = await api.put(endpoint, cleanData);
        return response.data;
    },

    deleteUser: async (user_id, role) => {
        let endpoint = `/users/${user_id}`;
        if (role === 'DOCTOR') endpoint = `/admin/doctors/${user_id}`;
        else if (role === 'RECEPTIONIST') endpoint = `/admin/receptionists/${user_id}`;
        else if (role === 'HOSPITAL') endpoint = `/admin/hospitals/${user_id}`;

        await api.delete(endpoint);
        return user_id;
    }
};

export default AllUserService;
