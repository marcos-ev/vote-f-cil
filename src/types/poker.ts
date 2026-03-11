export interface Participant {
  id: string;
  name: string;
  role: 'moderator' | 'player';
  vote: string | null;
  hasVoted: boolean;
}

export interface Story {
  name: string;
  finalEstimate: string | null;
}

export interface RoomState {
  storyName: string;
  isVoting: boolean;
  isRevealed: boolean;
  participants: Record<string, Participant>;
  history: Story[];
}

export const DECK = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'] as const;
export type CardValue = typeof DECK[number];
