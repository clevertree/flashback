import {Op} from 'sequelize';
import {BroadcastModel, initDatabase} from '@/db/models';

let started = false;

export function startRelayCleanupJob() {
  if (started) return;
  started = true;
  // Run every 5 minutes
  const intervalMs = 5 * 60 * 1000;
  const tick = async () => {
    try {
      await initDatabase();
      const now = new Date();
      const deleted = await BroadcastModel.destroy({
        where: { expires_at: { [Op.lt]: now } }
      });
      if (deleted > 0) console.log(`[Cleanup] Deleted ${deleted} expired broadcasts`);
    } catch (e) {
      console.error('[Cleanup] Error:', e);
    }
  };
  // Initial delay 30s to avoid startup contention
  setTimeout(() => {
    void tick();
    setInterval(tick, intervalMs).unref?.();
  }, 30 * 1000).unref?.();
}
