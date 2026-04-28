import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface AppNotification {
    id: number;
    title: string;
    message: string;
    type: string;
    is_read: number;
    created_at: string;
}

interface NotificationContextProps {
    notifications: AppNotification[];
    unreadCount: number;
    getUnreadCountByModule: (module: string) => number;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    requestPushPermission: () => Promise<void>;
}

const GlobalNotificationContext = createContext<NotificationContextProps>({} as any);

export const GlobalNotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                
                setNotifications(prev => {
                    const currentIds = new Set(prev.map(n => n.id));
                    const newUnread = data.filter((n: AppNotification) => !currentIds.has(n.id) && !n.is_read);
                    
                    newUnread.forEach((n: AppNotification) => {
                        if (pushPermission === 'granted') {
                            new window.Notification(n.title, { body: n.message, icon: '/vite.svg' });
                        }
                    });

                    return data;
                });
            }
        } catch (e) {}
    };

    useEffect(() => {
        if ('Notification' in window) {
            setPushPermission(window.Notification.permission);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, [user, pushPermission]); // Re-bind interval if user/permission changes

    const getUnreadCountByModule = (module: string) => {
        return notifications.filter(n => !n.is_read && n.type === module).length;
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const requestPushPermission = async () => {
        try {
            if ('Notification' in window && window.self === window.top) {
                const perm = await window.Notification.requestPermission();
                setPushPermission(perm);
            }
        } catch (e) {
            console.error("Browser push notifications not supported in this context.", e);
        }
    };

    const markAsRead = async (id: number) => {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        } catch (e) {}
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications/read-all', { method: 'POST' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (e) {}
    };

    return (
        <GlobalNotificationContext.Provider value={{
            notifications,
            unreadCount,
            getUnreadCountByModule,
            markAsRead,
            markAllAsRead,
            requestPushPermission
        }}>
            {children}
        </GlobalNotificationContext.Provider>
    );
};

export const useGlobalNotifications = () => useContext(GlobalNotificationContext);
