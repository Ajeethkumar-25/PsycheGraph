import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Sessions from './pages/Sessions';
import Management from './pages/Management';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/appointments" element={<Appointments />} />
                            <Route path="/patients" element={<Patients />} />
                            <Route path="/sessions" element={<Sessions />} />
                            <Route path="/management" element={<Management />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

export default App;
