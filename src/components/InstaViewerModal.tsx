import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, UserPlus, Play, CheckCircle2, Instagram, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AnimatedIcon } from './AnimatedIcon';

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

export function InstaViewerModal({ 
  open, 
  onClose, 
  url, 
  type, 
  username, 
  onInteract, 
  title = "Conteúdo para assistir", 
  missionProgress 
}: InstaViewerProps) {
  const REQUIRED_SECS = type === 'reel' ? 10 : (type === 'post' ? 5 : 3);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchedSecs, setWatchedSecs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setWatchedSecs(0);
      setCompleted(false);
      setHasInteracted(false);
      setClaimed(false);
      return;
    }
    
    // Auto-start for profile/post or prepare timer
    if (type === 'profile' || type === 'post') {
      setIsPlaying(true);
      setHasInteracted(true);
    } else {
      // For reels, start countdown immediately or when clicked
      setIsPlaying(true);
      setHasInteracted(true);
    }
  }, [open, type]);

  // Window blur / iframe focus detector
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

  // Visibility state handling (pause if user switches tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
          setIsPlaying(false);
       } else if (document.visibilityState === 'visible' && open && !completed) {
          setIsPlaying(true);
       }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [open, completed]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && open && !completed) {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
           setWatchedSecs(prev => {
             const next = prev + 1;
             if (next >= REQUIRED_SECS) {
                setCompleted(true);
                return REQUIRED_SECS;
             }
             return next;
           });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isPlaying, open, completed, REQUIRED_SECS]);

  if (!open) return null;

  let embedUrl = url.split('?')[0].replace(/\/$/, "");
  const profileUser = username || 'usuario';
  const remainingSeconds = Math.max(0, REQUIRED_SECS - watchedSecs);

  const handleStartPlay = () => {
    setHasInteracted(true);
    setIsPlaying(true);
  };

  const handleConfirmAction = () => {
    if (!completed || claimed) return;
    setClaimed(true);
    
    // Open Instagram in new tab to complete action
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // Award coins and trigger interaction logic
    onInteract();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-[#180d28] via-[#10071c] to-[#0a0312] rounded-3xl shadow-2xl shadow-purple-950/80 border border-purple-500/30 overflow-hidden flex flex-col my-auto z-10"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Timer Bar */}
          <div className="w-full bg-purple-950/60 border-b border-purple-500/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {!completed ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                )}
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {type === 'reel' ? 'Reels' : type === 'post' ? 'Postagem' : 'Perfil'} • {completed ? 'Liberado!' : `${remainingSeconds}s`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              <span className="text-xs font-black text-amber-400">+0.2</span>
              <AnimatedIcon type="coin" size={14} />
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-3.5 bg-black/40 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5 shadow-md">
                <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center text-xs font-black uppercase text-white">
                  {profileUser.charAt(0)}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-white text-sm leading-tight">@{profileUser}</span>
                <span className="text-[10px] text-purple-300/70">{title}</span>
              </div>
            </div>
            <button 
               onClick={onClose}
               className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content / Video / Profile Area */}
          <div className="w-full relative bg-zinc-950 flex items-center justify-center min-h-[380px] max-h-[460px] overflow-hidden">
             {type === 'profile' ? (
                <div className="w-full h-[380px] flex flex-col items-center justify-center gap-4 text-center p-6 bg-gradient-to-b from-purple-950/40 via-zinc-950 to-black relative">
                   <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-1 shadow-2xl animate-pulse">
                       <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center text-4xl font-black uppercase text-white border-2 border-zinc-950">
                          {profileUser.charAt(0)}
                       </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <h3 className="font-black text-xl text-white">@{profileUser}</h3>
                      <p className="text-xs text-zinc-400 max-w-[240px]">
                        Siga o perfil no Instagram para desbloquear suas moedas e avançar nas missões.
                      </p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="w-full max-w-[200px] mt-2 flex flex-col items-center gap-1.5">
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${(watchedSecs / REQUIRED_SECS) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {completed ? 'Tempo concluído ✓' : `Aguarde ${remainingSeconds}s para validar`}
                      </span>
                    </div>
                </div>
             ) : (
                <div className="w-full h-[440px] relative overflow-hidden bg-black flex items-center justify-center">
                   {/* Instagram Embed Frame */}
                   <iframe 
                     src={`${embedUrl}/embed/`} 
                     className="w-full h-[490px] -mt-10 bg-white" 
                     frameBorder="0" 
                     scrolling="no" 
                     allowtransparency="true"
                   ></iframe>
                   
                   {/* Interactive Start Overlay if not started */}
                   {!hasInteracted && type === 'reel' && (
                     <div 
                       onClick={handleStartPlay}
                       className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
                     >
                       <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform mb-3 border border-white/20">
                         <Play size={28} className="ml-1 fill-white" />
                       </div>
                       <span className="text-white font-extrabold text-base">Clique para Iniciar Reel</span>
                       <span className="text-purple-300 text-xs mt-1">Assista {REQUIRED_SECS} segundos para liberar as moedas</span>
                     </div>
                   )}

                   {/* Floating Timer Countdown Badge */}
                   {!completed ? (
                      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-purple-500/40 flex items-center gap-2 pointer-events-none z-40 shadow-xl">
                         <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                         <span className="text-white text-xs font-black font-mono">
                            {remainingSeconds}s restantes
                         </span>
                      </div>
                   ) : (
                      <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-400/60 flex items-center gap-1.5 pointer-events-none z-40 shadow-lg shadow-emerald-500/30">
                         <CheckCircle2 size={16} className="text-white" />
                         <span className="text-white text-xs font-black">Pronto para Confirmar!</span>
                      </div>
                   )}

                   {/* Bottom Progress Bar */}
                   <div className="absolute bottom-0 left-0 w-full h-2 bg-black/60 z-40">
                      <div 
                         className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 transition-all duration-1000 ease-linear"
                         style={{ width: `${(watchedSecs / REQUIRED_SECS) * 100}%` }}
                      />
                   </div>
                </div>
             )}
          </div>

          {/* Action Area */}
          <div className="p-4 bg-gradient-to-b from-black/80 to-black flex flex-col gap-3 border-t border-white/10">
             
             {/* Overall Mission Progress banner if available */}
             {missionProgress && (
                <div className="w-full flex justify-between items-center bg-white/5 p-2.5 rounded-xl border border-white/5">
                   <div className="flex flex-col flex-1 mr-3">
                      <div className="flex justify-between items-end mb-1">
                         <span className="text-[11px] text-white/70 font-medium">Progresso da Missão</span>
                         <span className="text-xs font-bold text-white">{missionProgress.current} / {missionProgress.goal}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                           style={{ width: `${Math.min(100, (missionProgress.current / missionProgress.goal) * 100)}%` }}
                         />
                      </div>
                   </div>
                </div>
             )}

             {/* Action Buttons */}
             <div className="flex flex-col gap-2">
                {type === 'reel' && (
                   <Button 
                      onClick={handleConfirmAction}
                      className={`w-full font-black text-white shadow-xl py-6 transition-all rounded-2xl flex items-center justify-center gap-2 ${
                        completed 
                          ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:opacity-95 animate-pulse cursor-pointer border border-pink-400/40 text-sm' 
                          : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/5 text-xs'
                      }`}
                      disabled={!completed}
                   >
                      {completed ? (
                        <>
                          <Heart size={18} className="fill-white" /> Curtir e Confirmar (+0.2 Moedas)
                        </>
                      ) : (
                        <>
                          <Play size={16} className="text-zinc-500 fill-zinc-500" /> Assista mais {remainingSeconds}s para liberar
                        </>
                      )}
                   </Button>
                )}

                {type === 'post' && (
                   <Button 
                      onClick={handleConfirmAction}
                      className={`w-full font-black text-white shadow-xl py-6 transition-all rounded-2xl flex items-center justify-center gap-2 ${
                        completed 
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 animate-pulse cursor-pointer border border-pink-400/40 text-sm' 
                          : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/5 text-xs'
                      }`}
                      disabled={!completed}
                   >
                      {completed ? (
                        <>
                          <Heart size={18} className="fill-white" /> Curtir e Confirmar (+0.2 Moedas)
                        </>
                      ) : (
                        <>
                          <Heart size={16} className="text-zinc-500" /> Aguarde {remainingSeconds}s para liberar
                        </>
                      )}
                   </Button>
                )}

                {type === 'profile' && (
                   <Button 
                      onClick={handleConfirmAction}
                      className={`w-full font-black text-white shadow-xl py-6 transition-all rounded-2xl flex items-center justify-center gap-2 ${
                        completed 
                          ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-green-600 hover:opacity-95 animate-pulse cursor-pointer border border-emerald-400/40 text-sm' 
                          : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/5 text-xs'
                      }`}
                      disabled={!completed}
                   >
                      {completed ? (
                        <>
                          <UserPlus size={18} /> Seguir e Confirmar (+0.2 Moedas)
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} className="text-zinc-500" /> Aguarde {remainingSeconds}s para liberar
                        </>
                      )}
                   </Button>
                )}

                <p className="text-center text-[10px] text-zinc-400">
                   {completed ? 'Clique acima para abrir o Instagram e creditar suas moedas!' : 'O sistema verifica e valida a ação automaticamente.'}
                </p>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

