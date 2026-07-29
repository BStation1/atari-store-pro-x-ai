import { supabase } from './src/lib/supabaseClient';

async function checkProject() {
  console.log("=== Environment Variables Check ===");
  console.log("process.env keys:", Object.keys(process.env).filter(k => !k.includes("SECRET") && !k.includes("KEY")));
  console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL);
  
  // Try querying rpcs or tables
  const { data: dbData, error: dbErr } = await supabase.rpc('get_auth_user_role');
  console.log("RPC get_auth_user_role:", dbData, dbErr);
}

checkProject().catch(console.error);
