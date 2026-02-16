import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import PatientService from '../../services/PatientService';

export const fetchPatients = createAsyncThunk('patients/fetchAll', async (_, { rejectWithValue }) => {
    try {
        return await PatientService.fetchPatients();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch patients');
    }
});

export const createPatient = createAsyncThunk('patients/create', async (patientData, { rejectWithValue }) => {
    try {
        return await PatientService.createPatient(patientData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create patient');
    }
});

export const updatePatient = createAsyncThunk('patients/update', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await PatientService.updatePatient(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update patient');
    }
});

export const deletePatient = createAsyncThunk('patients/delete', async (id, { rejectWithValue }) => {
    try {
        return await PatientService.deletePatient(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete patient');
    }
});

const patientSlice = createSlice({
    name: 'patients',
    initialState: {
        list: [],
        currentPatient: null,
        loading: false,
        error: null,
    },
    reducers: {
        setCurrentPatient: (state, action) => {
            state.currentPatient = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPatients.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPatients.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchPatients.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createPatient.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createPatient.fulfilled, (state, action) => { state.loading = false; state.list.unshift(action.payload); })
            .addCase(createPatient.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(updatePatient.fulfilled, (state, action) => {
                const index = state.list.findIndex(p => p.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
                if (state.currentPatient?.id === action.payload.id) state.currentPatient = action.payload;
            })
            .addCase(deletePatient.fulfilled, (state, action) => {
                state.list = state.list.filter(p => p.id !== action.payload);
                if (state.currentPatient?.id === action.payload) state.currentPatient = null;
            });
    },
});

export const { setCurrentPatient, clearError } = patientSlice.actions;
export default patientSlice.reducer;
