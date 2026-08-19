import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Eye, ExternalLink, Clock, Rocket, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useNavigate } from 'react-router';

interface MyPromotionModalProps {
  open: boolean;
  onClose: () => void;
  promotion: {
    id: string;
    url: string;
    username: string;
    expires_at: string;
    interactions_count?: number;
    plan?: string;
  } | null;
  onDelete?: (id: string) => void;
}

export function MyPromotionModal({ open, onClose, promotion, onDelete }: MyPromotionModalProps) {
  useBodyScrollLock(open);
  const navigate = useNavigate();

  if (!open || !promotion) return null;

  let remainingText = 'Expirando em breve';
  if (promotion.expires_at) {
    const diff = new Date(promotion.expires_at).getTime() - Date.now();
    if (diff > 0) {
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      if (hours > 0) {
        remainingText = `${hours}h ${mins % 60}m restantes`;
      } else {
        remainingText = `${mins} minutos restantes`;
      }
    } else {
      remainingText = 'Divulgação finalizada';
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl z-10 flex flex-col gap-5 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Sparkles size={20} />
              </span>
              <div>
                <h3 className="font-extrabold text-lg">Sua Divulgação</h3>
                <p className="text-xs text-muted-foreground">Status ao vivo da sua campanha</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/40 border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1">
              <Eye className="text-primary mb-1" size={22} />
              <span className="text-2xl font-black text-foreground">{promotion.interactions_count || 0}</span>
              <span className="text-xs text-muted-foreground font-medium">Interações Recebidas</span>
            </div>
            <div className="bg-secondary/40 border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1">
              <Clock className="text-amber-500 mb-1" size={22} />
              <span className="text-xs font-bold text-foreground text-center mt-1">{remainingText}</span>
              <span className="text-xs text-muted-foreground font-medium">Tempo de Destaque</span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-secondary/30 rounded-2xl p-4 border border-border flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Perfil / Link:</span>
              <span className="font-bold text-foreground truncate max-w-[200px]">@{promotion.username}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Plano de Destaque:</span>
              <span className="font-bold uppercase text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">
                {promotion.plan || 'Básico'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button 
              variant="outline"
              onClick={() => window.open(promotion.url, '_blank', 'noopener,noreferrer')}
              className="w-full justify-center font-bold"
            >
              <ExternalLink size={16} className="mr-2" /> Ver no Instagram
            </Button>

            <Button 
              onClick={() => {
                onClose();
                navigate('/create');
              }}
              className="w-full justify-center font-bold"
            >
              <Rocket size={16} className="mr-2" /> Criar Mais Divulgações
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
