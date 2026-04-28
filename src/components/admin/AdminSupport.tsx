import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Check, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { showNotification } from '../../context/NotificationContext';

export function AdminSupport() {
    const [requests, setRequests] = useState<any[]>([]);
    const [selectedReq, setSelectedReq] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/admin/support');
            if (res.ok) setRequests(await res.json());
        } catch(e) {}
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchMessages = async (id: number) => {
        try {
            const res = await fetch(`/api/admin/support/${id}/chat`);
            if (res.ok) {
                setMessages(await res.json());
                setTimeout(() => {
                    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
                }, 100);
            }
        } catch(e) {}
    };

    useEffect(() => {
        let int: any;
        if (selectedReq) {
            fetchMessages(selectedReq.id);
            int = setInterval(() => fetchMessages(selectedReq.id), 3000);
        }
        return () => clearInterval(int);
    }, [selectedReq]);

    const handleAccept = async (id: number) => {
        await fetch(`/api/admin/support/${id}/accept`, { method: 'POST' });
        showNotification.success('Suporte aceito');
        fetchRequests();
    };

    const handleClose = async (id: number) => {
        await fetch(`/api/admin/support/${id}/close`, { method: 'POST' });
        showNotification.success('Suporte encerrado e mensagens apagadas');
        setSelectedReq(null);
        fetchRequests();
    };

    const handleSend = async () => {
        if (!text.trim()) return;
        await fetch(`/api/admin/support/${selectedReq.id}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        setText('');
        fetchMessages(selectedReq.id);
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
                await fetch(`/api/admin/support/${selectedReq.id}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: '', image_url: base64 })
                });
                fetchMessages(selectedReq.id);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[70vh]">
            <div className="w-full md:w-1/3 flex flex-col gap-4 bg-card border border-border p-4 rounded-3xl overflow-y-auto">
                <h3 className="font-bold flex items-center gap-2 mb-2"><MessageSquare size={18} /> Solicitações</h3>
                {requests.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma solicitação.</p>}
                {requests.map(r => (
                    <div key={r.id} onClick={() => setSelectedReq(r)} className={`p-4 rounded-2xl border cursor-pointer transition-colors ${selectedReq?.id === r.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:bg-secondary'}`}>
                        <div className="flex justify-between mb-2">
                            <span className="font-bold text-sm">@{r.username}</span>
                            <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold ${r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : r.status === 'active' ? 'bg-blue-500/20 text-blue-500' : 'bg-secondary text-muted-foreground'}`}>{r.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                        {r.status === 'pending' && (
                            <Button size="sm" className="w-full mt-3 h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleAccept(r.id); }}>Aceitar Suporte</Button>
                        )}
                    </div>
                ))}
            </div>

            <div className="w-full md:w-2/3 flex flex-col bg-card border border-border rounded-3xl overflow-hidden relative">
                {selectedReq ? (
                    <>
                        <div className="p-4 border-b border-border bg-secondary/30 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold">Chat com @{selectedReq.username}</h3>
                                <p className="text-xs text-muted-foreground">ID da solicitação: #{selectedReq.id}</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => handleClose(selectedReq.id)}><X size={16} className="mr-1"/> Encerrar</Button>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar" ref={listRef}>
                           {selectedReq.status === 'pending' ? (
                               <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                                   Aceite a solicitação para iniciar o chat.
                               </div>
                           ) : messages.length === 0 ? (
                               <div className="text-center text-muted-foreground text-xs mt-10">Envie a primeira mensagem.</div>
                           ) : messages.map((m, i) => {
                               const isAdmin = m.sender_id !== selectedReq.user_id;
                               return (
                                   <div key={i} className={`flex flex-col max-w-[70%] ${isAdmin ? 'self-start items-start' : 'self-end items-end'}`}>
                                       <div className={`p-3 rounded-2xl ${isAdmin ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30 rounded-tl-none' : 'bg-secondary border border-border rounded-tr-none'}`}>
                                           {m.image_url && <img src={m.image_url} alt="anexo" className="max-w-[200px] rounded-lg mb-2" />}\n                                            {m.message}
                                       </div>
                                       <div className="text-[10px] text-muted-foreground mt-1 px-1">{new Date(m.created_at).toLocaleTimeString().substring(0,5)}</div>
                                   </div>
                               );
                           })}
                        </div>
                        {selectedReq.status === 'active' && (
                            <div className="p-3 bg-secondary/50 border-t border-border flex gap-2 items-center">
                                <button onClick={handleImageUpload} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                                    <ImageIcon size={20} />
                                </button>
                                <Input className="flex-1" placeholder="Digite uma mensagem..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                                <Button onClick={handleSend}>Enviar</Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        Selecione uma solicitação para visualizar.
                    </div>
                )}
            </div>
        </div>
    );
}
