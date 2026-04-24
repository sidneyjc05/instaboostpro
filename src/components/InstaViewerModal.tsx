import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, UserPlus, Play, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';

interface InstaViewerProps {
  open: boolean;
  onClose: () => void;
  url: string;
  type: 'post' | 'profile' | 'reel';
  username: string;
  onInteract: () => void;
  title?: string;
  missionProgress?: { current: number; goal: number };
}

export function InstaViewerModal({ open, onClose, url, type, username, onInteract, title = "Conteúdo para assistir", missionProgress }: InstaViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchedSecs, setWatchedSecs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const REQUIRED_SECS = 12;

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setWatchedSecs(0);
      setCompleted(false);
      return;
    }
    
    // Auto-complete if it's a profile, as you just follow them.
    if (type === 'profile') {
        setCompleted(true);
    }
  }, [open, type]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && open && !completed && type !== 'profile') {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
           setWatchedSecs(prev => {
             if (prev >= REQUIRED_SECS - 1) {
                setCompleted(true);
                return REQUIRED_SECS;
             }
             return prev + 1;
           });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isPlaying, open, completed, type]);

  if (!open) return null;

  const cleanUrl = url.split('?')[0].replace(/\/$/, "");
  const profileUser = username || 'usuario';

  const handleActionClick = (actionType: 'like' | 'follow') => {
      // Allow interaction if completed, or just process it
      if (completed) {
         onInteract();
      } else if (type === 'profile') {
         onInteract();
      }
      window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-sm bg-gradient-to-br from-[#1a0033] to-[#2a004d] rounded-[24px] shadow-2xl shadow-purple-900/50 border border-purple-500/20 overflow-hidden flex flex-col relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/20 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5">
                <div className="w-full h-full bg-[#1a0033] rounded-full flex items-center justify-center text-sm font-bold uppercase text-white shadow-inner">
                  {profileUser.charAt(0)}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm">@{profileUser}</span>
                <span className="text-xs text-purple-300/80">{title}</span>
              </div>
            </div>
            <button 
               onClick={onClose}
               className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Player Area */}
          <div className="w-full relative bg-black flex items-center justify-center min-h-[400px]">
             {type === 'profile' ? (
                <div className="w-full h-[400px] flex flex-col items-center justify-center gap-4 text-center p-6 bg-gradient-to-b from-[#1a0033] to-black">
                   <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-1 mb-2">
                       <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center text-4xl font-bold uppercase text-white">
                          {profileUser.charAt(0)}
                       </div>
                    </div>
                    <h3 className="font-bold text-xl text-white">@{profileUser}</h3>
                    <p className="text-sm text-zinc-400">Visite e siga este perfil para completar a ação.</p>
                </div>
             ) : (
                !isPlaying ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    <button 
                       onClick={() => setIsPlaying(true)}
                       className="group relative w-16 h-16 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-all backdrop-blur-md"
                    >
                       <Play size={32} className="text-white ml-2 drop-shadow-md group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-[450px] relative pointer-events-none">
                     {/* Lock interaction inside iframe so we only use our buttons */}
                     <div className="absolute inset-0 z-10 hidden"></div>
                     <iframe 
                       src={`${cleanUrl}/embed`} 
                       className="w-full h-[500px] -mt-12 bg-white" 
                       frameBorder="0" 
                       scrolling="no" 
                       allowtransparency="true"
                     ></iframe>
                  </div>
                )
             )}

             {/* Timer Overlay */}
             {isPlaying && !completed && type !== 'profile' && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                   <div className="w-4 h-4 text-purple-400 animate-pulse"><Play size={16} /></div>
                   <span className="text-white text-xs font-bold font-mono">
                      {Math.max(0, REQUIRED_SECS - watchedSecs)}s
                   </span>
                </div>
             )}

             {completed && type !== 'profile' && (
                <div className="absolute top-4 right-4 bg-emerald-500/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-400/50 flex items-center gap-2">
                   <CheckCircle2 size={16} className="text-white" />
                   <span className="text-white text-xs font-bold">Assistido ✓</span>
                </div>
             )}
          </div>

          {/* Action Area */}
          <div className="p-5 flex flex-col gap-4 bg-black/20">
             
             {/* Progress Bar (Overall Mission) */}
             {missionProgress && (
                <div className="w-full flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="flex flex-col flex-1 mr-4">
                      <div className="flex justify-between items-end mb-1.5">
                         <span className="text-xs text-white/70 font-medium">Progresso da Missão</span>
                         <span className="text-xs font-bold text-white shadow-sm">{missionProgress.current} / {missionProgress.goal}</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                           style={{ width: `${Math.min(100, (missionProgress.current / missionProgress.goal) * 100)}%` }}
                         />
                      </div>
                   </div>
                </div>
             )}

             <div className="flex gap-3">
                <Button 
                   onClick={() => handleActionClick('like')}
                   className={`flex-1 font-bold text-white shadow-lg border-none py-6 transition-all ${completed ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 hover:scale-[1.02]' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                   disabled={!completed && type !== 'profile'}
                >
                   <Heart size={20} className={completed ? "text-white mr-2" : "text-zinc-500 mr-2"} /> Curtir
                </Button>
                <Button 
                   onClick={() => handleActionClick('follow')}
                   className={`flex-1 font-bold text-white shadow-lg border-none py-6 transition-all ${completed || type === 'profile' ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 hover:scale-[1.02]' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                   disabled={!completed && type !== 'profile'}
                >
                   <UserPlus size={20} className={completed || type === 'profile' ? "text-white mr-2" : "text-zinc-500 mr-2"} /> Seguir
                </Button>
             </div>
             
             {type !== 'profile' && !completed && (
                <p className="text-center text-[10px] text-white/40 uppercase tracking-widest font-bold">
                   Assista {REQUIRED_SECS}s para liberar
                </p>
             )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
