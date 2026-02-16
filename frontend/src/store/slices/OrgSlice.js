import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import OrgService from '../../services/OrgService';

export const fetchOrganizations = createAsyncThunk('organizations/fetchAll', async (isPublic = false, { rejectWithValue }) => {
    try {
        return await OrgService.fetchOrganizations(isPublic);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch organizations');
    }
});

export const createOrganization = createAsyncThunk('organizations/create', async (orgData, { rejectWithValue }) => {
    try {
        return await OrgService.createOrganization(orgData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create organization');
    }
});

export const updateOrganization = createAsyncThunk('organizations/update', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await OrgService.updateOrganization(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update organization');
    }
});

export const deleteOrganization = createAsyncThunk('organizations/delete', async (id, { rejectWithValue }) => {
    try {
        return await OrgService.deleteOrganization(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete organization');
    }
});

const orgSlice = createSlice({
    name: 'organizations',
    initialState: {
        list: [],
        currentOrg: null,
        loading: false,
        error: null,
    },
    reducers: {
        setCurrentOrg: (state, action) => {
            state.currentOrg = action.payload;
        },
        clearOrgError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOrganizations.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchOrganizations.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchOrganizations.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createOrganization.fulfilled, (state, action) => { state.list.unshift(action.payload); })
            .addCase(updateOrganization.fulfilled, (state, action) => {
                const index = state.list.findIndex(o => o.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
            })
            .addCase(deleteOrganization.fulfilled, (state, action) => {
                state.list = state.list.filter(o => o.id !== action.payload);
            });
    }
});

export const { setCurrentOrg, clearOrgError } = orgSlice.actions;
export default orgSlice.reducer;
