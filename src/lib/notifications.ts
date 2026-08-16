import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, addDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number | boolean;
  created_at: string;
  user_id?: string;
}

export const subscribeToNotifications = (
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void
) => {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, orderBy('created_at', 'desc'), limit(50));

  return onSnapshot(q, (snapshot) => {
    const notifs: AppNotification[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        title: data.title || '',
        message: data.message || '',
        type: data.type || 'system',
        is_read: data.is_read ? 1 : 0,
        created_at: data.created_at || new Date().toISOString(),
        user_id: userId
      };
    });
    onUpdate(notifs);
  }, (error) => {
    console.error('Error listening to notifications:', error);
  });
};

export const sendNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string = 'system'
) => {
  const notifRef = collection(db, 'users', userId, 'notifications');
  await addDoc(notifRef, {
    title,
    message,
    type,
    is_read: 0,
    created_at: new Date().toISOString()
  });
};

export const markAsRead = async (userId: string, notifId: string) => {
  const notifDocRef = doc(db, 'users', userId, 'notifications', notifId);
  await updateDoc(notifDocRef, { is_read: 1 });
};

export const markAllAsRead = async (userId: string) => {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, where('is_read', '==', 0));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { is_read: 1 });
  });
  await batch.commit();
};
