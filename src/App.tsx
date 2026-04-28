import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { GlobalNotificationProvider } from './context/GlobalNotificationContext';
import { SoundProvider } from './context/SoundContext';
import { Loader2, Wrench } from 'lucide-react';

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
import Indicar from './pages/Indicar';

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
    if (localStorage.getItem('has_account') === 'true') {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to="/indicar" replace />;
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

function AppContent() {
  const { user, logout } = useAuth();
  const [maintenance, setMaintenance] = useState<any>(null);
  const location = useLocation();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
     let interval: NodeJS.Timeout;
     let isMounted = true;

     const checkMaintenance = async () => {
         try {
             const r = await fetch('/api/settings/public');
             const data = await r.json();
             if (isMounted) {
                 if (data.maintenance_mode === 'on' && !isAdmin) {
                     setMaintenance(data);
                     if (user && user.role !== 'admin') {
                         logout(); // Auto-logout standard specific users immediately
                     }
                 } else {
                     setMaintenance(null);
                 }
             }
         } catch(e) {}
     };
     
     checkMaintenance();
     interval = setInterval(checkMaintenance, 5000); // Poll every 5 seconds for fast re-logout/block
     return () => { isMounted = false; clearInterval(interval); };
  }, [isAdmin, user, logout]);

  // Permitir acesso à rota de login para que admins possam entrar
  const isAuthRoute = location.pathname.startsWith('/login');

  if (maintenance && !isAuthRoute) {
      return (
          <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-purple-900/10 to-black pointer-events-none"></div>
              
              {/* Blurred background elements for styling */}
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-purple-600/20 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>

              <div className="relative z-10 w-28 h-28 bg-gradient-to-tr from-purple-600/20 to-blue-500/20 text-purple-400 rounded-[2rem] flex items-center justify-center mb-8 border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-xl">
                 <Wrench size={56} className="animate-[wiggle_1s_ease-in-out_infinite]" />
              </div>

              <h1 className="relative z-10 text-5xl md:text-6xl font-black mb-4 tracking-tight">
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                    {maintenance.maintenance_message || 'Estamos em Manutenção'}
                 </span>
              </h1>
              
              <p className="relative z-10 text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed">
                 Nosso aplicativo está passando por modernizações. Fique tranquilo, todas as suas moedas e tickets estão seguros. Voltamos logo!
              </p>
              
              {maintenance.maintenance_end && (
                  <div className="relative z-10 mt-10 p-6 bg-secondary/20 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-md flex flex-col gap-2 transform transition-transform hover:scale-105">
                      <p className="text-xs font-black text-purple-400 uppercase tracking-[0.2em]">Previsão de Retorno</p>
                      <p className="text-3xl font-mono text-white font-bold">{new Date(maintenance.maintenance_end).toLocaleString()}</p>
                  </div>
              )}
          </div>
      );
  }

  return (
    <>
      <div className="mesh-bg"></div>
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
        
        <Route
          path="/indicar"
          element={
             <Indicar />
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
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SoundProvider>
        <NotificationProvider>
          <AuthProvider>
            <GlobalNotificationProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </GlobalNotificationProvider>
          </AuthProvider>
        </NotificationProvider>
      </SoundProvider>
    </ThemeProvider>
  );
}
