import { useEffect } from 'react';

let lockCount = 0;

export function useBodyScrollLock(isLocked: boolean) {
    useEffect(() => {
        if (isLocked) {
            if (lockCount === 0) {
                document.body.style.overflow = 'hidden';
            }
            lockCount++;
        }
        
        return () => {
            if (isLocked) {
                lockCount--;
                if (lockCount === 0) {
                    document.body.style.overflow = '';
                }
            }
        };
    }, [isLocked]);
}
