import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-text)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
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
};
