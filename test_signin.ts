import { supabase } from './src/lib/supabaseClient';

async function testSignInExistingUsers() {
  const usersToTry = [
    { email: 'admin@atari.com', pass: 'Atari@2025' },
    { email: 'admin@atari.com', pass: 'Password123!' },
    { email: 'testuser_1785334906643@atari.com', pass: 'Atari@2025' },
    { email: 'testuser_1785334906643@atari.com', pass: 'Password123!' },
    { email: 'elbannafc@gmail.com', pass: 'Atari@2025' },
    { email: 'elbannafc@gmail.com', pass: 'Password123!' },
    { email: 'owner@atari.com', pass: 'Atari@2025' },
    { email: 'reception@atari.com', pass: 'Atari@2025' },
    { email: 'manager@atari.com', pass: 'Atari@2025' }
  ];

  for (const u of usersToTry) {
    console.log(`Trying signInWithPassword for ${u.email} with pass: ${u.pass}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: u.email,
      password: u.pass
    });

    if (error) {
      console.log(`  -> Error: [${error.status}] ${error.message}`);
    } else if (data.session) {
      console.log(`  -> SUCCESS! User ID: ${data.session.user.id}`);
      return data.session;
    }
  }

  console.log("None of the standard passwords worked directly. Testing other options...");
}

testSignInExistingUsers().catch(console.error);
