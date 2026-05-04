import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';
import { Save, Zap } from 'lucide-react';
import { AnimatedIcon } from '../AnimatedIcon';

export default function AdminStore() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/store/config')
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'store_config',
                    value: JSON.stringify(config)
                })
            });
            if (res.ok) {
                showNotification.success('Loja atualizada com sucesso!');
            } else {
                showNotification.error('Erro ao atualizar loja');
            }
        } catch {
            showNotification.error('Erro de conexão');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (category: 'coins' | 'tickets', amount: string, value: string) => {
        setConfig((prev: any) => ({
            ...prev,
            [category]: {
                ...prev[category],
                [amount]: parseFloat(value) || 0
            }
        }));
    };

    const handlePlanChange = (planId: string, value: string) => {
        setConfig((prev: any) => ({
            ...prev,
            plans: {
                ...prev.plans,
                [planId]: parseFloat(value) || 0
            }
        }));
    };

    if (loading) return <div>Carregando configurações da loja...</div>;
    if (!config) return <div>Erro ao carregar loja</div>;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2">
                        <Zap className="text-yellow-500 fill-yellow-500" size={24} /> Centro de Promoções & Preços
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Configure o faturamento e as ofertas globais da sua plataforma.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="px-8 shadow-xl shadow-primary/20">
                    {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />} 
                    Salvar Arquitetura Comercial
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUMN 1: MOEDAS */}
                <div className="flex flex-col gap-6">
                    <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                <AnimatedIcon type="coin" size={20} />
                            </div>
                            <h3 className="font-black uppercase tracking-widest text-sm">Pacotes de Moedas</h3>
                        </div>
                        <div className="flex flex-col gap-4">
                            {Object.keys(config.coins).sort((a: any, b: any) => a - b).map(amount => (
                                <div key={amount} className="group flex justify-between items-center gap-4 bg-secondary/30 p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                                    <span className="font-bold text-sm w-24 flex items-center gap-2">
                                        {parseInt(amount).toLocaleString('pt-BR')}
                                    </span>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                        <Input 
                                            type="number"
                                            step="0.10"
                                            className="pl-8 bg-background/50 border-transparent group-hover:border-border transition-all"
                                            value={config.coins[amount]} 
                                            onChange={e => handleChange('coins', amount, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                <AnimatedIcon type="ticket" size={20} />
                            </div>
                            <h3 className="font-black uppercase tracking-widest text-sm">Pacotes de Tickets</h3>
                        </div>
                        <div className="flex flex-col gap-4">
                            {Object.keys(config.tickets).sort((a: any, b: any) => a - b).map(amount => (
                                <div key={amount} className="group flex justify-between items-center gap-4 bg-secondary/30 p-3 rounded-2xl hover:bg-secondary/50 transition-colors">
                                    <span className="font-bold text-sm w-24 flex items-center gap-2">
                                        {parseInt(amount).toLocaleString('pt-BR')}
                                    </span>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">R$</span>
                                        <Input 
                                            type="number"
                                            step="0.10"
                                            className="pl-8 bg-background/50 border-transparent group-hover:border-border transition-all"
                                            value={config.tickets[amount]} 
                                            onChange={e => handleChange('tickets', amount, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: PLANOS */}
                <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <AnimatedIcon type="diamond" size={20} />
                        </div>
                        <h3 className="font-black uppercase tracking-widest text-sm">Assinaturas VIP</h3>
                    </div>
                    <div className="flex flex-col gap-6">
                        {['basic', 'pro', 'premium', 'ultra'].map(plan => (
                            <div key={plan} className="bg-secondary/30 p-5 rounded-[1.5rem] border border-transparent hover:border-border transition-all">
                                <span className="font-black text-xs uppercase tracking-tighter text-muted-foreground mb-3 block">{plan} tier</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">R$</span>
                                        <Input 
                                            type="number"
                                            step="1.00"
                                            className="pl-10 h-12 text-lg font-bold bg-background/50"
                                            value={config.plans[plan] !== undefined ? config.plans[plan] : (plan === 'basic' ? 0 : config.plans[plan])} 
                                            onChange={e => handlePlanChange(plan, e.target.value)}
                                        />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Mensal</p>
                                        <p className="text-xs font-black text-foreground">30 Dias</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                           <p className="text-xs text-primary font-bold flex items-center gap-2">
                              <Zap size={14} /> Dica de Admin
                           </p>
                           <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
                              Os planos oferecem multiplicadores automáticos de moedas. 
                              Use o Ultra como o "carro chefe" da sua loja para maior ROI.
                           </p>
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: PROMOÇÃO */}
                <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-[2.5rem] p-8 shadow-xl shadow-red-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Zap size={120} className="fill-red-500" />
                    </div>

                    <div className="relative z-10 flex flex-col gap-6">
                        <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
                            <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
                                <Zap size={24} className="fill-white" />
                            </div>
                            <div>
                                <h3 className="font-black uppercase tracking-tighter text-lg text-red-500">Evento de Promoção</h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Flash Sales & VIP Offers</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-5">
                            <label className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-red-500/10 cursor-pointer group hover:bg-background transition-colors shadow-sm">
                                <span className="text-sm font-black uppercase tracking-widest group-hover:text-red-500 transition-colors">Estado da Promoção</span>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={config.promo?.active || false}
                                        onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, active: e.target.checked } }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                </div>
                            </label>

                            {config.promo?.active && (
                                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-2">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Tipo</p>
                                            <select 
                                                className="w-full bg-background border border-border rounded-xl text-sm px-3 py-3 font-bold appearance-none hover:border-red-500 transition-colors"
                                                value={config.promo?.type || 'percent'}
                                                onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, type: e.target.value } }))}
                                            >
                                                <option value="percent">% Off</option>
                                                <option value="fixed">R$ Off</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Valor</p>
                                            <Input 
                                                type="number" 
                                                className="h-11 font-black text-lg bg-background"
                                                placeholder="Desconto" 
                                                value={config.promo?.value || 0}
                                                onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, value: parseFloat(e.target.value) || 0 } }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Expira em</p>
                                        <Input 
                                            type="datetime-local" 
                                            className="h-11 bg-background font-mono"
                                            value={config.promo?.expiresAt ? new Date(new Date(config.promo.expiresAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                            onChange={e => {
                                                if (!e.target.value) {
                                                    setConfig((p: any) => ({ ...p, promo: { ...p.promo, expiresAt: null } }));
                                                } else {
                                                    const d = new Date(e.target.value);
                                                    if (!isNaN(d.getTime())) {
                                                        setConfig((p: any) => ({ ...p, promo: { ...p.promo, expiresAt: d.toISOString() } }));
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="p-4 bg-background/50 rounded-2xl border border-red-500/10 flex flex-col gap-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-red-500">Filtrar Aplicabilidade</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={config.promo?.applyCoins ?? true}
                                                    onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, applyCoins: e.target.checked } }))}
                                                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 outline-none border-border"
                                                />
                                                <span className="text-xs font-bold">Moedas</span>
                                            </label>
                                            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={config.promo?.applyTickets ?? true}
                                                    onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, applyTickets: e.target.checked } }))}
                                                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 outline-none border-border"
                                                />
                                                <span className="text-xs font-bold">Tickets</span>
                                            </label>
                                        </div>

                                        <div className="border-t border-red-500/10 pt-3 flex flex-col gap-2">
                                            {['basic', 'pro', 'premium', 'ultra'].map(plan => (
                                                <label key={plan} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors capitalize">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={config.promo?.[`applyPlan${plan.charAt(0).toUpperCase() + plan.slice(1)}`] ?? true}
                                                        onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, [`applyPlan${plan.charAt(0).toUpperCase() + plan.slice(1)}`]: e.target.checked } }))}
                                                        className="w-4 h-4 rounded text-red-600 focus:ring-red-500 outline-none border-border"
                                                    />
                                                    <span className="text-xs font-bold">Plano {plan}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const Loader2 = ({ size, className }: any) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)
