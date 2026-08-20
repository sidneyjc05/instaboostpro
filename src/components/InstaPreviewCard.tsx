import React, { useState, useEffect } from 'react';
import { Play, Heart, UserPlus, Eye, Instagram, Sparkles, Clock, Flame, Film, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatedIcon } from './AnimatedIcon';

interface InstaPreviewCardProps {
  url: string;
  type: 'post' | 'reel' | 'profile';
  username: string;
  avatarUrl?: string;
  isOwner?: boolean;
  plan?: string;
  interactionsCount?: number;
  expiresAt?: string;
  onClick: () => void;
  onExpired?: () => void;
}

export function InstaPreviewCard({
  url,
  type,
  username,
  avatarUrl: customAvatarUrl,
  isOwner = false,
  plan = 'basic',
  interactionsCount = 0,
  expiresAt,
  onClick,
  onExpired
}: InstaPreviewCardProps) {
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Extract shortcode if applicable
  let shortcode = '';
  let extractedUser = username || '';
  if (type === 'reel') {
    const match = url.match(/\/reel\/([A-Za-z0-9_-]+)/);
    if (match) shortcode = match[1];
  } else if (type === 'post') {
    const match = url.match(/\/(p|tv)\/([A-Za-z0-9_-]+)/);
    if (match) shortcode = match[2];
  } else if (type === 'profile') {
    const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
    if (match && !['p', 'reel', 'tv', 'stories', 'explore'].includes(match[1])) {
      if (!extractedUser) extractedUser = match[1];
    }
  }

  const cleanUser = (extractedUser || 'instagram').replace(/^@/, '');
  const avatarUrl = customAvatarUrl || `/api/instagram/avatar/${encodeURIComponent(cleanUser)}`;
  const postThumbnailUrl = shortcode
    ? `https://images.weserv.nl/?url=https://www.instagram.com/p/${shortcode}/media/?size=l`
    : '';

  // Real-time Countdown Timer with auto-expire trigger
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('');
      return;
    }

    const calculateTime = () => {
      const targetTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft('Expirado');
        if (onExpired) {
          onExpired();
        }
        return;
      }

      setIsUrgent(diff < 5 * 60 * 1000); // Less than 5 minutes

      const totalSecs = Math.floor(diff / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
      } else if (mins > 0) {
        setTimeLeft(`${mins}m ${secs.toString().padStart(2, '0')}s`);
      } else {
        setTimeLeft(`${secs}s`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  // Plan styling
  const isVip = plan === 'ultra' || plan === 'premium' || plan === 'pro';

  return (
    <motion.div 
      whileHover={{ y: -3, scale: 1.008 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`relative w-full rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group select-none transition-all duration-300 border ${
        isOwner
          ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-zinc-950 hover:border-amber-400/70 shadow-amber-500/10'
          : isVip
          ? 'border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-zinc-950 hover:border-purple-400/70 shadow-purple-500/10'
          : 'border-white/10 bg-zinc-950 hover:border-pink-500/50 shadow-pink-500/10'
      } shadow-xl backdrop-blur-md`}
    >
      {/* Background Container with Multi-Layer Blur and Ambient Glow */}
      <div className="relative w-full h-52 sm:h-60 overflow-hidden flex flex-col justify-between p-4 sm:p-5">
        
        {/* Dynamic Multi-Color Blurred Backdrop */}
        {type === 'profile' ? (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-pink-900/40 to-amber-900/30 blur-2xl scale-125 opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        ) : type === 'reel' ? (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/70 via-purple-950/60 to-pink-950/50 blur-2xl scale-125 opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/60 via-pink-950/50 to-orange-950/40 blur-2xl scale-125 opacity-75 group-hover:opacity-100 transition-opacity duration-500" />
        )}

        {/* Ambient Grid overlay & Subtle Light Specular */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Media / Photo Thumbnail for Posts and Reels with High-End Blur Glassmorphism */}
        {(type === 'post' || type === 'reel') && postThumbnailUrl && !imgError && (
          <div className="absolute inset-0 overflow-hidden">
            {/* Deep blurred backdrop layer for cinematic aesthetic */}
            <img 
              src={postThumbnailUrl} 
              alt="Backdrop Blur"
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-135 opacity-40 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none"
              loading="lazy"
            />
            {/* Main media preview layer */}
            <img 
              src={postThumbnailUrl} 
              alt={`Instagram ${type}`}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-85 group-hover:scale-105 transition-all duration-700 filter brightness-90 contrast-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/30" />
          </div>
        )}

        {/* TOP BAR: Author Avatar + User + Action Type Badge + Coin Reward */}
        <div className="relative z-20 flex items-center justify-between gap-2">
          {/* Left: Author Profile Pill */}
          <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/10 shadow-lg">
            {/* Profile Avatar with Instagram Ring */}
            <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shadow-md">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center text-white font-bold text-xs border border-zinc-950">
                {!avatarError ? (
                  <img 
                    src={avatarUrl} 
                    alt={cleanUser} 
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover" 
                    loading="lazy"
                  />
                ) : (
                  <span className="uppercase text-[10px] font-black bg-gradient-to-tr from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {cleanUser.substring(0, 2)}
                  </span>
                )}
              </div>
              
              {/* Type Mini Icon Badge on Profile Photo */}
              <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 shadow-md border border-black/50 flex items-center justify-center text-white text-[8px] bg-gradient-to-tr from-pink-500 to-purple-600">
                {type === 'reel' ? (
                  <Film size={8} className="text-white" />
                ) : type === 'post' ? (
                  <Heart size={8} className="fill-white text-white" />
                ) : (
                  <UserPlus size={8} className="text-white" />
                )}
              </div>
            </div>

            {/* Username & Action Label */}
            <div className="flex flex-col pr-1">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-white text-xs tracking-tight truncate max-w-[110px] sm:max-w-[140px]">
                  @{cleanUser}
                </span>
                {isOwner && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>
              
              {/* Explicit Action Label requested by user */}
              <span className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 text-pink-300">
                {type === 'reel' ? (
                  <>
                    <Play size={9} className="fill-pink-400 text-pink-400 inline" />
                    <Heart size={9} className="fill-rose-400 text-rose-400 inline" />
                    <span>Assistir & Curtir</span>
                  </>
                ) : type === 'post' ? (
                  <>
                    <Heart size={9} className="fill-rose-400 text-rose-400 inline" />
                    <span>Curtir Post</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={9} className="text-purple-300 inline" />
                    <span>Seguir Perfil</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Right: Reward Pill or Owner Stats */}
          <div className="flex items-center gap-2">
            {isOwner ? (
              <span className="bg-amber-500/90 text-black text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-amber-300">
                <Sparkles size={12} /> Minha Divulgação
              </span>
            ) : (
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-black px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1.5 border border-yellow-200"
              >
                <span>+0.2</span>
                <AnimatedIcon type="coin" size={15} />
              </motion.div>
            )}
          </div>
        </div>

        {/* CENTER BODY: Interactive Showcase with Icons & Visual Cue */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center">
          {type === 'profile' ? (
            <div className="flex flex-col items-center">
              {/* Main Avatar Halo with Follow Badge */}
              <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shadow-2xl group-hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center text-white font-bold text-xl border-2 border-zinc-950">
                  {!avatarError ? (
                    <img 
                      src={avatarUrl} 
                      alt={cleanUser} 
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="uppercase text-2xl font-black bg-gradient-to-tr from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {cleanUser.substring(0, 2)}
                    </span>
                  )}
                </div>
                
                {/* Floating Follow Icon */}
                <div className="absolute -bottom-1.5 -right-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full p-2 shadow-xl border-2 border-zinc-950 text-white animate-bounce">
                  <UserPlus size={14} />
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-full border border-purple-500/30 text-white shadow-lg">
                <UserPlus size={12} className="text-purple-400" />
                <span className="text-xs font-black uppercase tracking-wider text-purple-200">Seguir no Instagram</span>
              </div>
            </div>
          ) : type === 'reel' ? (
            <div className="flex flex-col items-center">
              {/* Dual Action Glowing Pulsing Button: Play + Heart */}
              <div className="relative">
                <div className="absolute -inset-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 animate-pulse transition duration-500" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 flex items-center justify-center text-white shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300 border-2 border-white/40">
                  <Play size={24} className="ml-1 fill-white text-white" />
                </div>
                
                {/* Companion Heart Icon for "Assistir e Curtir" */}
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full p-1.5 shadow-xl border-2 border-zinc-950 text-white">
                  <Heart size={12} className="fill-white text-white" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 bg-black/70 backdrop-blur-xl px-4 py-1.5 rounded-full border border-pink-500/30 text-white shadow-xl">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-purple-300">
                  Assistir Reel & Curtir
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Post Photo Heart Icon */}
              <div className="relative">
                <div className="absolute -inset-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full blur-lg opacity-70 group-hover:opacity-100 transition duration-500" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300 border-2 border-white/40">
                  <Heart size={26} className="fill-white text-white" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 bg-black/70 backdrop-blur-xl px-4 py-1.5 rounded-full border border-rose-500/30 text-white shadow-xl">
                <Heart size={13} className="fill-rose-400 text-rose-400" />
                <span className="text-xs font-black uppercase tracking-wider text-rose-200">
                  Curtir Postagem
                </span>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM BAR: Plan Badge + Interactions + Real-Time Countdown Timer */}
        <div className="relative z-20 flex items-center justify-between gap-2 pt-1 border-t border-white/10">
          {/* Left: Type tag & Plan */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-zinc-300 bg-white/5 backdrop-blur-md px-2.5 py-0.5 rounded-md border border-white/10 uppercase">
              {type === 'reel' ? 'Reels' : type === 'post' ? 'Post' : 'Perfil'}
            </span>

            {plan && plan !== 'basic' && (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                plan === 'ultra' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : plan === 'premium' 
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                <Flame size={10} /> {plan.toUpperCase()}
              </span>
            )}
          </div>

          {/* Right: Real-time Countdown Timer that disappears when expired */}
          {timeLeft && (
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border backdrop-blur-md transition-colors ${
              isUrgent
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse shadow-md shadow-rose-900/30'
                : 'bg-black/60 text-zinc-300 border-white/10'
            }`}>
              <Clock size={11} className={isUrgent ? 'text-rose-400' : 'text-zinc-400'} />
              <span>{timeLeft}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
