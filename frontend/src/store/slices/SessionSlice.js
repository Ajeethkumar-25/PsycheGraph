import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import SessionService from '../../services/SessionService';

export const createSession = createAsyncThunk('sessions/create', async (formData, { rejectWithValue }) => {
    try {
        return await SessionService.createSession(formData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to create session');
    }
});

export const createSoapNote = createAsyncThunk('sessions/createSoapNote', async (payload, { rejectWithValue }) => {
    try {
        return await SessionService.createSoapNote(payload);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || error.response?.data?.message || 'Failed to save SOAP note');
    }
});

export const fetchLanguages = createAsyncThunk('sessions/fetchLanguages', async (_, { rejectWithValue }) => {
    try {
        return await SessionService.fetchLanguages();
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch languages');
    }
});

export const fetchSessions = createAsyncThunk('sessions/fetchAll', async (patientId = null, { rejectWithValue }) => {
    try {
        return await SessionService.fetchSessions(patientId);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch sessions');
    }
});

export const fetchSessionById = createAsyncThunk('sessions/fetchById', async (id, { rejectWithValue }) => {
    try {
        return await SessionService.fetchSessionById(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch session details');
    }
});

export const updateSession = createAsyncThunk('sessions/update', async ({ id, data }, { rejectWithValue }) => {
    try {
        return await SessionService.updateSession(id, data);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to update session');
    }
});

export const deleteSession = createAsyncThunk('sessions/delete', async (id, { rejectWithValue }) => {
    try {
        return await SessionService.deleteSession(id);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to delete session');
    }
});

export const fetchTranscript = createAsyncThunk('sessions/fetchTranscript', async (appointmentId, { rejectWithValue }) => {
    try {
        return await SessionService.fetchTranscript(appointmentId);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Failed to fetch transcript');
    }
});

const sessionSlice = createSlice({
    name: 'sessions',
    initialState: {
        list: [],
        languages: [],
        currentSession: null,
        loading: false,
        error: null,
    },
    reducers: {
        setCurrentSession: (state, action) => {
            state.currentSession = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSessions.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchSessions.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
            .addCase(fetchSessions.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(createSession.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createSession.fulfilled, (state, action) => { state.loading = false; state.list.unshift(action.payload); })
            .addCase(createSession.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(fetchLanguages.fulfilled, (state, action) => {
                state.languages = action.payload;
            })

            .addCase(fetchSessionById.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchSessionById.fulfilled, (state, action) => {
                state.loading = false;
                state.currentSession = action.payload;
            })
            .addCase(fetchSessionById.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(updateSession.fulfilled, (state, action) => {
                const index = state.list.findIndex(s => s.id === action.payload.id);
                if (index !== -1) state.list[index] = action.payload;
                if (state.currentSession?.id === action.payload.id) state.currentSession = action.payload;
            })
            .addCase(deleteSession.fulfilled, (state, action) => {
                state.list = state.list.filter(s => s.id !== action.payload);
                if (state.currentSession?.id === action.payload) state.currentSession = null;
            })
            .addCase(fetchTranscript.fulfilled, (state, action) => {
                // If the transcript is for the current session, update it
                if (state.currentSession) {
                    state.currentSession.transcript = action.payload;
                }
            });
    },
});

export const { setCurrentSession, clearError } = sessionSlice.actions;
export default sessionSlice.reducer;
