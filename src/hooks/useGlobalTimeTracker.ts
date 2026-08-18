import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showNotification } from '../context/NotificationContext';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export function useGlobalTimeTracker() {
  const { user } = useAuth();
  const lastActiveTimeRef = useRef<number>(Date.now());
  const lastTickTimeRef = useRef<number>(Date.now());
  const accumulatedSecondsRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const hasNotifiedResetRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user?.id || !auth.currentUser) return;

    // Track user interaction to keep activity timestamp fresh
    const handleUserActivity = () => {
      lastActiveTimeRef.current = Date.now();
      hasNotifiedResetRef.current = false;
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((ev) => {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    });

    // Check if initial reset is needed on mount
    const checkInitialInactivity = async () => {
      try {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const missionsProgress = userData?.missions_progress || {};
        const now = Date.now();
        let shouldReset = false;
        const updatedMissions = { ...missionsProgress };

        for (const key of ['likes', 'reels', 'follows', 'time']) {
          const m = updatedMissions[key];
          if (m && m.updated_at && (m.progress > 0 || (m.progress_seconds && m.progress_seconds > 0))) {
            const lastUpdated = new Date(m.updated_at).getTime();
            if (now - lastUpdated > INACTIVITY_TIMEOUT_MS) {
              updatedMissions[key] = {
                ...m,
                progress: 0,
                progress_seconds: 0,
                updated_at: new Date().toISOString()
              };
              shouldReset = true;
            }
          }
        }

        if (shouldReset) {
          await updateDoc(userRef, { missions_progress: updatedMissions });
          showNotification.info('Progresso do nível reiniciado por inatividade (15 min). Seus níveis e recompensas resgatadas continuam seguros!');
        }
      } catch (err) {
        console.error('Error checking initial inactivity:', err);
      }
    };

    checkInitialInactivity();

    lastTickTimeRef.current = Date.now();
    lastActiveTimeRef.current = Date.now();

    // Main ticker: runs every 1 second
    const interval = setInterval(async () => {
      const now = Date.now();
      const deltaMs = now - lastTickTimeRef.current;
      lastTickTimeRef.current = now;

      const timeSinceActive = now - lastActiveTimeRef.current;

      // If user has been inactive for > 15 minutes
      if (timeSinceActive > INACTIVITY_TIMEOUT_MS) {
        if (!hasNotifiedResetRef.current) {
          hasNotifiedResetRef.current = true;
          try {
            const userRef = doc(db, 'users', user.id);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const missionsProgress = userData?.missions_progress || {};
              let hasChanges = false;
              const resetMissions = { ...missionsProgress };

              for (const key of ['likes', 'reels', 'follows', 'time']) {
                const m = resetMissions[key];
                if (m && (m.progress > 0 || (m.progress_seconds && m.progress_seconds > 0))) {
                  resetMissions[key] = {
                    ...m,
                    progress: 0,
                    progress_seconds: 0,
                    updated_at: new Date().toISOString()
                  };
                  hasChanges = true;
                }
              }

              if (hasChanges) {
                await updateDoc(userRef, { missions_progress: resetMissions });
                showNotification.info('Missões reiniciadas após 15 minutos de inatividade. Foco total!');
              }
            }
          } catch (e) {
            console.error('Error handling inactivity timeout:', e);
          }
        }
        accumulatedSecondsRef.current = 0;
        return;
      }

      // User is active: accumulate time cleanly in seconds (capped to prevent huge leaps if suspended)
      const secondsPassed = Math.min(deltaMs / 1000, 5);
      accumulatedSecondsRef.current += secondsPassed;

      // Sync to Firebase every 5 seconds of active time
      if (accumulatedSecondsRef.current >= 5 && !isSyncingRef.current) {
        const secsToAdd = Math.floor(accumulatedSecondsRef.current);
        accumulatedSecondsRef.current -= secsToAdd;

        isSyncingRef.current = true;
        try {
          const userRef = doc(db, 'users', user.id);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const missionsProgress = userData?.missions_progress || {};
            const timeProg = missionsProgress['time'] || { level: 1, progress: 0, progress_seconds: 0 };

            const prevSecs = timeProg.progress_seconds !== undefined
              ? timeProg.progress_seconds
              : (timeProg.progress || 0) * 60;

            const newSecs = prevSecs + secsToAdd;
            timeProg.progress_seconds = newSecs;
            timeProg.progress = parseFloat((newSecs / 60).toFixed(2));
            timeProg.updated_at = new Date().toISOString();

            await updateDoc(userRef, {
              'missions_progress.time': timeProg
            });
          }
        } catch (err) {
          console.error('Error syncing time mission:', err);
        } finally {
          isSyncingRef.current = false;
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, handleUserActivity);
      });
      clearInterval(interval);
    };
  }, [user?.id]);
}
