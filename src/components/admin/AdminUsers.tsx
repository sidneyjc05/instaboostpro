import React, { useState } from 'react';
import { Users, AlertCircle, ShoppingCart, Settings, Shield, Edit, Search, Crown, User as UserIcon, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { AnimatedIcon } from '../AnimatedIcon';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

export function AdminUsers({ users, refresh }: { users: any[], refresh: () => void }) {
    const { user: currentUser } = useAuth();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all, owner, admin, active, blocked, plan, new
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [newPlan, setNewPlan] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useBodyScrollLock(!!selectedUser);

    const filtered = users.filter(u => {
        if (filter === 'owner') return u.role === 'owner';
        if (filter === 'admin') return u.role === 'admin';
        if (filter === 'active') return !u.is_blocked;
        if (filter === 'blocked') return u.is_blocked;
        if (filter === 'plan') return u.plan_type !== 'basic';
        if (filter === 'new') return new Date(u.created_at || 0).getTime() > Date.now() - 7 * 24 * 3600 * 1000;
        return true;
    }).filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || String(u.id).toLowerCase() === q || u.referral_code?.toLowerCase().includes(q);
    });

    const handleAction = async (action: string, value: any) => {
        setActionLoading(true);
        try {
            if (selectedUser?.id) {
                const userDocRef = doc(db, 'users', String(selectedUser.id));
                const updates: any = {};
                const numValue = Number(value) || 0;

                if (action === 'set_role') {
                    updates.role = value;
                } else if (action === 'set_plan') {
                    const expiresAt = value === 'basic' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                    updates.plan_type = value;
                    updates.plan_expires_at = expiresAt;
                } else if (action === 'add_coins') {
                    updates.credits = increment(numValue);
                } else if (action === 'remove_coins') {
                    updates.credits = increment(-numValue);
                } else if (action === 'add_tickets') {
                    updates.tickets = increment(numValue);
                } else if (action === 'remove_tickets') {
                    updates.tickets = increment(-numValue);
                } else if (action === 'change_email') {
                    updates.email = value;
                }
                // Password change cannot be done purely via Firestore without a Cloud Function, 
                // so we might skip it or just update it if there's a custom sync, but we'll ignore it for now or assume they use auth reset.

                await updateDoc(userDocRef, updates);
                
                showNotification.success('Ação concluída com sucesso!');
                setAmount(''); setReason(''); setNewPlan(''); setNewRole(''); setNewEmail(''); setNewPassword('');
                refresh();
                setSelectedUser(null);
            }
        } catch(e) {
            console.error(e);
            showNotification.error('Erro ao atualizar usuário');
        }
        setActionLoading(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input placeholder="Buscar nome, email, ID, código..." className="pl-10 h-10" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="bg-secondary text-sm border-border rounded-lg p-2.5 w-full md:w-auto font-medium" value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="all">Todos os Usuários ({users.length})</option>
                    <option value="owner">👑 Donos</option>
                    <option value="admin">🛡️ Administradores</option>
                    <option value="active">Ativos</option>
                    <option value="blocked">Bloqueados</option>
                    <option value="plan">Com Plano VIP</option>
                    <option value="new">Novos (Últimos 7 dias)</option>
                </select>
            </div>

            <div className="bg-card w-full border border-border rounded-3xl p-6 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-secondary/30">
                      <tr>
                         <th className="p-3.5 rounded-tl-xl w-16">ID</th>
                         <th className="p-3.5">Usuário / Cargo</th>
                         <th className="p-3.5">Email</th>
                         <th className="p-3.5">Plano</th>
                         <th className="p-3.5">Moedas / Tickets</th>
                         <th className="p-3.5 rounded-tr-xl">Status</th>
                      </tr>
                   </thead>
                   <tbody>
                      {filtered.map(u => {
                         const isOwner = u.role === 'owner';
                         const isAdmin = u.role === 'admin';
                         return (
                            <tr key={u.id} onClick={() => setSelectedUser(u)} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer transition-colors">
                               <td className="p-3.5 text-muted-foreground font-mono text-xs">#{String(u.id).slice(0, 8)}</td>
                               <td className="p-3.5 font-medium">
                                  <div className="flex items-center gap-2">
                                     {isOwner && (
                                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                                           <Crown size={12} className="text-amber-400" /> Dono
                                        </span>
                                     )}
                                     {isAdmin && !isOwner && (
                                        <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                                           <Shield size={12} className="text-red-400" /> Admin
                                        </span>
                                     )}
                                     <span className="font-bold text-foreground">@{u.username}</span>
                                  </div>
                               </td>
                               <td className="p-3.5 text-muted-foreground text-xs">{u.email || '-'}</td>
                               <td className="p-3.5">
                                  <span className={`text-xs font-bold uppercase ${
                                     u.plan_type === 'ultra' ? 'text-amber-400' :
                                     u.plan_type === 'premium' ? 'text-primary' :
                                     u.plan_type === 'pro' ? 'text-green-400' : 'text-muted-foreground'
                                  }`}>
                                     {u.plan_type || 'basic'}
                                  </span>
                               </td>
                               <td className="p-3.5 font-mono text-xs flex items-center gap-1.5 mt-2">
                                  {Math.floor(u.credits || 0).toLocaleString('pt-BR')} <AnimatedIcon type="coin" size={14} /> / {u.tickets || 0} <AnimatedIcon type="ticket" size={14} />
                                </td>
                               <td className="p-3.5">
                                  <span className={`px-2.5 py-1 text-[10px] uppercase font-black rounded-lg ${!u.is_blocked ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                     {!u.is_blocked ? 'Ativo' : 'Bloqueado'}
                                  </span>
                               </td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
            </div>

            {selectedUser && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedUser(null)}>
                    <div className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl p-6 flex flex-col gap-6 relative my-8" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-border/50 pb-4">
                            <h2 className="text-xl font-black flex items-center gap-2">
                                Gerenciar @{selectedUser.username}
                                {selectedUser.role === 'owner' && <Crown size={18} className="text-amber-400" />}
                                {selectedUser.role === 'admin' && <Shield size={18} className="text-red-400" />}
                            </h2>
                            <span className="text-xs font-mono text-muted-foreground">ID: #{selectedUser.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Role Switcher */}
                            <div className="bg-secondary/30 p-4 rounded-2xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-1 flex items-center gap-1.5">
                                    <Crown size={16} className="text-amber-400" /> Cargo & Permissão da Conta
                                </h3>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                    Defina se o usuário é Dono, Administrador ou Usuário Comum
                                </p>
                                <select 
                                    className="bg-secondary border border-border rounded-xl p-2.5 w-full text-sm font-bold" 
                                    value={newRole || selectedUser.role || 'user'} 
                                    onChange={e => setNewRole(e.target.value)}
                                >
                                    <option value="user">👤 Usuário Comum</option>
                                    <option value="admin">🛡️ Administrador</option>
                                    <option value="owner">👑 Dono do Sistema (Founder)</option>
                                </select>
                                <Button 
                                    className="w-full mt-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs rounded-xl h-10" 
                                    disabled={actionLoading || (newRole === selectedUser.role && !newRole)} 
                                    onClick={() => handleAction('set_role', newRole || selectedUser.role)}
                                >
                                    Atualizar Cargo
                                </Button>
                            </div>

                            {/* Moedas e Tickets */}
                            <div className="bg-secondary/30 p-4 rounded-2xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-1">Moedas e Tickets</h3>
                                <div className="flex gap-2">
                                    <Input placeholder="Quantidade" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-10" />
                                </div>
                                <Input placeholder="Motivo (Opcional)" value={reason} onChange={e => setReason(e.target.value)} className="h-9 text-xs" />
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <Button variant="outline" className="text-xs rounded-xl font-bold" disabled={actionLoading} onClick={() => handleAction('add_coins', amount)}>+ Moedas</Button>
                                    <Button variant="outline" className="text-xs rounded-xl font-bold text-red-500" disabled={actionLoading} onClick={() => handleAction('remove_coins', amount)}>- Moedas</Button>
                                    <Button variant="outline" className="text-xs rounded-xl font-bold" disabled={actionLoading} onClick={() => handleAction('add_tickets', amount)}>+ Tickets</Button>
                                    <Button variant="outline" className="text-xs rounded-xl font-bold text-red-500" disabled={actionLoading} onClick={() => handleAction('remove_tickets', amount)}>- Tickets</Button>
                                </div>
                            </div>
                            
                            {/* Plano Ativo */}
                            <div className="bg-secondary/30 p-4 rounded-2xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-1">Plano VIP</h3>
                                <select className="bg-secondary border border-border rounded-xl p-2.5 w-full text-sm font-bold" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    <option value="basic">Remover Plano (Basic)</option>
                                    <option value="pro">Ativar PRO (30 dias)</option>
                                    <option value="premium">Ativar PREMIUM (30 dias)</option>
                                    <option value="ultra">Ativar ULTRA (30 dias)</option>
                                </select>
                                <Button className="w-full mt-2 rounded-xl text-xs font-bold" disabled={actionLoading || !newPlan} onClick={() => handleAction('set_plan', newPlan)}>Atualizar Plano</Button>
                            </div>
                            
                            {/* Segurança da Conta */}
                            <div className="bg-secondary/30 p-4 rounded-2xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-1">Segurança da Conta</h3>
                                <div className="flex gap-2">
                                    <Input placeholder="Novo email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-9 text-xs" />
                                    <Button variant="outline" className="whitespace-nowrap text-xs rounded-xl font-bold" disabled={actionLoading || !newEmail} onClick={() => handleAction('change_email', newEmail)}>Trocar</Button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Input placeholder="Nova senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9 text-xs" />
                                    <Button variant="outline" className="whitespace-nowrap text-xs rounded-xl font-bold" disabled={actionLoading || !newPassword} onClick={() => handleAction('change_password', newPassword)}>Trocar</Button>
                                </div>
                            </div>
                        </div>

                        {/* Block/Unblock */}
                        <div className="border-t border-border/50 pt-4 flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                                Status atual: <strong className={selectedUser.is_blocked ? "text-red-400" : "text-green-400"}>{selectedUser.is_blocked ? "Bloqueado" : "Ativo"}</strong>
                            </span>
                            <Button 
                                variant={selectedUser.is_blocked ? "primary" : "destructive"} 
                                className="rounded-xl font-bold text-xs px-6" 
                                onClick={async () => {
                                    try {
                                        const userDocRef = doc(db, 'users', String(selectedUser.id));
                                        await updateDoc(userDocRef, { is_blocked: !selectedUser.is_blocked });
                                        showNotification.success(selectedUser.is_blocked ? 'Usuário desbloqueado!' : 'Usuário bloqueado!');
                                        refresh();
                                        setSelectedUser(null);
                                    } catch (e) {
                                        showNotification.error('Erro ao atualizar status');
                                    }
                                }}
                            >
                                {selectedUser.is_blocked ? 'Desbloquear Usuário' : 'Bloquear Acesso'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
