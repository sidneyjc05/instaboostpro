import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Download, Upload, AlertTriangle, BugOff, Activity, Sprout } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';

export function AdminSettings() {
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [cleanResults, setCleanResults] = useState<string[]>([]);
    const [cleanTotal, setCleanTotal] = useState<number | null>(null);

    const loadSettings = async () => {
        try {
            const res = await fetch(import.meta.env.BASE_URL + 'api/admin/settings');
            if (res.ok) setSettings(await res.json());
        } catch(e) {}
    };

    useEffect(() => { loadSettings(); }, []);

    const updateSetting = async (key: string, value: string) => {
        setLoading(true);
        try {
            await fetch(import.meta.env.BASE_URL + 'api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            showNotification.success('Configuração salva');
            loadSettings();
        } catch(e) {
            showNotification.error('Erro ao salvar');
        }
        setLoading(false);
    };

    const handleBackupExport = async () => {
        try {
            const res = await fetch(import.meta.env.BASE_URL + 'api/admin/backup');
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `instaboost_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch(e) {
            showNotification.error('Erro ao exportar backup');
        }
    };

    const handleBackupImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm('ATENÇÃO: Importar este backup apagará DE MANEIRA IRREVERSÍVEL todos os usuários, pagamentos e configurações atuais. Têm certeza disso?')) return;

            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const json = JSON.parse(reader.result as string);
                    const res = await fetch(import.meta.env.BASE_URL + 'api/admin/backup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(json)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showNotification.success('Backup importado com sucesso!');
                        setTimeout(() => window.location.reload(), 2000);
                    } else {
                        showNotification.error(data.error || 'Erro ao importar');
                    }
                } catch(err) {
                    showNotification.error('JSON inválido ou corrompido.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleCleanup = async () => {
        setCleaning(true);
        setCleanResults([]);
        setCleanTotal(null);
        showNotification.info('Iniciando varredura inteligente do sistema...');
        
        try {
            const res = await fetch(import.meta.env.BASE_URL + 'api/admin/system/cleanup', {
                method: 'POST'
            });
            const data = await res.json();
            
            // Add a visual delay to let the progress bar be seen
            await new Promise(r => setTimeout(r, 2000));

            if (res.ok) {
                // Simulate progressive reveal for UX
                setCleanTotal(data.total_deleted);
                let currentStep = 0;
                const interval = setInterval(() => {
                    if (currentStep < data.results.length) {
                        setCleanResults(prev => [...prev, data.results[currentStep]]);
                        currentStep++;
                    } else {
                        clearInterval(interval);
                        setCleaning(false);
                        if (data.total_deleted > 0) {
                            showNotification.success(`Limpeza concluída! ${data.total_deleted} registros desnecessários removidos.`);
                        } else {
                            showNotification.success('O sistema já está limpo e otimizado!');
                        }
                    }
                }, 800); // 800ms between showing logs
            } else {
                setCleaning(false);
                showNotification.error(data.error || 'Erro ao executar a limpeza');
            }
        } catch (e) {
            setCleaning(false);
            showNotification.error('Falha de conexão com o servidor');
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="bg-card border border-border p-6 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <BugOff size={120} />
                </div>
                
                <h2 className="text-xl font-black flex items-center gap-2 mb-2 text-green-500">
                    <Sprout /> IA de Otimização e Limpeza
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-xl">
                    Utilize a varredura inteligente para limpar o banco de dados. O sistema remove com segurança registros desnecessários como solicitações antigas, notificações expiradas e logs de login.
                </p>
                
                <Button 
                    onClick={handleCleanup} 
                    disabled={cleaning}
                    className={`flex gap-2 items-center px-6 py-5 rounded-2xl w-full sm:w-auto ${cleaning ? 'bg-green-500 hover:bg-green-600' : 'bg-background border-2 border-green-500/20 text-green-500 hover:bg-green-500/10'}`}
                >
                    {cleaning ? (
                        <>
                            <Activity className="animate-pulse" size={24} />
                        <span className="font-bold">Realizando varredura inteligente...</span>
                        </>
                    ) : (
                        <>
                            <BugOff size={24} />
                        <span className="font-bold">Iniciar Varredura Profunda</span>
                        </>
                    )}
                </Button>

                {(cleanResults.length > 0 || cleaning) && (
                    <div className="mt-6 p-4 bg-black/40 rounded-2xl font-mono text-xs border border-border">
                        {cleaning && (
                            <div className="mb-4">
                                <style>{`
                                    @keyframes scanline {
                                        0% { transform: translateX(-100%); }
                                        100% { transform: translateX(250%); }
                                    }
                                `}</style>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-green-500 font-bold">Progresso da Varredura</span>
                                    <span className="text-green-500 font-bold animate-pulse">Analisando...</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-2 relative overflow-hidden">
                                    <div className="absolute top-0 bottom-0 h-full w-1/2 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,1)] rounded-full" style={{ animation: 'scanline 1.5s linear infinite' }}></div>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            {cleanResults.map((result, i) => (
                                <div key={i} className="text-green-400 animate-in fade-in slide-in-from-left-2 duration-300">
                                    {result}
                                </div>
                            ))}
                            {cleaning && (
                                <div className="text-muted-foreground animate-pulse mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Varrendo tabelas de sistema...
                                </div>
                            )}
                            {!cleaning && cleanTotal !== null && (
                                <div className="mt-4 pt-4 border-t border-white/5 text-center text-sm font-bold text-green-500">
                                    Varredura Finalizada. {cleanTotal > 0 ? `${cleanTotal} Lixos Removidos.` : 'Nenhum lixo encontrado.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl">
                <h2 className="text-xl font-bold flex items-center gap-2 text-yellow-500 mb-6">
                    <AlertTriangle /> Modo Manutenção
                </h2>
                
                <div className="flex flex-col gap-4 max-w-md">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-muted-foreground">Status da Manutenção</label>
                        <select className="bg-secondary border border-border rounded-lg p-3" value={settings.maintenance_mode || 'off'} onChange={e => updateSetting('maintenance_mode', e.target.value)}>
                            <option value="off">Desligado (App Funcionando)</option>
                            <option value="on">Ligado (App Bloqueado)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-muted-foreground">Mensagem Personalizada</label>
                        <Input placeholder="Estamos em manutenção, voltamos em breve..." value={settings.maintenance_message || ''} onChange={e => setSettings({...settings, maintenance_message: e.target.value})} onBlur={e => updateSetting('maintenance_message', e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-muted-foreground">Previsão de Volta (Opcional)</label>
                        <Input type="datetime-local" value={settings.maintenance_end || ''} onChange={e => setSettings({...settings, maintenance_end: e.target.value})} onBlur={e => updateSetting('maintenance_end', e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                    <ShieldAlert /> Backup e Exportação
                </h2>
                <div className="flex gap-4">
                    <Button onClick={handleBackupExport} className="flex gap-2">
                        <Download size={18} /> Exportar JSON Completo
                    </Button>
                    <Button variant="outline" className="flex gap-2 text-red-500 hover:bg-red-500/10 border-red-500/50" onClick={handleBackupImport}>
                        <Upload size={18} /> Restaurar Backup
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    Atenção: Restaurar um backup (Importar) irá sobrescrever os dados atuais do aplicativo. Utilize com extrema cautela.
                </p>
            </div>
        </div>
    );
}

