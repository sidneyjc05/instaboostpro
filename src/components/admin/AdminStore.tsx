import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';
import { Save } from 'lucide-react';

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
        <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold flex items-center justify-between">
                Gerenciar Preços da Loja
                <Button onClick={handleSave} disabled={saving}>
                    <Save size={16} className="mr-2" /> Salvar Alterações
                </Button>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-2xl p-4">
                    <h3 className="font-bold mb-4">Pacotes de Moedas</h3>
                    <div className="flex flex-col gap-3">
                        {Object.keys(config.coins).sort((a: any, b: any) => a - b).map(amount => (
                            <div key={amount} className="flex justify-between items-center gap-4">
                                <span className="font-mono text-sm w-16">{amount} 💰</span>
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                    <Input 
                                        type="number"
                                        step="0.10"
                                        className="pl-9"
                                        value={config.coins[amount]} 
                                        onChange={e => handleChange('coins', amount, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4">
                    <h3 className="font-bold mb-4">Pacotes de Tickets</h3>
                    <div className="flex flex-col gap-3">
                        {Object.keys(config.tickets).sort((a: any, b: any) => a - b).map(amount => (
                            <div key={amount} className="flex justify-between items-center gap-4">
                                <span className="font-mono text-sm w-16">{amount} 🎟️</span>
                                <div className="flex-1 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                    <Input 
                                        type="number"
                                        step="0.10"
                                        className="pl-9"
                                        value={config.tickets[amount]} 
                                        onChange={e => handleChange('tickets', amount, e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-6">
                    <div>
                        <h3 className="font-bold mb-4">Assinaturas (Planos)</h3>
                        <div className="flex flex-col gap-3">
                            {['pro', 'premium', 'ultra'].map(plan => (
                                <div key={plan} className="flex justify-between items-center gap-4">
                                    <span className="font-bold text-sm w-20 capitalize">{plan}</span>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                        <Input 
                                            type="number"
                                            step="0.50"
                                            className="pl-9"
                                            value={config.plans[plan] || 0} 
                                            onChange={e => handlePlanChange(plan, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-border pt-4">
                        <h3 className="font-bold mb-4">Promoção Relâmpago global</h3>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={config.promo?.active || false}
                                    onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, active: e.target.checked } }))}
                                    className="rounded border-border bg-secondary"
                                />
                                <span className="text-sm font-medium">Ativar Promoção VIP</span>
                            </label>

                            {config.promo?.active && (
                                <>
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-full bg-secondary border border-border rounded-lg text-sm px-3 py-2"
                                            value={config.promo?.type || 'percent'}
                                            onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, type: e.target.value } }))}
                                        >
                                            <option value="percent">Desconto em %</option>
                                            <option value="fixed">Desconto Fixo (R$)</option>
                                        </select>
                                    </div>
                                    <Input 
                                        type="number" 
                                        placeholder="Valor do desconto" 
                                        value={config.promo?.value || 0}
                                        onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, value: parseFloat(e.target.value) || 0 } }))}
                                    />
                                    <Input 
                                        type="datetime-local" 
                                        value={config.promo?.expiresAt ? new Date(config.promo.expiresAt).toISOString().slice(0, 16) : ''}
                                        onChange={e => setConfig((p: any) => ({ ...p, promo: { ...p.promo, expiresAt: e.target.value } }))}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
