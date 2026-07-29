import { supabase } from './src/lib/supabaseClient';

async function scanFunctions() {
  const funcCandidates = [
    'confirm_user',
    'confirm_email',
    'auto_confirm',
    'admin_create_user',
    'create_auth_user',
    'login',
    'sign_in',
    'bypass_rls',
    'insert_guest_order',
    'insert_repair_order',
    'create_guest_repair_order',
    'reset_operational_data',
    'get_auth_user_role',
    'is_owner',
    'owner_exists'
  ];

  for (const fn of funcCandidates) {
    const { data, error } = await supabase.rpc(fn as any);
    console.log(`RPC [${fn}]:`, data, error ? `(${error.code}) ${error.message}` : 'SUCCESS');
  }
}

scanFunctions().catch(console.error);
