import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, UserPlus, Play, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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

  useBodyScrollLock(open);

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

  let embedUrl = url.split('?')[0].replace(/\/$/, "");

  const profileUser = username || 'usuario';

  const handleActionClick = (actionType: 'like' | 'follow' | 'watch') => {
      // Allow interaction if completed, or just process it
      if (completed || type === 'profile') {
         onInteract();
      }
      
      if (actionType !== 'watch') {
         window.open(url, '_blank', 'noopener,noreferrer');
      }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full sm:max-w-md bg-gradient-to-br from-[#1a0033] to-[#2a004d] rounded-t-3xl md:rounded-[2.5rem] mt-auto md:mt-0 shadow-2xl shadow-purple-900/50 border border-purple-500/30 overflow-hidden flex flex-col relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-black/20 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5 shadow-lg">
                  <div className="w-full h-full bg-[#1a0033] rounded-[0.9rem] flex items-center justify-center text-base font-black uppercase text-white shadow-inner">
                    {profileUser.charAt(0)}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-white text-sm tracking-tight">@{profileUser}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-purple-300/60">{title}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all hover:scale-110 active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* Player Area */}
            <div className="w-full relative bg-black flex items-center justify-center min-h-[400px]">
               {type === 'profile' ? (
                  <div className="w-full h-[400px] flex flex-col items-center justify-center gap-6 text-center p-6 md:p-8 bg-gradient-to-b from-[#1a0033] to-black">
                     <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-1.5 shadow-2xl animate-[spin_8s_linear_infinite]">
                            <div className="w-full h-full bg-zinc-900 rounded-full"></div>
                        </div>
                        <div className="absolute inset-1.5 bg-zinc-900 rounded-full flex items-center justify-center text-5xl font-black uppercase text-white tracking-tighter">
                           {profileUser.charAt(0)}
                        </div>
                     </div>
                     <div>
                        <h3 className="font-black text-2xl text-white tracking-tight">@{profileUser}</h3>
                        <p className="text-sm text-zinc-400 mt-2 px-4 leading-relaxed font-medium">Siga este perfil no Instagram para desbloquear sua recompensa instantânea.</p>
                     </div>
                  </div>
               ) : (
                  !isPlaying ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm group cursor-pointer" onClick={() => setIsPlaying(true)}>
                       <div className="relative">
                          <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl group-hover:bg-white/40 transition-all duration-500"></div>
                          <div className="relative w-20 h-20 flex items-center justify-center rounded-[2rem] bg-white/10 group-hover:bg-white/20 border border-white/20 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                             <Play size={40} className="text-white ml-2 fill-current" />
                          </div>
                       </div>
                       <span className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-white/80 transition-colors">Tocar para Assistir</span>
                    </div>
                  ) : (
                    <div className="w-full h-[450px] relative pointer-events-none">
                       <iframe 
                         src={`${embedUrl}/embed/`} 
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
                  <div className="absolute top-6 right-6 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl">
                     <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                     <span className="text-white text-sm font-black font-mono tracking-tighter">
                        {Math.max(0, REQUIRED_SECS - watchedSecs)}s RESTANTES
                     </span>
                  </div>
               )}

               {completed && type !== 'profile' && (
                  <div className="absolute top-6 right-6 bg-emerald-500/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-emerald-400/50 flex items-center gap-3 shadow-2xl animate-in zoom-in-50 duration-300">
                     <CheckCircle2 size={18} className="text-white" />
                     <span className="text-white text-xs font-black uppercase tracking-widest">Concluído</span>
                  </div>
               )}
            </div>

            {/* Action Area */}
            <div className="p-6 flex flex-col gap-5 bg-black/40 border-t border-white/5">
               
               {/* Progress Bar (Overall Mission) */}
               {missionProgress && (
                  <div className="w-full flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                     <div className="flex flex-col flex-1 mr-4">
                        <div className="flex justify-between items-end mb-2">
                           <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Missão Atual</span>
                           <span className="text-xs font-black text-white">{missionProgress.current} <span className="text-white/40">/</span> {missionProgress.goal}</span>
                        </div>
                        <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${Math.min(100, (missionProgress.current / missionProgress.goal) * 100)}%` }}
                             className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full relative"
                           >
                              <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                           </motion.div>
                        </div>
                     </div>
                  </div>
               )}

               <div className="flex gap-4">
                  {type === 'reel' && (
                     <Button 
                        onClick={() => handleActionClick('watch')}
                        className={`flex-1 h-16 font-black text-base shadow-xl border-none transition-all rounded-2xl ${completed ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:scale-[1.02] shadow-emerald-500/20 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'}`}
                        disabled={!completed}
                     >
                        <CheckCircle2 size={24} className="mr-3" /> CONFIRMAR AÇÃO
                     </Button>
                  )}
                  {type === 'post' && (
                     <Button 
                        onClick={() => handleActionClick('like')}
                        className={`flex-1 h-16 font-black text-base shadow-xl border-none transition-all rounded-2xl ${completed ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:scale-[1.02] shadow-red-500/20 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'}`}
                        disabled={!completed}
                     >
                        <Heart size={24} className="mr-3 fill-current" /> CURTIR E CONFIRMAR
                     </Button>
                  )}
                  {type === 'profile' && (
                     <Button 
                        onClick={() => handleActionClick('follow')}
                        className={`flex-1 h-16 font-black text-base shadow-xl border-none transition-all rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:scale-[1.02] shadow-emerald-500/20 text-white`}
                     >
                        <UserPlus size={24} className="mr-3" /> SEGUIR E CONFIRMAR
                     </Button>
                  )}
               </div>
               
               {type !== 'profile' && !completed && (
                  <div className="flex items-center justify-center gap-2">
                     <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                     <p className="text-center text-[10px] text-white/30 uppercase font-black tracking-[0.3em]">
                        Segurança Anti-Bot Ativa
                     </p>
                     <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                  </div>
               )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
