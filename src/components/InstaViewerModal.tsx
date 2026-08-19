import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, UserPlus, Play, Pause, CheckCircle2, Instagram, Sparkles, Loader2, Film, Cpu, RotateCcw, AlertTriangle } from 'lucide-react';
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

// Client-side deterministic adaptive duration fallback (Strictly capped at 93s = 1m 33s)
function calculateFallbackReelDuration(reelUrl: string): number {
  if (!reelUrl) return 19;
  
  // Extract shortcode or numerical hints
  const match = reelUrl.match(/\/(reel|p|tv)\/([A-Za-z0-9_-]+)/);
  const code = match ? match[2] : reelUrl;

  // If URL explicitly mentions seconds or specific test pattern
  const explicitSecsMatch = reelUrl.match(/(?:duration|time|s|seg)=(\d+)/i);
  if (explicitSecsMatch) {
    const parsed = parseInt(explicitSecsMatch[1], 10);
    if (parsed > 0) return Math.min(parsed, 93);
  }

  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  // Distribution recognizing short 19s reels, 15s, 22s, 30s, 45s, 60s, up to 93s
  const durations = [19, 15, 22, 19, 28, 35, 19, 45, 60, 75, 90, 93];
  const selected = durations[absHash % durations.length];
  return Math.min(selected, 93);
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${secs}s`;
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
  const [requiredSecs, setRequiredSecs] = useState(19);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(true);
  const [analysisStep, setAnalysisStep] = useState('IA analisando e calculando processo do vídeo...');
  const [aiSource, setAiSource] = useState<string>('ai_gemini');
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [watchedSecs, setWatchedSecs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [claimed, setClaimed] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const isHoveringIframe = useRef(false);
  const lastIframeClickTime = useRef(0);

  useBodyScrollLock(open);

  // Main lifecycle when modal opens / resets
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setWatchedSecs(0);
      setCompleted(false);
      setHasInteracted(false);
      setClaimed(false);
      setIsAnalyzingVideo(true);
      setIframeLoaded(false);
      setAiReasoning('');
      return;
    }
    
    // For profile and static post, timer starts after modal opens
    if (type === 'profile') {
      setRequiredSecs(3);
      setIsAnalyzingVideo(false);
      setIsPlaying(true);
      setHasInteracted(true);
    } else if (type === 'post') {
      setRequiredSecs(5);
      setIsAnalyzingVideo(false);
      setIsPlaying(true);
      setHasInteracted(true);
    } else {
      // For REELS: Fetch AI metadata & database calculated duration (capped at 93s / 1m 33s)
      setIsAnalyzingVideo(true);
      setIsPlaying(false);
      setHasInteracted(false);
      setWatchedSecs(0);
      setCompleted(false);
      setIframeLoaded(false);

      setAnalysisStep('Consultando Banco de Dados e IA Integrada...');

      let isMounted = true;
      let calculatedDuration = calculateFallbackReelDuration(url);

      const inspectVideo = async () => {
        try {
          // Check server inspection endpoint (backed by Gemini AI + Firestore/SQLite database)
          const res = await fetch(`/api/instagram/inspect-reel?url=${encodeURIComponent(url)}`, {
            signal: AbortSignal.timeout(3000)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.duration && data.duration > 0) {
              calculatedDuration = Math.min(data.duration, 93);
              if (data.source) setAiSource(data.source);
              if (data.reasoning) setAiReasoning(data.reasoning);
            }
          }
        } catch {
          // Keep fallback
        }

        if (!isMounted) return;

        // Strictly respect ceiling of 93 seconds (1m 33s)
        const finalSecs = Math.min(Math.max(calculatedDuration, 10), 93);
        setRequiredSecs(finalSecs);

        setAnalysisStep(`IA definiu duração inteligente: ${formatDuration(finalSecs)}.`);

        // Wait smoothly before revealing the player
        setTimeout(() => {
          if (isMounted) {
            setIsAnalyzingVideo(false);
          }
        }, 900);
      };

      inspectVideo();

      return () => {
        isMounted = false;
      };
    }
  }, [open, type, url]);

  // Intelligent Play/Pause handler
  const handleTogglePlayPause = useCallback(() => {
    if (completed || isAnalyzingVideo) return;
    
    if (!hasInteracted) {
      setHasInteracted(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [completed, isAnalyzingVideo, hasInteracted]);

  const handleStartPlay = useCallback(() => {
    if (completed || isAnalyzingVideo) return;
    setHasInteracted(true);
    setIsPlaying(true);
  }, [completed, isAnalyzingVideo]);

  const handlePause = useCallback(() => {
    if (completed) return;
    setIsPlaying(false);
  }, [completed]);

  // Iframe click detection: First click starts play, subsequent clicks toggle play/pause!
  useEffect(() => {
    if (!open || type !== 'reel' || isAnalyzingVideo || completed) return;

    const handleIframeInteraction = () => {
      const now = Date.now();
      // Debounce rapid multiple blur triggers
      if (now - lastIframeClickTime.current < 400) return;
      lastIframeClickTime.current = now;

      if (!hasInteracted) {
        handleStartPlay();
      } else {
        // Toggle play / pause intelligently on subsequent player clicks
        setIsPlaying(prev => !prev);
      }
    };

    const handleWindowBlur = () => {
      if (isHoveringIframe.current || document.activeElement?.tagName === 'IFRAME') {
        setTimeout(handleIframeInteraction, 50);
      }
    };

    const interval = setInterval(() => {
      if (document.activeElement === iframeRef.current) {
        handleIframeInteraction();
        // Shift focus away from iframe so next clicks can trigger blur/focus again
        window.focus();
      }
    }, 300);

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      clearInterval(interval);
    };
  }, [open, type, hasInteracted, isAnalyzingVideo, completed, handleStartPlay]);

  // Visibility state handling (PAUSE if user switches tab or minimizes window)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Timer interval: strictly runs ONLY when isPlaying && hasInteracted && not paused
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && hasInteracted && open && !completed) {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
           setWatchedSecs(prev => {
             const next = prev + 1;
             if (next >= requiredSecs) {
                setCompleted(true);
                setIsPlaying(false);
                return requiredSecs;
             }
             return next;
           });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isPlaying, hasInteracted, open, completed, requiredSecs]);

  if (!open) return null;

  let embedUrl = url.split('?')[0].replace(/\/$/, "");
  const profileUser = username || 'usuario';
  const remainingSeconds = Math.max(0, requiredSecs - watchedSecs);

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
          {/* Top Status & Timer Bar */}
          <div className="w-full bg-purple-950/60 border-b border-purple-500/20 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isAnalyzingVideo ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400 animate-ping"></span>
                ) : type === 'reel' && !hasInteracted ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                ) : type === 'reel' && !isPlaying && !completed ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                ) : !completed ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                )}
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {isAnalyzingVideo ? (
                  '⚙️ Lendo Vídeo...'
                ) : type === 'reel' ? (
                  !hasInteracted 
                    ? `⏸️ Aguardando Play (${formatDuration(requiredSecs)})` 
                    : completed 
                      ? '✅ Liberado!' 
                      : isPlaying 
                        ? `▶️ Assistindo (${formatDuration(remainingSeconds)})`
                        : `⏸️ Pausado (${formatDuration(remainingSeconds)})`
                ) : (
                  completed ? '✅ Liberado!' : `${formatDuration(remainingSeconds)}`
                )}
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
          <div 
             ref={iframeContainerRef}
             onMouseEnter={() => { isHoveringIframe.current = true; }}
             onMouseLeave={() => { isHoveringIframe.current = false; }}
             className="w-full relative bg-zinc-950 flex items-center justify-center min-h-[380px] max-h-[460px] overflow-hidden"
          >
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
                          style={{ width: `${(watchedSecs / requiredSecs) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {completed ? 'Tempo concluído ✓' : `Aguarde ${formatDuration(remainingSeconds)} para validar`}
                      </span>
                    </div>
                </div>
             ) : (
                <div 
                   className="w-full h-[440px] relative overflow-hidden bg-black flex items-center justify-center"
                   onMouseEnter={() => { isHoveringIframe.current = true; }}
                   onMouseLeave={() => { isHoveringIframe.current = false; }}
                   onTouchStart={() => { isHoveringIframe.current = true; }}
                 >
                   {/* Instagram Official Embed Frame */}
                   <iframe 
                     ref={iframeRef}
                     src={`${embedUrl}/embed/`} 
                     onLoad={() => setIframeLoaded(true)}
                     className="w-full h-[490px] -mt-10 bg-white z-10" 
                     frameBorder="0" 
                     scrolling="no" 
                     allowtransparency="true"
                     allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                   ></iframe>

                   {/* Video Analysis & Process Loading Screen */}
                   <AnimatePresence>
                     {isAnalyzingVideo && (
                       <motion.div 
                         initial={{ opacity: 1 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0, scale: 0.96 }}
                         transition={{ duration: 0.35 }}
                         className="absolute inset-0 bg-gradient-to-b from-[#180d28] via-zinc-950 to-black z-40 flex flex-col items-center justify-center p-6 text-center"
                       >
                         {/* Animated Processing Glow */}
                         <div className="relative mb-5">
                           <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 rounded-full blur-xl opacity-75 animate-pulse" />
                           <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-purple-500/40 flex items-center justify-center text-white relative z-10 shadow-2xl">
                             <Film size={34} className="text-pink-400 animate-pulse" />
                           </div>
                           <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-1.5 z-20 border border-white/20 animate-spin">
                             <Loader2 size={16} className="text-white" />
                           </div>
                         </div>

                         {/* Title & Message */}
                         <h4 className="text-white font-black text-base tracking-tight mb-2">
                           Carregando e Lendo Processo do Vídeo
                         </h4>

                         <p className="text-xs text-purple-300/90 max-w-[260px] leading-relaxed min-h-[36px] flex items-center justify-center font-medium">
                           {analysisStep}
                         </p>

                         {/* Adaptive Duration Info Badge */}
                         <div className="mt-4 flex items-center gap-2 bg-purple-950/60 px-3.5 py-1.5 rounded-full border border-purple-500/30 text-[11px] text-purple-200">
                           <Cpu size={13} className="text-pink-400" />
                           <span>Tempo Máximo: <b>1m 33s</b> (adaptativo)</span>
                         </div>

                         {/* Progress Bar */}
                         <div className="w-48 h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                           <motion.div 
                             className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500"
                             initial={{ width: "15%" }}
                             animate={{ width: "100%" }}
                             transition={{ duration: 1.2, ease: "easeInOut" }}
                           />
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                   
                   {/* Non-blocking Helper Banner (Play required) */}
                   {!isAnalyzingVideo && !hasInteracted && type === 'reel' && (
                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full px-4 text-center">
                       <div className="bg-purple-950/90 text-purple-200 border border-purple-400/40 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-black shadow-2xl inline-flex items-center gap-2 animate-bounce">
                         <Sparkles size={13} className="text-amber-400" />
                         <span>IA definiu: {formatDuration(requiredSecs)} • Dê play no vídeo para iniciar</span>
                       </div>
                     </div>
                   )}

                   {/* Paused Overlay Banner if user paused video */}
                   {!isAnalyzingVideo && hasInteracted && !isPlaying && !completed && (
                     <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full px-4 text-center">
                       <div className="bg-amber-950/90 text-amber-200 border border-amber-500/50 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-black shadow-2xl inline-flex items-center gap-2 animate-pulse">
                         <Pause size={13} className="fill-amber-400 text-amber-400" />
                         <span>Vídeo pausado • Tempo congelado em {formatDuration(remainingSeconds)}</span>
                       </div>
                     </div>
                   )}

                   {/* Floating Timer Countdown Badge when video is playing */}
                   {!isAnalyzingVideo && hasInteracted && isPlaying && !completed && (
                      <div className="absolute top-4 right-4 bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-purple-500/40 flex items-center gap-2 pointer-events-none z-30 shadow-xl">
                         <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                         <span className="text-white text-xs font-black font-mono">
                            {formatDuration(remainingSeconds)} restantes
                         </span>
                      </div>
                   )}

                   {/* AI Badge at top-left during playback */}
                   {!isAnalyzingVideo && type === 'reel' && (
                     <div className="absolute top-4 left-4 bg-purple-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-purple-400/30 flex items-center gap-1.5 pointer-events-none z-30 shadow-md">
                       <Cpu size={12} className="text-pink-400" />
                       <span className="text-[10px] font-bold text-purple-200">
                         IA: {formatDuration(requiredSecs)}
                       </span>
                     </div>
                   )}

                   {!isAnalyzingVideo && completed && (
                      <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-400/60 flex items-center gap-1.5 pointer-events-none z-30 shadow-lg shadow-emerald-500/30">
                         <CheckCircle2 size={16} className="text-white" />
                         <span className="text-white text-xs font-black">Pronto para Confirmar!</span>
                      </div>
                   )}

                   {/* Bottom Progress Bar */}
                   {!isAnalyzingVideo && hasInteracted && !completed && (
                     <div className="absolute bottom-0 left-0 w-full h-2 bg-black/60 z-30 pointer-events-none">
                        <div 
                           className={`h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 transition-all duration-1000 ease-linear ${!isPlaying ? 'opacity-50' : ''}`}
                           style={{ width: `${(watchedSecs / requiredSecs) * 100}%` }}
                        />
                     </div>
                   )}
                </div>
             )}
          </div>

          {/* Quick Playback Control Bar for Reels */}
          {type === 'reel' && !isAnalyzingVideo && !completed && hasInteracted && (
            <div className="px-4 py-2 bg-zinc-950/80 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-medium">Controle Inteligente:</span>
                <span className={`text-[11px] font-bold ${isPlaying ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isPlaying ? '▶️ Em reprodução' : '⏸️ Vídeo Pausado'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleTogglePlayPause}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause size={12} className="text-amber-400 fill-amber-400" /> Pausar
                  </>
                ) : (
                  <>
                    <Play size={12} className="text-emerald-400 fill-emerald-400" /> Retomar
                  </>
                )}
              </button>
            </div>
          )}

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
                      ) : isAnalyzingVideo ? (
                        <>
                          <Loader2 size={16} className="text-pink-400 animate-spin" /> Lendo processo do vídeo...
                        </>
                      ) : !hasInteracted ? (
                        <>
                          <Play size={16} className="text-amber-400 fill-amber-400" /> Clique no vídeo para iniciar ({formatDuration(requiredSecs)})
                        </>
                      ) : isPlaying ? (
                        <>
                          <Play size={16} className="text-zinc-500 fill-zinc-500" /> Assistindo... {formatDuration(remainingSeconds)} restantes
                        </>
                      ) : (
                        <>
                          <Pause size={16} className="text-amber-400 fill-amber-400" /> Pausado! Retome o vídeo para continuar ({formatDuration(remainingSeconds)})
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
                          <Heart size={16} className="text-zinc-500" /> Aguarde {formatDuration(remainingSeconds)} para liberar
                        </>
                      )}
                   </Button>
                )}

                {type === 'profile' && (
                   <Button 
                      onClick={handleConfirmAction}
                      className={`w-full font-black text-white shadow-xl py-6 transition-all rounded-2xl flex items-center justify-center gap-2 ${
                        completed 
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 animate-pulse cursor-pointer border border-purple-400/40 text-sm' 
                          : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/5 text-xs'
                      }`}
                      disabled={!completed}
                   >
                      {completed ? (
                        <>
                          <UserPlus size={18} className="text-white" /> Seguir e Confirmar (+0.2 Moedas)
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} className="text-zinc-500" /> Aguarde {formatDuration(remainingSeconds)} para liberar
                        </>
                      )}
                   </Button>
                )}

                <p className="text-center text-[10px] text-zinc-400">
                   {isAnalyzingVideo 
                     ? 'Lendo e adaptando o tempo do vídeo...' 
                     : !hasInteracted && type === 'reel' 
                       ? 'Dê play no player oficial do Instagram para começar a contagem.' 
                       : !isPlaying && type === 'reel' && !completed
                         ? 'Vídeo pausado. O cronômetro parou e continuará ao retomar.'
                         : completed 
                           ? 'Clique acima para abrir o Instagram e creditar suas moedas!' 
                           : 'O sistema verifica e valida a ação automaticamente.'}
                </p>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
