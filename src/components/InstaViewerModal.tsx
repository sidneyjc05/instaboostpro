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
  const [hasInteracted, setHasInteracted] = useState(false);
  const REQUIRED_SECS = 5;

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setWatchedSecs(0);
      setCompleted(false);
      setHasInteracted(false);
      return;
    }
    
    if (type === 'profile' || type === 'post') {
        setIsPlaying(true);
        setHasInteracted(true);
    }
  }, [open, type]);

  useEffect(() => {
    const handleBlur = () => {
       setTimeout(() => {
          if (document.activeElement?.tagName === 'IFRAME') {
             setHasInteracted(true);
             setIsPlaying(true);
          }
       }, 50);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
          setWatchedSecs(0);
          setIsPlaying(false);
          setHasInteracted(false);
       } else if (document.visibilityState === 'visible') {
          if (type === 'profile' || type === 'post') {
             setIsPlaying(true);
             setHasInteracted(true);
          }
       }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [type]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && open && !completed) {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible' && hasInteracted) {
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
  }, [isPlaying, open, completed, type, hasInteracted, REQUIRED_SECS]);

  const formatTime = (secs: number) => {
     const m = Math.floor(secs / 60);
     const s = secs % 60;
     return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
      <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden flex items-center justify-center p-4 custom-scrollbar">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-sm bg-gradient-to-br from-[#1a0033] to-[#2a004d] rounded-[24px] shadow-2xl shadow-purple-900/50 border border-purple-500/20 overflow-hidden flex flex-col my-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-background border-b border-white/5">
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
          <div className="w-full relative bg-background flex items-center justify-center min-h-[400px]">
             {type === 'profile' ? (
                <div className="w-full h-[400px] flex flex-col items-center justify-center gap-4 text-center p-6 bg-gradient-to-b from-[#1a0033] to-black relative">
                   <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-1 mb-2">
                       <div className="w-full h-full bg-card rounded-full flex items-center justify-center text-4xl font-bold uppercase text-white">
                          {profileUser.charAt(0)}
                       </div>
                    </div>
                    <h3 className="font-bold text-xl text-white">@{profileUser}</h3>
                    <p className="text-sm text-zinc-400">Visite e siga este perfil para completar a ação.</p>
                    
                    {/* Timer Overlay for Profile */}
                    {isPlaying && !completed && (
                       <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2 pointer-events-none z-30">
                          <div className="w-4 h-4 text-purple-400 animate-pulse"><Play size={16} /></div>
                          <span className="text-white text-xs font-bold font-mono">
                             {formatTime(Math.max(0, REQUIRED_SECS - watchedSecs))}
                          </span>
                       </div>
                    )}
                    {completed && (
                       <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-400/50 flex items-center gap-2 pointer-events-none z-30 shadow-lg shadow-emerald-500/20">
                          <CheckCircle2 size={16} className="text-white" />
                          <span className="text-white text-xs font-bold">Concluído ✓</span>
                       </div>
                    )}
                    {!completed && (
                      <div className="absolute bottom-0 left-0 w-full h-2 bg-black/50 pointer-events-none z-30">
                         <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${(watchedSecs / REQUIRED_SECS) * 100}%` }}
                         />
                      </div>
                    )}
                </div>
             ) : (
                <div 
                   className="w-full h-[450px] relative overflow-hidden"
                >
                   {/* Remove hidden interceptor so iframe can be clicked for reels */}
                   <iframe 
                     src={`${embedUrl}/embed/`} 
                     className={`w-full h-[500px] -mt-12 bg-white ${type === 'reel' ? 'pointer-events-auto' : 'pointer-events-none'}`} 
                     frameBorder="0" 
                     scrolling="no" 
                     allowtransparency="true"
                   ></iframe>

                   {!hasInteracted && !completed && type === 'reel' && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-6 text-center pointer-events-none z-20">
                         <Play size={48} className="text-white opacity-50 mb-4 animate-pulse" />
                         <p className="text-white font-bold text-lg mb-2">
                           Clique no vídeo para iniciar
                         </p>
                         <p className="text-white/80 text-sm tracking-wide">
                           O tempo só conta depois de clicar no player e interagir. Não feche nem tire o foco do vídeo!
                         </p>
                      </div>
                   )}
                   
                   {/* Timer Overlay */}
                   {isPlaying && !completed && (
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2 pointer-events-none z-30">
                         <div className="w-4 h-4 text-purple-400 animate-pulse"><Play size={16} /></div>
                         <span className="text-white text-xs font-bold font-mono">
                            {formatTime(Math.max(0, REQUIRED_SECS - watchedSecs))}
                         </span>
                      </div>
                   )}

                   {completed && (
                      <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-400/50 flex items-center gap-2 pointer-events-none z-30 shadow-lg shadow-emerald-500/20">
                         <CheckCircle2 size={16} className="text-white" />
                         <span className="text-white text-xs font-bold">Assistido ✓</span>
                      </div>
                   )}

                   {/* Underline Progress Bar for Video */}
                   {!completed && (
                      <div className="absolute bottom-0 left-0 w-full h-2 bg-black/50 pointer-events-none z-30">
                         <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${(watchedSecs / REQUIRED_SECS) * 100}%` }}
                         />
                      </div>
                   )}
                </div>
             )}
          </div>

          {/* Action Area */}
          <div className="p-5 flex flex-col gap-4 bg-background">
             
             {/* Progress Bar (Overall Mission) */}
             {missionProgress && (
                <div className="w-full flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                   <div className="flex flex-col flex-1 mr-4">
                      <div className="flex justify-between items-end mb-1.5">
                         <span className="text-xs text-white/70 font-medium">Progresso da Missão</span>
                         <span className="text-xs font-bold text-white shadow-sm">{missionProgress.current} / {missionProgress.goal}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                           style={{ width: `${Math.min(100, (missionProgress.current / missionProgress.goal) * 100)}%` }}
                         />
                      </div>
                   </div>
                </div>
             )}

             <div className="flex gap-3">
                {type === 'reel' && (
                   <Button 
                      onClick={() => handleActionClick('like')}
                      className={`flex-1 font-bold text-white shadow-lg border-none py-6 transition-all ${completed ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:scale-[1.02]' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                      disabled={!completed}
                   >
                      <Heart size={20} className={completed ? "text-white mr-2" : "text-muted-foreground mr-2"} /> Curtir e Confirmar
                   </Button>
                )}
                {type === 'post' && (
                   <Button 
                      onClick={() => handleActionClick('like')}
                      className={`flex-1 font-bold text-white shadow-lg border-none py-6 transition-all ${completed ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:scale-[1.02]' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                      disabled={!completed}
                   >
                      <Heart size={20} className={completed ? "text-white mr-2" : "text-muted-foreground mr-2"} /> Curtir e Confirmar
                   </Button>
                )}
                {type === 'profile' && (
                   <Button 
                      onClick={() => handleActionClick('follow')}
                      className={`flex-1 font-bold text-white shadow-lg border-none py-6 transition-all ${completed ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:scale-[1.02]' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                      disabled={!completed}
                   >
                      <UserPlus size={20} className={completed ? "text-white mr-2" : "text-muted-foreground mr-2"} /> Seguir e Confirmar
                   </Button>
                )}
             </div>
             
             {!completed && (
                <p className="text-center text-[10px] text-white/40 uppercase tracking-widest font-bold">
                   {!hasInteracted && type === 'reel' ? 'Clique no player para iniciar' : `Aguarde ${formatTime(REQUIRED_SECS)} para liberar as ações`}
                </p>
             )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
