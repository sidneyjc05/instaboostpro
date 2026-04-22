import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { SoundProvider } from './context/SoundContext';

// Components
import { Layout } from './components/Layout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Create from './pages/Create';
import Store from './pages/Store';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Roulette from './pages/Roulette';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <SoundProvider>
        <NotificationProvider>
          <AuthProvider>
            <div className="mesh-bg"></div>
            <BrowserRouter>
              <Routes>
                {/* Public Route */}
                <Route 
                  path="/login" 
                  element={
                    <PublicOnlyRoute>
                      <Login />
                    </PublicOnlyRoute>
                  } 
                />

                {/* Protected Routes */}
                <Route 
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Home />} />
                  <Route path="/new" element={<Create />} />
                  <Route path="/roulette" element={<Roulette />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<Admin />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </NotificationProvider>
      </SoundProvider>
    </ThemeProvider>
  );
}
