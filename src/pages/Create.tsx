import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { showNotification } from '../context/NotificationContext';
import { Rocket, Clock, Link as LinkIcon, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

const getInstaLinkType = (link: string) => {
  if (!link) return null;
  if (!link.includes('instagram.com')) return null;
  if (link.includes('/reel/')) return 'reel';
  return /\/(p|tv)\//i.test(link) ? 'post' : 'profile';
};

export default function Create() {
  const { user, refreshUser } = useAuth();
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getCost = () => duration * 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!url.includes('instagram.com')) {
      return showNotification.error('Insira um link válido do Instagram');
    }

    const cost = getCost();
    if ((user.credits || 0) < cost) {
      return showNotification.error('Moedas insuficientes. Adquira mais moedas na Loja.');
    }

    setLoading(true);
    try {
      const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
      const detectedType = getInstaLinkType(url.trim());
      
      let promoUsername = user.username || user.email?.split('@')[0] || 'Usuário';
      if (detectedType === 'profile') {
        const match = url.trim().match(/instagram\.com\/([a-zA-Z0-9._]+)/);
        if (match && !['p', 'reel', 'tv', 'stories', 'explore'].includes(match[1])) {
          promoUsername = match[1];
        }
      }

      await addDoc(collection(db, 'promotions'), {
        user_id: user.id,
        username: promoUsername,
        url: url.trim(),
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        cost,
        plan: user.plan_type || 'basic',
        interactions_count: 0
      });

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        credits: increment(-cost)
      });

      showNotification.success('Divulgação criada com sucesso!');
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      console.error('Error creating promotion:', err);
      showNotification.error(err.message || 'Erro ao criar divulgação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full pb-20">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="text-primary" /> Impulsionar
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Crie sua divulgação e ganhe visibilidade</p>
      </div>

      <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 flex gap-3 text-sm items-start">
        <Info className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" size={20} />
        <div className="flex flex-col gap-1">
          <p className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600 animate-pulse">Atenção: Necessário Perfil Público</p>
          <p className="text-orange-900/90 dark:text-orange-200/90 font-medium">Para impulsionar a sua conta (seja feed, reels ou perfil), primeiro <strong>certifique-se de não estar bloqueado ou com a conta privada</strong>. Perfis privados não exibem o visualizador e perdem o engajamento na plataforma.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-card border border-border p-5 rounded-3xl shadow-sm">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium ml-1">Link do Post ou Perfil</label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="https://instagram.com/..." 
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="pl-10"
              required
            />
          </div>
          {getInstaLinkType(url) === 'post' && <p className="text-xs ml-1 font-medium text-green-500">✓ Tipo detectado: Divulgação de Postagem (Curtidas)</p>}
          {getInstaLinkType(url) === 'reel' && <p className="text-xs ml-1 font-medium text-purple-500">✓ Tipo detectado: Divulgação de Reel (Visualizações)</p>}
          {getInstaLinkType(url) === 'profile' && <p className="text-xs ml-1 font-medium text-blue-500">✓ Tipo detectado: Divulgação de Perfil (Seguidores)</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium ml-1 flex items-center gap-2">
            <Clock size={16} /> Tempo de Destaque
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { m: 1, label: '1 min', c: 5 },
              { m: 2, label: '2 min', c: 10 },
              { m: 5, label: '5 min', c: 25 },
              { m: 11, label: '11 min', c: 55 },
              { m: 25, label: '25 min', c: 125 },
              { m: 57, label: '57 min', c: 285 },
              { m: 128, label: '2h 8m', c: 640 },
              { m: 286, label: '4h 46m', c: 1430 },
              { m: 642, label: '10h 42m', c: 3210 },
              { m: 1440, label: '24 horas', c: 7200 },
            ].map(opt => (
              <button
                key={opt.m}
                type="button"
                onClick={() => setDuration(opt.m)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                  duration === opt.m 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : 'bg-background border-border text-muted-foreground hover:bg-secondary'
                }`}
              >
                <span className="font-semibold text-sm">{opt.label}</span>
                <span className="text-[10px] opacity-80">{opt.c.toLocaleString('pt-BR')} moedas</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Custo Total</span>
            <span className={`font-bold text-lg flex items-center gap-1 ${(user?.credits || 0) < getCost() ? 'text-destructive' : 'text-primary'}`}>
              {getCost().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <AnimatedIcon type="coin" size={18} />
            </span>
          </div>
          <Button 
            type="submit" 
            isLoading={loading}
            disabled={(user?.credits || 0) < getCost()}
            size="lg"
          >
            Publicar
          </Button>
        </div>
        
        {(user?.credits || 0) < getCost() && (
          <p className="text-xs text-destructive text-center mt-[-10px]">
            Créditos insuficientes. Interaja ou compre mais na Loja.
          </p>
        )}
      </form>
    </div>
  );
}
