import { getPrisma } from "../db/prisma.js";

export async function initStore() {
  await getPrisma().$connect();
}
