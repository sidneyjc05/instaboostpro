import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Home, PlusSquare, Store, User, Sun, Moon, Volume2, VolumeX, ShieldAlert, Target, LifeBuoy, AlertTriangle, Bell, CheckCircle2, Crown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAppSound } from '../context/SoundContext';
import { useAuth } from '../context/AuthContext';
import { UserSupportModal } from './UserSupportModal';
import { NotificationsDropdown } from './NotificationsDropdown';
import { AnimatedBackground } from './AnimatedBackground';
import { motion } from 'motion/react';
import { useGlobalTimeTracker } from '../hooks/useGlobalTimeTracker';

export function Layout() {
  useGlobalTimeTracker();
  const { theme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound } = useAppSound();
  const { user } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';

  const handleToggleSound = () => toggleSound();
  const handleToggleTheme = () => toggleTheme();

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0 md:pl-20 bg-background/80 text-foreground transition-colors duration-500 font-sans">
      <AnimatedBackground />
      
      {/* Top Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex justify-between items-center md:hidden">
        <h1 className="text-xl font-extrabold tracking-tight">
          InstaBoost <span className="text-primary">PRO</span>
        </h1>
        <div className="flex gap-2 items-center">
          <NotificationsDropdown />
          <button onClick={() => setSupportOpen(true)} className="p-2 rounded-full hover:bg-secondary text-blue-500">
             <LifeBuoy size={20} />
          </button>
          <button onClick={handleToggleSound} className="p-2 rounded-full hover:bg-secondary">
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={handleToggleTheme} className="p-2 rounded-full hover:bg-secondary">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col items-center justify-between fixed left-0 top-0 h-[100dvh] w-20 bg-card border-r border-border py-4 z-20 overflow-y-auto hidden-scrollbar">
        <div className="flex flex-col items-center gap-8">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)]">
            IB
          </div>
          <nav className="flex flex-col gap-6">
            <NavItem to="/" icon={<Home />} label="Feed" />
            <NavItem to="/new" icon={<PlusSquare />} label="Criar" />
            <NavItem to="/roulette" icon={<Target />} label="Roleta" />
            <NavItem to="/store" icon={<Store />} label="Loja" />
            <NavItem to="/profile" icon={<User />} label="Perfil" />
            {isAdmin && (
              <NavItem 
                to="/admin" 
                icon={isOwner ? <Crown className="text-amber-400" /> : <ShieldAlert className="text-red-400" />} 
                label={isOwner ? "Dono" : "Admin"} 
              />
            )}
          </nav>
        </div>
        <div className="flex flex-col gap-6 items-center">
          <NotificationsDropdown />
          <button onClick={() => setSupportOpen(true)} className="p-3 rounded-xl hover:bg-secondary text-blue-500 hover:scale-110 transition-transform">
             <LifeBuoy size={24} />
          </button>
          <button onClick={handleToggleSound} className="p-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          <button onClick={handleToggleTheme} className="p-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-card border-t border-border flex justify-around p-3 pb-safe z-20 overflow-x-auto">
        <NavItem to="/" icon={<Home />} label="Feed" />
        <NavItem to="/new" icon={<PlusSquare />} label="Criar" />
        <NavItem to="/roulette" icon={<Target />} label="Roleta" />
        <NavItem to="/store" icon={<Store />} label="Loja" />
        <NavItem to="/profile" icon={<User />} label="Perfil" />
        {isAdmin && (
          <NavItem 
            to="/admin" 
            icon={isOwner ? <Crown className="text-amber-400" /> : <ShieldAlert className="text-red-400" />} 
            label={isOwner ? "Dono" : "Admin"} 
          />
        )}
      </nav>

      <UserSupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const { playClick } = useAppSound();
  return (
    <NavLink 
      to={to} 
      onClick={() => playClick()}
      className={({ isActive }) => 
        `relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-300 group overflow-hidden ${
          isActive 
            ? 'text-white' 
            : 'text-muted-foreground hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div 
              layoutId="nav-pill" 
              className="absolute inset-0 bg-gradient-to-tr from-primary to-accent opacity-90 shadow-[0_0_20px_rgba(139,92,246,0.5)] z-0 rounded-2xl" 
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          )}
          <motion.div 
             className="z-10 relative"
             animate={isActive ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] } : {}}
             transition={{ duration: 0.5, ease: "easeInOut" }}
             whileHover={!isActive ? { y: -3, scale: 1.1 } : {}}
          >
            {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: isActive ? 2.5 : 2 })}
          </motion.div>
          <span className="text-[10px] font-bold z-10 relative hidden md:block uppercase tracking-wider">{label}</span>
        </>
      )}
    </NavLink>
  );
}
