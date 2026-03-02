import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import InspectionWizard from './components/InspectionWizard';
import InspectionFinish from './components/InspectionFinish';
import Login from './components/Login';
import AddProperty from './components/AddProperty';
import EditProperty from './components/EditProperty';
import PropertyDetail from './components/PropertyDetail';
import UserManagement from './components/admin/UserManagement';
import ChecklistManagement from './components/admin/ChecklistManagement';
import Impressum from './components/Impressum';
import Datenschutz from './components/Datenschutz';
import { AuthProvider, useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />

            <Route path="/" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />

            <Route path="/properties/new" element={
              <ProtectedRoute><AddProperty /></ProtectedRoute>
            } />

            <Route path="/properties/:id" element={
              <ProtectedRoute><PropertyDetail /></ProtectedRoute>
            } />

            <Route path="/properties/:id/edit" element={
              <ProtectedRoute><EditProperty /></ProtectedRoute>
            } />

            <Route path="/inspection/new/:propertyId" element={
              <ProtectedRoute><InspectionWizard /></ProtectedRoute>
            } />

            <Route path="/inspection/finish/:id" element={
              <ProtectedRoute><InspectionFinish /></ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/users" element={
              <AdminRoute><UserManagement /></AdminRoute>
            } />
            <Route path="/admin/checklist" element={
              <AdminRoute><ChecklistManagement /></AdminRoute>
            } />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
