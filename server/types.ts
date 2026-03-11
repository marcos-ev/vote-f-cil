export type Role = "moderator" | "player";

export interface ParticipantState {
  id: string;
  name: string;
  role: Role;
  vote: string | null;
  hasVoted: boolean;
}

export interface StoryState {
  name: string;
  finalEstimate: string | null;
}

export interface RoomState {
  roomId: string;
  storyName: string;
  isVoting: boolean;
  isRevealed: boolean;
  participants: Record<string, ParticipantState>;
  history: StoryState[];
  updatedAt: number;
}

export interface Squad {
  id: string;
  name: string;
  invite_code: string;
}
