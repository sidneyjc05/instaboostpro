import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { useGlobalNotifications } from '../context/GlobalNotificationContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export function NotificationsDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead, requestPushPermission } = useGlobalNotifications();

    useBodyScrollLock(isOpen);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative">
            <button onClick={toggleOpen} className="p-2 md:p-3 relative rounded-xl hover:bg-secondary text-purple-500 hover:scale-110 transition-transform">
                <Bell size={20} className="md:w-6 md:h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 md:top-2 md:right-2 flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-purple-500 text-white text-[9px] md:text-xs font-bold rounded-full shadow-[0_0_10px_rgba(168,85,247,0.6)] animate-[pulse_2s_ease-in-out_infinite]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && document.body && createPortal(
                <div className="relative z-[9999]">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md md:w-96 max-h-[80vh] overflow-y-auto border border-white/10 rounded-2xl shadow-2xl flex flex-col hidden-scrollbar origin-center animate-in fade-in zoom-in duration-200 backdrop-blur-2xl bg-black/80">
                        <div className="p-4 border-b border-white/10 sticky top-0 bg-black/60 flex items-center justify-between z-10 rounded-t-2xl backdrop-blur-md">
                            <h3 className="font-bold">Notificações</h3>
                            <div className="flex items-center gap-4">
                                {unreadCount > 0 && (
                                    <button onClick={markAllAsRead} className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
                                        <CheckCircle2 size={14} /> Marca lidas
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    Nenhuma notificação por aqui.
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif.id} 
                                        className={`p-4 border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors ${!notif.is_read ? 'bg-purple-500/10' : ''}`}
                                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={`font-semibold text-sm ${!notif.is_read ? 'text-purple-400' : 'text-foreground'}`}>{notif.title}</h4>
                                            {!notif.is_read && <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notif.message}</p>
                                        <span className="text-[10px] text-muted-foreground/60 mt-2 block">
                                            {new Date(notif.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
