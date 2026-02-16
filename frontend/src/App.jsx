import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Sessions from './pages/Sessions';
import SessionDetails from './pages/SessionDetails';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import Organizations from './pages/superadmin/Organizations';
import SuperAdminUsers from './pages/superadmin/Users';
import HospitalDetails from './pages/superadmin/HospitalDetails';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import ReceptionistDashboard from './pages/receptionist/Dashboard';
import ReceptionistPatients from './pages/receptionist/Patients';
import ReceptionistAppointments from './pages/receptionist/Appointments';
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorPatients from './pages/doctor/Patients';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorSessionMode from './pages/doctor/SessionMode';
import Layout from './layouts/Layout';

function App() {
    const { token, user } = useSelector((state) => state.auth);

    return (
        <Router>
            <Routes>
                <Route path="/admin" element={
                    !token ? (
                        <Auth />
                    ) : (
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <Navigate to="/superadmin" /> : <Navigate to="/" />
                    )
                } />
                <Route path="/" element={
                    !token ? (
                        <Auth />
                    ) : (
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <Navigate to="/superadmin" /> : (
                            (user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL' ? <Navigate to="/hospital-admin" /> :
                                (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <Navigate to="/receptionist" /> :
                                    (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <Navigate to="/doctor" /> :
                                        <Dashboard />
                        )
                    )
                } />
                <Route path="/register" element={<Auth />} />
                <Route element={token ? <Layout /> : <Navigate to="/" />}>
                    {/* Common Routes - protected by backend mainly but UI should also guard */}
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/sessions" element={<Sessions />} />
                    <Route path="/sessions/:id" element={<SessionDetails />} />

                    {/* Super Admin Routes */}
                    <Route path="/superadmin" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/organizations" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <Organizations /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/users" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <SuperAdminUsers /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/hospitals" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <HospitalDetails /> : <Navigate to="/" />
                    } />
                    <Route path="/superadmin/register" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'SUPER_ADMIN' ? <Auth /> : <Navigate to="/" />
                    } />

                    {/* Admin Routes */}
                    <Route path="/hospital-admin" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/hospital-admin/users" element={
                        ((user?.role || user?.user?.role)?.toUpperCase() === 'ADMIN' || (user?.role || user?.user?.role)?.toUpperCase() === 'HOSPITAL') ? <AdminUsers /> : <Navigate to="/" />
                    } />

                    {/* Receptionist Routes */}
                    <Route path="/receptionist" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/receptionist/patients" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistPatients /> : <Navigate to="/" />
                    } />
                    <Route path="/receptionist/appointments" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'RECEPTIONIST' ? <ReceptionistAppointments /> : <Navigate to="/" />
                    } />

                    {/* Doctor Routes */}
                    <Route path="/doctor" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/patients" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorPatients /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/schedule" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorAppointments /> : <Navigate to="/" />
                    } />
                    <Route path="/doctor/session/:patientId" element={
                        (user?.role || user?.user?.role)?.toUpperCase() === 'DOCTOR' ? <DoctorSessionMode /> : <Navigate to="/" />
                    } />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
