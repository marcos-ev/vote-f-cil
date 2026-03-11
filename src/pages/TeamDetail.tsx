import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Spade, ArrowLeft, Users, Copy, Check, Loader2, ArrowRight, UserPlus, History, Download,
} from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  user_id: string;
  role: string;
  profiles: { display_name: string } | null;
}

interface VoteSession {
  id: string;
  story_name: string;
  final_estimate: string | null;
  created_at: string;
  room_id: string;
}

export default function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<{ id: string; name: string; description: string | null; created_by: string } | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [sessions, setSessions] = useState<VoteSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId!)
        .single();
      setTeam(teamData);

      const { data: membersData } = await supabase
        .from('team_members')
        .select('user_id, role, profiles(display_name)')
        .eq('team_id', teamId!) as any;
      setMembers(membersData || []);

      const { data: sessionsData } = await supabase
        .from('vote_sessions')
        .select('*')
        .eq('team_id', teamId!)
        .order('created_at', { ascending: false });
      setSessions(sessionsData || []);

      setLoading(false);
    };
    fetchData();
  }, [teamId]);

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/convite/${teamId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link de convite copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCsv = () => {
    const header = 'História,Estimativa,Data\n';
    const rows = sessions
      .filter(s => s.final_estimate)
      .map(s => `"${s.story_name}","${s.final_estimate}","${new Date(s.created_at).toLocaleDateString('pt-BR')}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${team?.name || 'equipe'}-historico.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateRoomId = () => Math.random().toString(36).substring(2, 8);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Equipe não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Spade className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">CD2 Poker Planning</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Team header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{team.name}</h1>
            {team.description && <p className="text-muted-foreground text-sm mt-1">{team.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyInvite} className="gap-1.5 text-xs">
              {copied ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Convidar'}
            </Button>
            <Button size="sm" onClick={() => navigate(`/sala/${generateRoomId()}?mod=1&team=${teamId}`)} className="gap-1.5 text-xs font-semibold">
              <ArrowRight className="w-3.5 h-3.5" />
              Iniciar Sala
            </Button>
          </div>
        </div>

        {/* Members */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Membros ({members.length})
          </h3>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-md">
                <span className="text-sm">{m.profiles?.display_name || 'Usuário'}</span>
                <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vote history */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Histórico de Votações
            </h3>
            {sessions.filter(s => s.final_estimate).length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </Button>
            )}
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma votação realizada ainda</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-md">
                  <div className="flex-1 min-w-0 mr-3">
                    <span className="text-sm truncate block">{s.story_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-primary text-sm flex-shrink-0">
                    {s.final_estimate || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
