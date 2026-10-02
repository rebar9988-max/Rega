import pg from "pg";

/** Stands in for clicking the confirmation link of the e-mail (the e2e server has no mail provider, so no mail is sent). */
export async function confirmEmailOf(email: string) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`update "User" set "emailVerified" = now() where email = $1 and "emailVerified" is null`, [email]);
  } finally {
    await client.end();
  }
}

export const UNCONFIRMED_NOTICE = "Bestätigungs-E-Mail gerade nicht senden";
