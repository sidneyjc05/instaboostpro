import React, { useState } from 'react';
import { Users, AlertCircle, ShoppingCart, Settings, Shield, Edit, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export function AdminUsers({ users, refresh }: { users: any[], refresh: () => void }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all, active, blocked, plan, new
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [newPlan, setNewPlan] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useBodyScrollLock(!!selectedUser);

    const filtered = users.filter(u => {
        if (filter === 'active') return !u.is_blocked;
        if (filter === 'blocked') return u.is_blocked;
        if (filter === 'plan') return u.plan_type !== 'basic';
        if (filter === 'new') return new Date(u.created_at).getTime() > Date.now() - 7 * 24 * 3600 * 1000;
        return true;
    }).filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || String(u.id) === q || u.referral_code?.toLowerCase().includes(q);
    });

    const handleAction = async (action: string, value: any) => {
        setActionLoading(true);
        try {
            const res = await fetch(`$\{import.meta.env.BASE_URL\}api/admin/users/${selectedUser.id}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, value, reason })
            });
            const data = await res.json();
            if (data.error) showNotification.error(data.error);
            else {
                showNotification.success('Ação concluída com sucesso!');
                setAmount(''); setReason(''); setNewPlan(''); setNewEmail(''); setNewPassword('');
                refresh();
                setSelectedUser(null);
            }
        } catch(e) {
            showNotification.error('Erro de conexão');
        }
        setActionLoading(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input placeholder="Buscar nome, email, ID..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="bg-secondary text-sm border-border rounded-lg p-2" value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="blocked">Bloqueados</option>
                    <option value="plan">Com Plano</option>
                    <option value="new">Novos (7 dias)</option>
                </select>
            </div>

            <div className="bg-card w-full border border-border rounded-3xl p-6 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-secondary/30">
                      <tr>
                         <th className="p-3 rounded-tl-xl w-16">ID</th>
                         <th className="p-3">Usuário</th>
                         <th className="p-3">Email</th>
                         <th className="p-3">Plano</th>
                         <th className="p-3">Moedas/Tickets</th>
                         <th className="p-3 rounded-tr-xl">Status</th>
                      </tr>
                   </thead>
                   <tbody>
                      {filtered.map(u => (
                         <tr key={u.id} onClick={() => setSelectedUser(u)} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer transition-colors">
                            <td className="p-3 text-muted-foreground font-mono">#{u.id}</td>
                            <td className="p-3 font-medium flex items-center gap-2">
                               {u.role === 'admin' && <Shield size={14} className="text-red-500" />}
                               @{u.username}
                            </td>
                            <td className="p-3 text-muted-foreground">{u.email || '-'}</td>
                            <td className="p-3 uppercase text-xs font-bold text-primary">{u.plan_type}</td>
                            <td className="p-3 font-mono">{Math.floor(u.credits)} 🪙 / {u.tickets} 🎟️</td>
                            <td className="p-3">
                               <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md ${!u.is_blocked ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                  {!u.is_blocked ? 'Ativo' : 'Bloqueado'}
                               </span>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
            </div>

            {selectedUser && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
                    <div className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl p-6 flex flex-col gap-6 relative" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Gerenciar Usuário {selectedUser.username} #{selectedUser.id}
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-secondary/30 p-4 rounded-xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-2">Moedas e Tickets</h3>
                                <div className="flex gap-2">
                                    <Input placeholder="Quantidade" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                                </div>
                                <Input placeholder="Motivo (Opcional)" value={reason} onChange={e => setReason(e.target.value)} />
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <Button variant="outline" className="text-xs" disabled={actionLoading} onClick={() => handleAction('add_coins', amount)}>+ Moedas</Button>
                                    <Button variant="outline" className="text-xs text-red-500" disabled={actionLoading} onClick={() => handleAction('remove_coins', amount)}>- Moedas</Button>
                                    <Button variant="outline" className="text-xs" disabled={actionLoading} onClick={() => handleAction('add_tickets', amount)}>+ Tickets</Button>
                                    <Button variant="outline" className="text-xs text-red-500" disabled={actionLoading} onClick={() => handleAction('remove_tickets', amount)}>- Tickets</Button>
                                </div>
                            </div>
                            
                            <div className="bg-secondary/30 p-4 rounded-xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-2">Plano Ativo</h3>
                                <select className="bg-secondary border border-border rounded-md p-2 w-full text-sm" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    <option value="basic">Remover Plano (Basic)</option>
                                    <option value="pro">Ativar PRO (30 dias)</option>
                                    <option value="premium">Ativar PREMIUM (30 dias)</option>
                                    <option value="ultra">Ativar ULTRA (30 dias)</option>
                                </select>
                                <Button className="w-full mt-2" disabled={actionLoading || !newPlan} onClick={() => handleAction('set_plan', newPlan)}>Atualizar Plano</Button>
                            </div>
                            
                            <div className="bg-secondary/30 p-4 rounded-xl flex flex-col gap-2 border border-border">
                                <h3 className="font-bold text-sm text-primary mb-2">Segurança da Conta</h3>
                                <div className="flex gap-2">
                                    <Input placeholder="Novo email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                                    <Button variant="outline" className="whitespace-nowrap" disabled={actionLoading || !newEmail} onClick={() => handleAction('change_email', newEmail)}>Trocar</Button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Input placeholder="Nova senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                    <Button variant="outline" className="whitespace-nowrap" disabled={actionLoading || !newPassword} onClick={() => handleAction('change_password', newPassword)}>Trocar</Button>
                                </div>
                            </div>
                            
                            <div className="bg-secondary/30 p-4 rounded-xl flex flex-col gap-2 border border-border justify-center items-center text-center">
                                <h3 className="font-bold text-sm text-red-500 mb-2 mt-auto">Acesso</h3>
                                <Button variant={selectedUser.is_blocked ? "primary" : "destructive"} className="w-full mt-auto" onClick={async () => {
                                    await fetch(`$\{import.meta.env.BASE_URL\}api/admin/users/${selectedUser.id}/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocked: !selectedUser.is_blocked }) });
                                    refresh();
                                    setSelectedUser(null);
                                }}>
                                    {selectedUser.is_blocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
