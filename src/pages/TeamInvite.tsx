import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Spade, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TeamInvite() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // We need to fetch team name — but user might not be a member yet.
    // Use a direct query — RLS will block. Let's just show the team ID.
    setLoading(false);
  }, [teamId]);

  const handleJoin = async () => {
    if (!user) {
      toast.error('Faça login primeiro');
      navigate('/auth');
      return;
    }
    setJoining(true);

    const { error } = await supabase.from('team_members').insert({
      team_id: teamId!,
      user_id: user.id,
      role: 'membro',
    });

    if (error) {
      if (error.code === '23505') {
        toast.info('Você já faz parte desta equipe');
      } else {
        toast.error('Erro ao entrar na equipe');
      }
    } else {
      toast.success('Você entrou na equipe!');
    }
    navigate('/');
    setJoining(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <Spade className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">CD2 Poker Planning</h1>
          <p className="text-muted-foreground text-sm">Você foi convidado para uma equipe</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <p className="text-sm">Deseja entrar nesta equipe?</p>
          <Button onClick={handleJoin} disabled={joining} className="w-full gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {joining ? 'Entrando...' : 'Entrar na Equipe'}
          </Button>
        </div>
      </div>
    </div>
  );
}
