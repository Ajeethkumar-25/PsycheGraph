import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AllLoginService from '../../services/AllLoginService';
import TokenService from '../../token/TokenService';

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.login(credentials);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Login failed');
    }
});

export const loginHospital = createAsyncThunk('auth/loginHospital', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.loginHospital(credentials);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Hospital login failed');
    }
});

export const loginDoctor = createAsyncThunk('auth/loginDoctor', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.loginDoctor(credentials);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Doctor login failed');
    }
});

export const loginReceptionist = createAsyncThunk('auth/loginReceptionist', async (credentials, { rejectWithValue }) => {
    try {
        return await AllLoginService.loginReceptionist(credentials);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Receptionist login failed');
    }
});

export const register = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.register(userData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Registration failed');
    }
});

export const registerHospital = createAsyncThunk('auth/registerHospital', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.registerHospital(userData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Hospital registration failed');
    }
});

export const registerDoctor = createAsyncThunk('auth/registerDoctor', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.registerDoctor(userData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Doctor registration failed');
    }
});

export const registerReceptionist = createAsyncThunk('auth/registerReceptionist', async (userData, { rejectWithValue }) => {
    try {
        return await AllLoginService.registerReceptionist(userData);
    } catch (error) {
        return rejectWithValue(error.response?.data?.detail || 'Receptionist registration failed');
    }
});

const AllLoginSlice = createSlice({
    name: 'auth',
    initialState: {
        user: TokenService.getUser(),
        token: TokenService.getLocalAccessToken(),
        refreshToken: TokenService.getLocalRefreshToken(),
        loading: false,
        error: null,
        successMessage: null,
    },
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            state.successMessage = null;
            TokenService.removeUser();
        },
        clearSuccessMessage: (state) => {
            state.successMessage = null;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        const handleAuthFullfilled = (state, action) => {
            state.loading = false;
            state.token = action.payload.access_token;
            state.refreshToken = action.payload.refresh_token;
            state.successMessage = "Login successful!";

            // Backend returns user details along with tokens in UserWithToken
            const { access_token, refresh_token, token_type, ...userDetails } = action.payload;
            state.user = userDetails;

            TokenService.setUser(userDetails);
            TokenService.updateLocalAccessToken(action.payload.access_token);
            if (action.payload.refresh_token) {
                TokenService.updateLocalRefreshToken(action.payload.refresh_token);
            }
        };

        const handleRegisterFullfilled = (state, action) => {
            state.loading = false;
            state.successMessage = action.payload.message || "Registration successful! Please login.";
            state.error = null;
            // We do NOT set user or token here as registration doesn't login automatically
        };

        builder
            // Login Cases
            .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(login.fulfilled, handleAuthFullfilled)
            .addCase(login.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(loginHospital.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(loginHospital.fulfilled, handleAuthFullfilled)
            .addCase(loginHospital.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            // Register Cases
            .addCase(registerHospital.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(registerHospital.fulfilled, handleRegisterFullfilled)
            .addCase(registerHospital.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            .addCase(register.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(register.fulfilled, handleRegisterFullfilled)
            .addCase(register.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

            // Matchers for shared patterns
            .addMatcher(
                (action) => [
                    loginDoctor.pending.type,
                    loginReceptionist.pending.type,
                    registerDoctor.pending.type,
                    registerReceptionist.pending.type
                ].includes(action.type),
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )
            .addMatcher(
                (action) => [
                    loginDoctor.fulfilled.type,
                    loginReceptionist.fulfilled.type
                ].includes(action.type),
                handleAuthFullfilled
            )
            .addMatcher(
                (action) => [
                    registerDoctor.fulfilled.type,
                    registerReceptionist.fulfilled.type
                ].includes(action.type),
                handleRegisterFullfilled
            )
            .addMatcher(
                (action) => [
                    loginDoctor.rejected.type,
                    loginReceptionist.rejected.type,
                    registerDoctor.rejected.type,
                    registerReceptionist.rejected.type
                ].includes(action.type),
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            );
    },
});

export const { logout, clearSuccessMessage, clearError } = AllLoginSlice.actions;
export default AllLoginSlice.reducer;
