import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';
import { Shield, Users, Activity, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { showNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role !== 'admin') {
     return <Navigate to="/" />;
  }

  useEffect(() => {
     fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
     setLoading(true);
     try {
       const [usersRes, logsRes] = await Promise.all([
         fetch('/api/admin/users'),
         fetch('/api/admin/logs')
       ]);
       if (usersRes.ok) setUsers(await usersRes.json());
       if (logsRes.ok) setLogs(await logsRes.json());
     } catch {
       showNotification.error('Erro ao carregar dados do admin');
     }
     setLoading(false);
  };

  const handleBlockUser = async (userId: number, currentStatus: number) => {
     try {
        const res = await fetch(`/api/admin/users/${userId}/block`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ blocked: !currentStatus })
        });
        if (res.ok) {
           showNotification.success(currentStatus ? 'Usuário desbloqueado' : 'Usuário bloqueado');
           fetchAdminData();
        }
     } catch {
        showNotification.error('Erro ao conectar ao servidor');
     }
  };

  const handlePromoteRole = async (userId: number, currentRole: string) => {
     const newRole = currentRole === 'admin' ? 'user' : 'admin';
     try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
           showNotification.success(`Usuário atualizado para ${newRole}`);
           fetchAdminData();
        }
     } catch {
        showNotification.error('Erro ao conectar ao servidor');
     }
  };

  if (loading) {
     return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando painel de administração...</div>;
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-3 border-b border-border pb-4">
         <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
            <Shield size={24} />
         </div>
         <div>
            <h1 className="text-2xl font-bold text-red-500">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento de Segurança Avançado</p>
         </div>
      </div>

      <div className="bg-card w-full border border-border rounded-3xl p-6 overflow-x-auto">
         <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="text-primary" /> Gestão de Usuários
         </h2>
         <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/30">
               <tr>
                  <th className="p-3 rounded-tl-xl">ID</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Moedas</th>
                  <th className="p-3">Autenticado</th>
                  <th className="p-3 text-right rounded-tr-xl">Ações</th>
               </tr>
            </thead>
            <tbody>
               {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10">
                     <td className="p-3 text-muted-foreground">#{u.id}</td>
                     <td className="p-3 font-medium">@{u.username}</td>
                     <td className="p-3 text-muted-foreground">{u.email || '-'}</td>
                     <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded-md ${u.role === 'admin' ? 'bg-red-500/20 text-red-500' : 'bg-secondary/50'}`}>
                           {u.role}
                        </span>
                     </td>
                     <td className="p-3 font-mono">{u.credits}</td>
                     <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded-md ${!u.is_blocked ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                           {!u.is_blocked ? 'Liberado' : 'Bloqueado'}
                        </span>
                     </td>
                     <td className="p-3 flex justify-end gap-2">
                        <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={() => handlePromoteRole(u.id, u.role)}
                           className="h-8 text-xs"
                        >
                           <ShieldAlert size={14} className="mr-1" /> {u.role === 'admin' ? 'Remover Admin' : 'Admin'}
                        </Button>
                        <Button 
                           variant={u.is_blocked ? "primary" : "destructive"} 
                           size="sm" 
                           onClick={() => handleBlockUser(u.id, u.is_blocked)}
                           className="h-8 text-xs"
                        >
                           {u.is_blocked ? <><Unlock size={14} className="mr-1"/> Desbloquear</> : <><Lock size={14} className="mr-1"/> Bloquear</>}
                        </Button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

      <div className="bg-card w-full border border-border rounded-3xl p-6 overflow-x-auto">
         <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="text-blue-500" /> Logs de Acesso Recentes
         </h2>
         <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/30">
               <tr>
                  <th className="p-3 rounded-tl-xl">Data / Hora</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Endereço IP</th>
                  <th className="p-3 rounded-tr-xl">Dispositivo / Agente</th>
               </tr>
            </thead>
            <tbody>
               {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10">
                     <td className="p-3 text-muted-foreground font-mono">{new Date(l.created_at).toLocaleString()}</td>
                     <td className="p-3 font-medium">@{l.username}</td>
                     <td className="p-3 font-mono text-xs">{l.ip}</td>
                     <td className="p-3 text-xs text-muted-foreground max-w-xs truncate" title={l.device}>{l.device}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

    </div>
  );
}
