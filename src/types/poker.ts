export interface Participant {
  id: string;
  name: string;
  role: "moderator" | "player";
  vote: string | null;
  hasVoted: boolean;
}

export interface Story {
  id?: number;
  name: string;
  finalEstimate: string | null;
}

export interface StoryVoteSnapshot {
  id: string;
  name: string;
  role: "moderator" | "player";
  vote: string | null;
  hasVoted: boolean;
}

export interface StoryDetail {
  id: number;
  storyName: string;
  finalEstimate: string | null;
  stats: {
    votesCount: number;
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  voteSnapshot: StoryVoteSnapshot[];
  finalizedAt: number;
}

export type Role = Participant["role"];

export interface RoomState {
  roomId: string;
  storyName: string;
  isVoting: boolean;
  isRevealed: boolean;
  participants: Record<string, Participant>;
  history: Story[];
  updatedAt: number;
}

export interface Squad {
  id: string;
  name: string;
  invite_code: string;
  canDelete?: boolean;
}

export const DECK = ["0", "1", "2", "3", "5", "8", "13", "20+", "∞", "?", "☕"] as const;
export type CardValue = typeof DECK[number];

export const CARD_GUIDANCE: Record<CardValue, string> = {
  "0": "A tarefa nao precisa ser feita por algum motivo (talvez ja esteja pronta).",
  "1": "A tarefa e muito simples, geralmente menos de 1 hora de desenvolvimento.",
  "2": "A tarefa e simples e costuma caber em menos de um turno de trabalho.",
  "3": "A tarefa e simples, mas trabalhosa; tende a consumir ao menos um turno completo.",
  "5": "A tarefa tem complexidade media e costuma levar cerca de 1 dia de desenvolvimento.",
  "8": "A tarefa e complexa e pode exigir estudo ou bastante implementacao; tende a levar de 2 a 3 dias.",
  "13": "A tarefa e muito complexa ou longa; pode consumir cerca de uma semana de um desenvolvedor.",
  "20+": "A tarefa esta complexa demais para estimar com precisao. Recomenda-se quebrar em partes menores.",
  "∞": "Sem viabilidade no escopo atual. Se o time nao usar infinito, use 100 para sinalizar este caso.",
  "?": "A tarefa nao ficou clara. E necessario esclarecer melhor antes de estimar.",
  "☕": "Pausa rapida para retomar com foco. Use com moderacao durante a rodada.",
};
