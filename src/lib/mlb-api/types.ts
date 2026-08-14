export interface MlbPlayersResponse {
  people: MlbPerson[];
}

export interface MlbPerson {
  id: number;
  fullName: string;
  primaryPosition?: { abbreviation: string };
  birthDate?: string;
  mlbDebutDate?: string;
  active?: boolean;
}

export interface MlbTeamsResponse {
  teams: MlbTeam[];
}

export interface MlbTeam {
  id: number;
  name: string;
  abbreviation: string;
  league?: { name: string };
  division?: { name: string };
}

export interface MlbStandingsResponse {
  records: MlbStandingsRecord[];
}

export interface MlbStandingsRecord {
  teamRecords: MlbTeamRecord[];
}

export interface MlbTeamRecord {
  team: { id: number };
  wins: number;
  losses: number;
  winningPercentage: string;
  divisionRank: string;
  gamesBack: string;
}

export interface MlbPlayerStatsResponse {
  stats: MlbStatGroup[];
}

export interface MlbStatGroup {
  group: { displayName: string };
  type: { displayName: string };
  splits: MlbStatSplit[];
}

export interface MlbStatSplit {
  season?: string;
  team?: { id: number };
  stat: Record<string, string | number | undefined>;
}
