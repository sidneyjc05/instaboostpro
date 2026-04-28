import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(10, 10, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#fff',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            padding: '16px 24px',
            fontWeight: 500,
          },
        }}
      />
      {children}
    </>
  );
};

export const showNotification = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  loading: (msg: string) => toast.loading(msg),
  info: (msg: string) => toast(msg),
};
