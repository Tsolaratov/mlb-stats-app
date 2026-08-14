import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/db/players";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ players: [] });
  }
  const players = await searchPlayers(q, 10);
  return NextResponse.json({
    players: players.map((p) => ({ id: p.id, full_name: p.full_name })),
  });
}
