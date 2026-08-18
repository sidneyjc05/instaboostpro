import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';
import { AdminUsers } from '../components/admin/AdminUsers';
import { AdminSupport } from '../components/admin/AdminSupport';
import { AdminSettings } from '../components/admin/AdminSettings';
import AdminStore from '../components/admin/AdminStore';
import { AdminPayments } from '../components/admin/AdminPayments';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Users, Activity, Settings as SettingsIcon, MessageSquare, Store, Zap, CreditCard, Crown, Clock } from 'lucide-react';
import { GlobalLoader } from '../components/GlobalLoader';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Admin() {
    const { user } = useAuth();
    const [stats, setStats] = useState<any>({});
    const [users, setUsers] = useState<any[]>([]);
    const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    const isOwner = user?.role === 'owner';
    const isAdmin = user?.role === 'admin' || isOwner;

    if (!user || !isAdmin) return <Navigate to="/" />;

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

        // Listen for pending payments count from Firestore
        const pendingQuery = query(
            collection(db, 'payments'),
            where('status', 'in', ['pending', 'in_queue'])
        );
        const unsubscribe = onSnapshot(pendingQuery, (snap) => {
            setPendingPaymentsCount(snap.docs.length);
        }, () => {});

        return () => unsubscribe();
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: Activity },
        { id: 'payments', label: 'Fila de Pagamentos', icon: CreditCard, badge: pendingPaymentsCount },
        { id: 'users', label: 'Usuários & Cargos', icon: Users },
        { id: 'store', label: 'Loja PRO', icon: Zap },
        { id: 'support', label: 'Suporte', icon: MessageSquare },
        { id: 'settings', label: 'Config. & Backup', icon: SettingsIcon },
    ];

    if (loading) return <GlobalLoader isLoading={true} />;

    return (
        <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto w-full">
            <GlobalLoader isLoading={loading} />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${
                        isOwner 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10' 
                            : 'bg-red-500/10 text-red-500 border-red-500/30 shadow-red-500/10'
                    }`}>
                        {isOwner ? <Crown size={26} /> : <Shield size={24} />}
                    </div>
                    <div>
                        <h1 className={`text-2xl font-black flex items-center gap-2 ${
                            isOwner ? 'text-amber-400' : 'text-red-500'
                        }`}>
                            {isOwner ? 'Painel do Dono (Founder)' : 'Admin PRO'}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {isOwner ? 'Controle Total & Gestão Geral do Sistema' : 'Sistema de Gerenciamento Avançado'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                    {tabs.map(t => {
                        const Icon = t.icon;
                        const isActive = activeTab === t.id;
                        return (
                            <button 
                                key={t.id} 
                                onClick={() => setActiveTab(t.id)} 
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap text-xs font-bold transition-all ${
                                    isActive 
                                        ? isOwner 
                                            ? 'bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40 shadow-md shadow-amber-500/10' 
                                            : 'bg-red-500/20 text-red-500 font-extrabold border border-red-500/30' 
                                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border border-transparent hover:text-foreground'
                                }`}
                            >
                                <Icon size={16} /> 
                                {t.label}
                                {t.badge !== undefined && t.badge > 0 && (
                                    <span className="px-1.5 py-0.2 bg-amber-500 text-black font-black text-[10px] rounded-full animate-pulse">
                                        {t.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-card border border-border p-6 rounded-3xl">
                                <p className="text-xs font-bold text-muted-foreground uppercase">Total de Usuários</p>
                                <h3 className="text-3xl font-black mt-1">{stats.totalUsers || users.length || 0}</h3>
                            </div>
                            <div className="bg-card border border-border p-6 rounded-3xl">
                                <p className="text-xs font-bold text-muted-foreground uppercase">Moedas em Circulação</p>
                                <h3 className="text-3xl font-black mt-1 text-primary">
                                    {Math.floor(stats.totalCoins || 0).toLocaleString('pt-BR')} <span className="text-sm">🪙</span>
                                </h3>
                            </div>
                            <div className="bg-card border border-border p-6 rounded-3xl">
                                <p className="text-xs font-bold text-muted-foreground uppercase">Planos VIP Ativos</p>
                                <h3 className="text-3xl font-black mt-1 text-green-400">{stats.activePlans || 0}</h3>
                            </div>
                            <div className="bg-card border border-amber-500/30 p-6 rounded-3xl bg-gradient-to-br from-amber-500/5 to-transparent">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-amber-400 uppercase">Fila de Pagamentos</p>
                                    <span className="p-1 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-black">
                                        ALTA DEMANDA
                                    </span>
                                </div>
                                <h3 className="text-3xl font-black mt-1 text-amber-300">
                                    {pendingPaymentsCount} <span className="text-xs font-normal text-muted-foreground">em aguardo</span>
                                </h3>
                            </div>
                        </div>

                        {/* Quick Action Banner to payments */}
                        {pendingPaymentsCount > 0 && (
                            <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 animate-pulse">
                                        <Clock size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-foreground text-sm">
                                            Existem {pendingPaymentsCount} pedidos aguardando na fila de alta demanda
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            Você pode liberar os itens para os usuários com 1 clique.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveTab('payments')}
                                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 whitespace-nowrap self-start sm:self-auto"
                                >
                                    Ver Fila de Pagamentos →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'payments' && <AdminPayments />}
                {activeTab === 'users' && <AdminUsers users={users} refresh={fetchAdminData} />}
                {activeTab === 'store' && <AdminStore />}
                {activeTab === 'support' && <AdminSupport />}
                {activeTab === 'settings' && <AdminSettings />}
            </div>
        </div>
    );
}
