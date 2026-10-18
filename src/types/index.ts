export interface NicknameWithLine {
  nickname: string;
  line?: number; // Optional line value
  rakeback?: number; // Optional rakeback in percent (30 = 30%)
  owner?: boolean; // Whether the player is an owner
}

// Owners always get 100% rakeback
export const OWNER_RAKEBACK = 100;

export interface AgentInput {
  name: string; // Agent nickname, matched against the "Agent" → "Nickname" column in "Member Statistics"
  rakeShare: number; // Agent's share of the total rake of his players and himself, in percent (30 = 30%)
  previousBalance: number; // "Saldo fra før": the agent's balance from before, added to his "Ny Saldo" (0 if not entered)
}

/**
 * One editable row in the agents list. Rake % is kept as raw text so partially typed values are not lost.
 */
export interface AgentRow {
  id: number;
  name: string;
  rakeShareText: string;
  previousBalanceText: string; // "Saldo fra før", optional; may be negative
}

export interface AppState {
  file: File | null;
  workbook: any | null; // XLSX.WorkBook
  isProcessing: boolean;
  isFiltered: boolean;
  nicknames: NicknameWithLine[];
}
