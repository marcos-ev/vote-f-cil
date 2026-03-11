import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Spade, Plus, Users, LogOut, ArrowRight, Loader2, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
}

const generateRoomId = () => Math.random().toString(36).substring(2, 8);

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user!.id);

    if (data && data.length > 0) {
      const teamIds = data.map(d => d.team_id);
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);
      setTeams(teamsData || []);
    } else {
      setTeams([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, [user]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);

    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name: teamName.trim(), description: teamDesc.trim() || null, created_by: user!.id })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar equipe');
      setCreating(false);
      return;
    }

    // Add creator as member
    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user!.id,
      role: 'admin',
    });

    toast.success('Equipe criada!');
    setTeamName('');
    setTeamDesc('');
    setShowCreate(false);
    setCreating(false);
    fetchTeams();
  };

  const handleStartRoom = (teamId: string) => {
    const roomId = generateRoomId();
    navigate(`/sala/${roomId}?mod=1&team=${teamId}`);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Spade className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">CD2 Poker Planning</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{profile?.display_name}</span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Suas Equipes</h1>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nova Equipe
          </Button>
        </div>

        {/* Create team form */}
        {showCreate && (
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-medium">Criar Nova Equipe</h3>
            <Input
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Nome da equipe (ex: Squad N3, Projetos)"
              className="bg-secondary border-border"
            />
            <Input
              value={teamDesc}
              onChange={e => setTeamDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="bg-secondary border-border"
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateTeam} disabled={!teamName.trim() || creating} className="font-semibold">
                {creating ? 'Criando...' : 'Criar Equipe'}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Teams list */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Você ainda não faz parte de nenhuma equipe</p>
            <p className="text-xs text-muted-foreground/60">Crie uma equipe ou peça o link de convite de alguém</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {teams.map(team => (
              <div key={team.id} className="bg-card rounded-xl border border-border p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{team.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/equipe/${team.id}`)}
                    className="gap-1.5 text-xs"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Ver Equipe
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleStartRoom(team.id)}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Iniciar Sala
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
