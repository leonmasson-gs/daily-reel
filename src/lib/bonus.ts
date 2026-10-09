import type { Query } from "./db";
import { config } from "./config";
import { tierFor } from "./engine";
import { weekPoints } from "./game";

export type BonusInput = { accuracy?: number; skip?: boolean };

/** The label and points for how close to the middle the player stopped the marker (0 = edge, 1 = dead centre). */
export function bonusFor(accuracy: number): { label: string; points: number } {
  const a = Math.max(0, Math.min(1, Number.isFinite(accuracy) ? accuracy : 0));
  for (const b of config.bonus.bands) if (a >= b.min) return { label: b.label, points: b.points };
  const last = config.bonus.bands[config.bonus.bands.length - 1];
  return { label: last.label, points: last.points };
}

/**
 * A triple match earns one bonus round. The player can play it (stop a moving marker) or take the standard bonus,
 * which is never worse than a typical result, so nobody is punished for not being able to play. The points are small,
 * and the round has to be claimed within a few minutes of the spin that earned it.
 */
export async function claimBonus(q: Query, playerId: string, input: BonusInput) {
  const rows = await q<{ id: number; week_start: string }>(
    `select id, week_start from spins
      where player_id = $1 and outcome = 'triple' and not bonus_claimed
        and created_at > now() - ($2 || ' minutes')::interval
      order by id desc limit 1`,
    [playerId, String(config.bonus.windowMinutes)],
  );
  if (!rows.length) return { kind: "none" as const };
  const { id, week_start } = rows[0];

  const result = input.skip
    ? { label: "Standard bonus", points: config.bonus.skipPoints }
    : bonusFor(Number(input.accuracy));

  const before = await weekPoints(q, playerId, week_start);
  const claimed = await q<{ id: number }>(
    "update spins set bonus_points = $2, bonus_claimed = true where id = $1 and not bonus_claimed returning id",
    [id, result.points],
  );
  if (!claimed.length) return { kind: "none" as const }; // another request claimed it first
  const after = await weekPoints(q, playerId, week_start);
  const t0 = tierFor(before).current, t1 = tierFor(after).current;
  return { kind: "ok" as const, ...result, tierUp: t1.id !== t0.id ? { from: t0.name, to: t1.name } : null };
}
