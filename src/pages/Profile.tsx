import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4">
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold">@{user.username}</h2>
        <div className="mt-4 px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 rounded-full font-semibold flex items-center gap-2">
          <span>💎</span>
          <span>{user.credits} Créditos</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-4">
        <h3 className="font-bold border-b border-border pb-3">Configurações da Conta</h3>
        
        <Button variant="destructive" className="flex items-center gap-2 w-full mt-4" onClick={logout}>
          <LogOut size={18} /> Sair da conta
        </Button>
      </div>
    </div>
  );
}
