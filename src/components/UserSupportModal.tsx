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
            const res = await fetch(import.meta.env.BASE_URL + 'api/support');
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
            const res = await fetch(`$\{import.meta.env.BASE_URL\}api/support/${id}/chat`);
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
            const res = await fetch(import.meta.env.BASE_URL + 'api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc }) });
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
        await fetch(`$\{import.meta.env.BASE_URL\}api/support/${request.id}/chat`, {
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
                await fetch(`$\{import.meta.env.BASE_URL\}api/support/${request.id}/chat`, {
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-card w-full max-w-lg h-[80vh] border border-border shadow-2xl rounded-3xl flex flex-col relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-border bg-secondary/50 flex justify-between items-center z-10 w-full relative shrink-0">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="text-primary" />
                            <h2 className="font-bold text-lg">Central de Suporte</h2>
                        </div>
                        <button onClick={onClose} className="p-2 bg-secondary rounded-full hover:bg-secondary/80">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col relative top-0 z-0">
                        {!request ? (
                            <div className="p-6 flex flex-col gap-4 h-full relative z-0">
                                <p className="text-muted-foreground text-sm">Precisando de ajuda? Descreva seu problema abaixo e vamos te conectar com um de nossos administradores em tempo real.</p>
                                <textarea className="w-full bg-secondary/50 border border-border rounded-xl p-4 text-sm h-32 resize-none custom-scrollbar focus:ring-2 focus:ring-primary outline-none text-foreground z-10 relative" placeholder="Descreva o que está acontecendo..." value={desc} onChange={e => setDesc(e.target.value)} />
                                <Button disabled={loading || !desc.trim()} onClick={handleCreate} className="mt-auto">Solicitar Suporte</Button>
                            </div>
                        ) : request.status === 'pending' ? (
                            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4 relative z-0">
                                <div className="w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                                    <MessageSquare size={32} />
                                </div>
                                <h3 className="text-xl font-bold">Na Fila...</h3>
                                <p className="text-sm text-muted-foreground">Sua solicitação enviada foi encaminhada para a moderação.<br/>Por favor, aguarde um administrador aceitar para iniciar o chat.</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden relative z-0">
                                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar relative z-0" ref={listRef}>
                                    {messages.map((m, i) => {
                                        const isMine = m.sender_id === request.user_id;
                                        return (
                                            <div key={i} className={`flex flex-col max-w-[80%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
                                                <div className={`p-3 rounded-2xl text-sm overflow-hidden ${isMine ? 'bg-primary text-white rounded-tr-none' : 'bg-secondary text-foreground rounded-tl-none'}`}>
                                                    {m.image_url ? (
                                                        <img src={m.image_url} alt="Envio" className="max-w-[200px] rounded-lg mb-2" />
                                                    ) : null}
                                                    {m.message}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-1 px-1">{new Date(m.created_at).toLocaleTimeString().substring(0,5)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-3 bg-secondary/30 border-t border-border flex gap-2 items-center relative z-0">
                                    <button onClick={handleImageUpload} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                                        <ImageIcon size={20} />
                                    </button>
                                    <Input className="flex-1" placeholder="Digite uma mensagem..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                                    <Button onClick={handleSend} className="px-3" size="sm">
                                        <Send size={16} />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
