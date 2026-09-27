import { createUser } from '../src/crud'
import { createDb } from '../src/db'

async function sampleSeed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')
  const db = createDb(databaseUrl)

  const user = await createUser(db, {
    name: 'Alice',
    email: 'alice1234@example.com'
  });
  console.log(`complete sampleSeed, created user is`, user);
}

sampleSeed();
