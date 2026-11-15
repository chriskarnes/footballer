import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swapDrill } from '../src/lib/session-builder';
import type { BuiltSession, Exercise } from '../src/lib/types';

const drill = (id: string, seconds: number) => ({
  id, name: id, total_seconds: seconds, touches: 50, touches_per_min: 40, focus_areas: ['core'], primary_focus: 'core',
  equipment: [], space_required: 'small', can_do_at_home: true, gym_required: false, level: 'Beginner', intensity: 'low', program_id: 'p',
}) as unknown as Exercise;

// A short list done three times over. The swap worked out the room from the
// whole session's minutes, so a drill as long as the session could come in,
// and 15 minutes became 45.
test('swapping a drill in a session done in rounds keeps it to its length', () => {
  const spec = { minutes: 15, focus: ['core'], place: 'any', level: 'any', priority: 'balanced' } as BuiltSession['spec'];
  const drills = ['a', 'b', 'c', 'd'].map((id) => drill(id, 70));
  const built: BuiltSession = { spec, drills, rounds: 3, totalSeconds: 280 * 3, totalTouches: 600, poolSize: 6 };
  const all = [...drills, drill('long', 690), drill('short', 80)];
  for (let i = 0; i < 30; i++) {
    const next = swapDrill(all, built, 1);
    assert.ok(next.totalSeconds <= spec.minutes * 60, `${next.totalSeconds}s is over ${spec.minutes} min`);
    assert.notEqual(next.drills[1].id, 'long');
  }
});
