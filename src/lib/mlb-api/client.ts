import type {
  MlbPlayersResponse,
  MlbPerson,
  MlbTeamsResponse,
  MlbTeam,
  MlbStandingsResponse,
  MlbTeamRecord,
} from "./types";

const BASE_URL = "https://statsapi.mlb.com/api/v1";

async function mlbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`MLB API request failed: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPlayersBySeason(season: number): Promise<MlbPerson[]> {
  const data = await mlbFetch<MlbPlayersResponse>(`/sports/1/players?season=${season}`);
  return data.people ?? [];
}

export async function fetchTeams(season: number): Promise<MlbTeam[]> {
  const data = await mlbFetch<MlbTeamsResponse>(`/teams?sportId=1&season=${season}`);
  return data.teams ?? [];
}

export async function fetchStandings(season: number): Promise<MlbTeamRecord[]> {
  const data = await mlbFetch<MlbStandingsResponse>(
    `/standings?leagueId=103,104&season=${season}`
  );
  return data.records.flatMap((r) => r.teamRecords);
}
