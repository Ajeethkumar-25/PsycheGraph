import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const initialState = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    isAuthenticated: !!localStorage.getItem('access_token'),
    loading: false,
};

function authReducer(state, action) {
    switch (action.type) {
        case 'AUTH_START':
            return { ...state, loading: true };
        case 'AUTH_SUCCESS':
            return { ...state, loading: false, user: action.payload, isAuthenticated: true };
        case 'AUTH_ERROR':
            return { ...state, loading: false, user: null, isAuthenticated: false };
        case 'LOGOUT':
            return { ...state, user: null, isAuthenticated: false };
        default:
            return state;
    }
}

export const AuthProvider = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);

    const login = async (email, password) => {
        dispatch({ type: 'AUTH_START' });
        try {
            const response = await api.post('/token', { email, password });
            const { access_token, refresh_token, ...userData } = response.data;

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            localStorage.setItem('user', JSON.stringify(userData));

            dispatch({ type: 'AUTH_SUCCESS', payload: userData });
            toast.success(`Welcome back, ${userData.full_name}!`);
            return userData;
        } catch (error) {
            dispatch({ type: 'AUTH_ERROR' });
            const message = error.response?.data?.detail || 'Login failed';
            toast.error(message);
            throw error;
        }
    };

    const logout = () => {
        localStorage.clear();
        dispatch({ type: 'LOGOUT' });
        toast.success('Logged out successfully');
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
