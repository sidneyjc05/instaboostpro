import React, { useState } from 'react';
import { Play, Heart, UserPlus, Eye, Instagram, Sparkles, ExternalLink, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatedIcon } from './AnimatedIcon';

interface InstaPreviewCardProps {
  url: string;
  type: 'post' | 'reel' | 'profile';
  username: string;
  isOwner?: boolean;
  plan?: string;
  interactionsCount?: number;
  expiresAt?: string;
  onClick: () => void;
}

export function InstaPreviewCard({
  url,
  type,
  username,
  isOwner = false,
  plan = 'basic',
  interactionsCount = 0,
  expiresAt,
  onClick
}: InstaPreviewCardProps) {
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Extract shortcode if applicable
  let shortcode = '';
  if (type === 'reel') {
    const match = url.match(/\/reel\/([A-Za-z0-9_-]+)/);
    if (match) shortcode = match[1];
  } else if (type === 'post') {
    const match = url.match(/\/(p|tv)\/([A-Za-z0-9_-]+)/);
    if (match) shortcode = match[2];
  }

  const cleanUser = username || 'instagram';
  const avatarUrl = `https://images.weserv.nl/?url=https://unavatar.io/instagram/${encodeURIComponent(cleanUser)}&w=120&h=120&fit=cover`;
  const postThumbnailUrl = shortcode
    ? `https://images.weserv.nl/?url=https://www.instagram.com/p/${shortcode}/media/?size=l`
    : '';

  // Time remaining calculation
  let remainingText = '';
  if (expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff > 0) {
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      if (hours > 0) {
        remainingText = `${hours}h ${mins % 60}m restantes`;
      } else {
        remainingText = `${mins}m restantes`;
      }
    } else {
      remainingText = 'Expirando em breve';
    }
  }

  return (
    <div 
      onClick={onClick}
      className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group select-none transition-all duration-300 border border-white/10 hover:border-pink-500/50 shadow-lg hover:shadow-pink-500/10"
    >
      {/* Background Container with Blur and Ambient Glow */}
      <div className="relative w-full h-48 sm:h-56 bg-zinc-950 overflow-hidden flex items-center justify-center">
        
        {/* Dynamic Blurred Backdrop */}
        {type === 'profile' ? (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-pink-900/40 to-amber-900/40 blur-xl scale-125 opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        ) : type === 'reel' ? (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 blur-xl scale-125 opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-950 via-pink-950 to-orange-950 blur-xl scale-125 opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        )}

        {/* Ambient Grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Media / Photo Thumbnail for Posts and Reels */}
        {(type === 'post' || type === 'reel') && postThumbnailUrl && !imgError && (
          <div className="absolute inset-0 overflow-hidden">
            <img 
              src={postThumbnailUrl} 
              alt={`Instagram ${type}`}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700 filter brightness-90"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          </div>
        )}

        {/* Card Content based on type */}
        {type === 'profile' ? (
          <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
            {/* Story Avatar Ring */}
            <div className="relative p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shadow-xl group-hover:scale-105 transition-transform duration-300">
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
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full p-1 shadow-md border border-white/20">
                <Instagram size={12} className="text-white" />
              </div>
            </div>

            <div className="mt-2.5 flex flex-col items-center">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-base sm:text-lg tracking-tight drop-shadow-md">
                  @{cleanUser}
                </span>
              </div>
              <span className="text-[11px] font-medium text-purple-200/80 bg-purple-950/60 px-2.5 py-0.5 rounded-full mt-1 border border-purple-500/20 backdrop-blur-sm">
                Perfil Oficial do Instagram
              </span>
            </div>
          </div>
        ) : type === 'reel' ? (
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Pulsing Play Button */}
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-md opacity-70 group-hover:opacity-100 animate-pulse transition duration-500" />
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 flex items-center justify-center text-white shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300 border border-white/30">
                <Play size={26} className="ml-1 fill-white text-white" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white shadow-md">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider">Assistir Reel • 10s</span>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Post Photo Icon */}
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-rose-500 to-amber-500 rounded-full blur-md opacity-60 group-hover:opacity-100 transition duration-500" />
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-300 border border-white/30">
                <Heart size={26} className="fill-white text-white" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white shadow-md">
              <span className="text-xs font-bold uppercase tracking-wider">Curtir Postagem</span>
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center gap-2">
            {isOwner ? (
              <span className="bg-amber-500/90 text-black text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 border border-amber-300">
                <Sparkles size={12} /> Minha Divulgação
              </span>
            ) : (
              <span className="bg-black/60 backdrop-blur-md text-white/90 text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                {type === 'reel' ? <Play size={10} className="fill-current text-rose-400" /> : type === 'post' ? <Heart size={10} className="fill-current text-pink-400" /> : <UserPlus size={10} className="text-purple-400" />}
                {type === 'reel' ? 'Reel (10s)' : type === 'post' ? 'Postagem' : 'Perfil'}
              </span>
            )}
          </div>

          {/* Reward Badge or Interactions count */}
          {isOwner ? (
            <span className="bg-purple-950/80 backdrop-blur-md text-purple-200 text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full border border-purple-500/30 flex items-center gap-1 shadow-sm">
              <Eye size={12} /> {interactionsCount} cliques
            </span>
          ) : (
            <motion.span 
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-r from-amber-500/90 to-yellow-500/90 text-black text-xs font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 border border-yellow-300"
            >
              +0.2 <AnimatedIcon type="coin" size={14} />
            </motion.span>
          )}
        </div>

        {/* Bottom Banner */}
        <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          <span className="text-[11px] text-white/80 font-medium bg-black/50 backdrop-blur-md px-2.5 py-0.5 rounded-lg truncate max-w-[200px] border border-white/5">
            @{cleanUser}
          </span>
          {remainingText && (
            <span className="text-[10px] text-zinc-400 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/5 font-mono">
              {remainingText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
