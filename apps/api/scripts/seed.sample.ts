import { createUser } from "../src/crud";

async function sampleSeed() {
  const user = await createUser({
    name: 'Alice',
    email: 'alice1234@example.com'
  });
  console.log(`complete sampleSeed, created user is`, user);
}

sampleSeed();

