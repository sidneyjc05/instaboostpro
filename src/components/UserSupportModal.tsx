import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { showNotification } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export function UserSupportModal({ open, onClose }: { open: boolean, onClose: () => void }) {
    const [request, setRequest] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [desc, setDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    useBodyScrollLock(open);

    useEffect(() => {
        if (open) {
            loadReq();
        }
    }, [open]);

    const loadReq = async () => {
        try {
            const res = await fetch('/api/support');
            const data = await res.json();
            if (data.length > 0 && data[0].status !== 'closed') {
                setRequest(data[0]);
                fetchMsgs(data[0].id);
            } else {
                setRequest(null);
                setMessages([]);
            }
        } catch(e) {}
    };

    const fetchMsgs = async (id: number) => {
        try {
            const res = await fetch(`/api/support/${id}/chat`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                setTimeout(() => {
                    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
                }, 100);
            }
        } catch(e) {}
    };

    useEffect(() => {
        let int: any;
        if (open && request?.status === 'active') {
            int = setInterval(() => fetchMsgs(request.id), 3000);
        }
        return () => clearInterval(int);
    }, [open, request]);

    const handleCreate = async () => {
        if (!desc.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc }) });
            if (res.ok) {
                showNotification.success('Solicitação enviada. Um administrador irá te responder em breve.');
                loadReq();
            } else {
                const err = await res.json();
                showNotification.error(err.error || 'Erro ao criar solicitação');
            }
        } catch(e) {}
        setLoading(false);
    };

    const handleSend = async () => {
        if (!text.trim() || !request) return;
        await fetch(`/api/support/${request.id}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        setText('');
        fetchMsgs(request.id);
    };

    const handleImageUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result;
                await fetch(`/api/support/${request.id}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: '', image_url: base64 })
                });
                fetchMsgs(request.id);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                    exit={{ scale: 0.95, opacity: 0, y: 20 }} 
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-card w-full max-w-lg h-[90vh] md:h-[80vh] border border-border shadow-2xl rounded-t-3xl md:rounded-[2.5rem] mt-auto md:mt-0 flex flex-col relative overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center z-10 w-full relative shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                <MessageSquare size={24} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="font-bold text-lg leading-none">Central de Suporte</h2>
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Atendimento ao Cliente</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-secondary rounded-full hover:bg-secondary/80 hover:scale-110 transition-transform">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        {!request ? (
                            <div className="p-6 md:p-8 flex flex-col gap-6 h-full">
                                <div className="text-center mb-2">
                                    <h3 className="text-xl font-bold mb-1">Como podemos ajudar?</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed px-4">Descreva seu problema ou dúvida abaixo e nossa equipe entrará em contato em tempo real.</p>
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-1">Seu Problema</label>
                                    <textarea 
                                        className="w-full bg-secondary/50 border border-border/80 rounded-2xl p-5 text-sm h-48 resize-none custom-scrollbar focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" 
                                        placeholder="Ex: Não recebi minhas moedas após o pagamento..." 
                                        value={desc} 
                                        onChange={e => setDesc(e.target.value)} 
                                    />
                                </div>
                                <Button 
                                    disabled={loading || !desc.trim()} 
                                    onClick={handleCreate} 
                                    className="w-full h-16 rounded-2xl text-base font-bold shadow-xl shadow-primary/20"
                                >
                                    Abrir Chamado de Suporte
                                </Button>
                            </div>
                        ) : request.status === 'pending' ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center animate-pulse">
                                        <MessageSquare size={48} />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full border-4 border-card animate-bounce"></div>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black mb-2">Aguardando Suporte...</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed px-6">Sua solicitação foi encaminhada para nossos especialistas. <br/>Mantenha esta janela aberta; o chat iniciará automaticamente.</p>
                                </div>
                                <div className="w-full max-w-[200px] h-1.5 bg-secondary rounded-full overflow-hidden">
                                   <div className="h-full bg-yellow-500 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-transparent to-secondary/10">
                                <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 custom-scrollbar" ref={listRef}>
                                    <div className="text-center py-2 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 bg-secondary/50 px-3 py-1 rounded-full">Chat Iniciado</span>
                                    </div>
                                    {messages.map((m, i) => {
                                        const isMine = m.sender_id === request.user_id;
                                        return (
                                            <div key={i} className={`flex flex-col max-w-[85%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
                                                <div className={`p-4 rounded-[1.5rem] text-sm shadow-sm relative group overflow-hidden ${isMine ? 'bg-primary text-white rounded-tr-none' : 'bg-card border border-border text-foreground rounded-tl-none'}`}>
                                                    {m.image_url ? (
                                                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                                            <img src={m.image_url} alt="Envio" className="max-w-full h-auto" />
                                                        </div>
                                                    ) : null}
                                                    <span className="relative z-10">{m.message}</span>
                                                    {isMine && <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>}
                                                </div>
                                                <div className="text-[9px] font-bold text-muted-foreground/60 mt-1.5 px-2 flex items-center gap-1">
                                                    {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    {isMine && <span className="text-[8px]">✓✓</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-4 pt-2 bg-card border-t border-border flex gap-3 items-end">
                                    <button 
                                        onClick={handleImageUpload} 
                                        className="mb-1 p-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                        title="Enviar Imagem"
                                    >
                                        <ImageIcon size={20} />
                                    </button>
                                    <div className="flex-1 relative">
                                        <textarea 
                                            className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none max-h-32 min-h-[48px]" 
                                            placeholder="Mensagem..." 
                                            rows={1}
                                            value={text} 
                                            onChange={e => setText(e.target.value)} 
                                            onKeyDown={e => {
                                                if(e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }} 
                                        />
                                    </div>
                                    <button 
                                        onClick={handleSend} 
                                        disabled={!text.trim()}
                                        className="mb-1 p-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
