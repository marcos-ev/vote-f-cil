import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spade, Users, Zap } from 'lucide-react';

const generateRoomId = () => Math.random().toString(36).substring(2, 8);

export default function Home() {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('poker-user-name');
    if (saved) setName(saved);
  }, []);

  const handleCreate = () => {
    if (!name.trim()) return;
    localStorage.setItem('poker-user-name', name.trim());
    const roomId = generateRoomId();
    navigate(`/sala/${roomId}?mod=1`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
            <Spade className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Planning Poker</h1>
          <p className="text-muted-foreground text-sm">
            Estimativas ágeis em tempo real. Sem cadastro, sem complicação.
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Seu nome</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Digite seu nome..."
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full gap-2 font-semibold"
          >
            <Zap className="w-4 h-4" />
            Criar Sala
          </Button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Ou entre numa sala compartilhando o link
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Dados efêmeros • Sem armazenamento permanente
        </p>
      </div>
    </div>
  );
}
