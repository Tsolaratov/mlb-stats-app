import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/db/players";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (q.length < 2) {
      return NextResponse.json({ players: [] });
    }
    const players = await searchPlayers(q, 10);
    return NextResponse.json({
      players: players.map((p) => ({ id: p.id, full_name: p.full_name })),
    });
  } catch (err) {
    console.error("Player search failed:", err);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
