import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPlayersBySeason, fetchTeams, fetchStandings } from "@/lib/mlb-api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPlayersBySeason", () => {
  it("returns the people array from the response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ people: [{ id: 1, fullName: "Test" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const players = await fetchPlayersBySeason(2026);

    expect(players).toEqual([{ id: 1, fullName: "Test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/sports/1/players?season=2026"
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchPlayersBySeason(2026)).rejects.toThrow("MLB API request failed: 500");
  });
});

describe("fetchTeams", () => {
  it("returns the teams array", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ teams: [{ id: 119, name: "Dodgers" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const teams = await fetchTeams(2026);
    expect(teams).toEqual([{ id: 119, name: "Dodgers" }]);
  });
});

describe("fetchStandings", () => {
  it("flattens teamRecords across all division records", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [
          { teamRecords: [{ team: { id: 1 } }] },
          { teamRecords: [{ team: { id: 2 } }, { team: { id: 3 } }] },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchStandings(2026);
    expect(records).toHaveLength(3);
  });
});
