import { db } from 'sdk';
import { eq } from 'sdk/db';
import { adminStates } from '../../schema.js';

export async function getAdminState(adminId) {
  return db
    .select()
    .from(adminStates)
    .where(eq(adminStates.adminId, Number(adminId)))
    .get();
}

export async function setAdminState(adminId, state, payload = null) {
  await db
    .insert(adminStates)
    .values({ adminId: Number(adminId), state, payload })
    .onConflictDoUpdate({
      target: adminStates.adminId,
      set: { state, payload, updatedAt: new Date() },
    })
    .run();
}

export async function clearAdminState(adminId) {
  await db.delete(adminStates).where(eq(adminStates.adminId, Number(adminId))).run();
}
