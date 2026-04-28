import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';
import { AdminUsers } from '../components/admin/AdminUsers';
import { AdminSupport } from '../components/admin/AdminSupport';
import { AdminSettings } from '../components/admin/AdminSettings';
import AdminStore from '../components/admin/AdminStore';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Users, Activity, Settings as SettingsIcon, MessageSquare, Store, Zap } from 'lucide-react';



export default function Admin() {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>({});
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    if (!user || user.role !== 'admin') return <Navigate to="/" />;

    const fetchAdminData = async () => {
        try {
            const [usersRes, statsRes] = await Promise.all([
                fetch('/api/admin/users/all'),
                fetch('/api/admin/stats')
            ]);
            if (usersRes.ok) setUsers(await usersRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
        } catch(e) {}
        setLoading(false);
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: Activity },
        { id: 'users', label: 'Usuários', icon: Users },
        { id: 'store', label: 'Loja PRO', icon: Zap },
        { id: 'support', label: 'Suporte', icon: MessageSquare },
        { id: 'settings', label: 'Config. & Backup', icon: SettingsIcon },
    ];

    if (loading) return <div className="p-8 text-center animate-pulse">Carregando painel...</div>;

    return (
        <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-red-500 flex items-center gap-2">Admin PRO</h1>
                        <p className="text-sm text-muted-foreground">Sistema de Gerenciamento Avançado</p>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                    {tabs.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-red-500/20 text-red-500 font-bold border border-red-500/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border border-transparent'}`}>
                                <Icon size={16} /> {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4">
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-card border border-border p-6 rounded-3xl">
                            <p className="text-sm text-muted-foreground">Total de Usuários</p>
                            <h3 className="text-3xl font-black mt-1">{stats.totalUsers || 0}</h3>
                        </div>
                        <div className="bg-card border border-border p-6 rounded-3xl">
                            <p className="text-sm text-muted-foreground">Moedas Distribuídas</p>
                            <h3 className="text-3xl font-black mt-1 text-primary">{Math.floor(stats.totalCoins || 0).toLocaleString()} <span className="text-sm">🪙</span></h3>
                        </div>
                        <div className="bg-card border border-border p-6 rounded-3xl">
                            <p className="text-sm text-muted-foreground">Planos Ativos</p>
                            <h3 className="text-3xl font-black mt-1 text-green-500">{stats.activePlans || 0}</h3>
                        </div>
                        <div className="bg-card border border-border p-6 rounded-3xl">
                            <p className="text-sm text-muted-foreground">Receita PIX (Aprovada)</p>
                            <h3 className="text-3xl font-black mt-1 text-blue-500">R$ {(stats.totalPixValue || 0).toFixed(2)}</h3>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && <AdminUsers users={users} refresh={fetchAdminData} />}
                {activeTab === 'store' && <AdminStore />}
                {activeTab === 'support' && <AdminSupport />}
                {activeTab === 'settings' && <AdminSettings />}
            </div>
        </div>
    );
}
