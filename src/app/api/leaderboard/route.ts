import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { weekStart } from "@/lib/dates";
import { tierFor } from "@/lib/engine";
import { ensureNickname } from "@/lib/friends";

/**
 * This week's top ten. Players appear under their generated nickname only, and anyone who has hidden themselves from
 * boards is left out of the list (but still has a rank of their own). It is for fun: nothing is awarded for rank, and
 * because anyone can start a new player, it must not be used to decide a prize without extra safeguards.
 */
export async function GET() {
  const me = await currentPlayerId();
  if (!me) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const db = await ready();
  const week = weekStart();
  const rows = await db.query<{ id: string; nickname: string | null; board_visible: boolean; points: number }>(
    `select p.id, p.nickname, p.board_visible,
            (coalesce((select sum(points + bonus_points) from spins s where s.player_id = p.id and s.week_start = $1), 0)
           + coalesce((select sum(points) from set_awards a where a.player_id = p.id and a.week_start = $1), 0)
           + coalesce((select sum(points) from mission_awards m where m.player_id = p.id and m.week_start = $1), 0))::int as points
       from players p
      where exists (select 1 from spins s where s.player_id = p.id and s.week_start = $1)
      order by points desc, p.id limit 500`,
    [week],
  );
  const mine = rows.find((r) => r.id === me);
  const rankOf = (pts: number) => 1 + rows.filter((r) => r.points > pts).length;
  const top = [];
  for (const r of rows.filter((x) => x.board_visible || x.id === me).slice(0, 10)) {
    top.push({ rank: rankOf(r.points), nickname: await ensureNickname(db.query, r.id), tier: tierFor(r.points).current.name, points: r.points, you: r.id === me });
  }
  return NextResponse.json(
    { top, total: rows.length, me: mine ? { rank: rankOf(mine.points), points: mine.points, nickname: await ensureNickname(db.query, me), tier: tierFor(mine.points).current.name } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
