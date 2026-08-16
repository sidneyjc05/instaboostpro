import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeToNotifications,
  markAsRead as firestoreMarkAsRead,
  markAllAsRead as firestoreMarkAllAsRead,
  type AppNotification
} from '../lib/notifications';

export type { AppNotification };

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  getUnreadCountByModule: (module: string) => number;
  markAsRead: (id: string | number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  requestPushPermission: () => Promise<void>;
}

const GlobalNotificationContext = createContext<NotificationContextProps>({} as any);

export const GlobalNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(window.Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const unsubscribe = subscribeToNotifications(String(user.id), (data) => {
      setNotifications((prev) => {
        const currentIds = new Set(prev.map((n) => String(n.id)));
        const newUnread = data.filter((n) => !currentIds.has(String(n.id)) && !n.is_read);

        newUnread.forEach((n) => {
          if (pushPermission === 'granted') {
            try {
              new window.Notification(n.title, { body: n.message, icon: '/vite.svg' });
            } catch {}
          }
        });

        return data;
      });
    });

    return () => unsubscribe();
  }, [user?.id, pushPermission]);

  const getUnreadCountByModule = (module: string) => {
    return notifications.filter((n) => !n.is_read && n.type === module).length;
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const requestPushPermission = async () => {
    try {
      if ('Notification' in window && window.self === window.top) {
        const perm = await window.Notification.requestPermission();
        setPushPermission(perm);
      }
    } catch (e) {
      console.error('Browser push notifications not supported in this context.', e);
    }
  };

  const markAsRead = async (id: string | number) => {
    if (!user?.id) return;
    try {
      await firestoreMarkAsRead(String(user.id), String(id));
      setNotifications((prev) =>
        prev.map((n) => (String(n.id) === String(id) ? { ...n, is_read: 1 } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await firestoreMarkAllAsRead(String(user.id));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <GlobalNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        getUnreadCountByModule,
        markAsRead,
        markAllAsRead,
        requestPushPermission
      }}
    >
      {children}
    </GlobalNotificationContext.Provider>
  );
};

export const useGlobalNotifications = () => useContext(GlobalNotificationContext);
