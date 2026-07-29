import { supabase } from './src/lib/supabaseClient';

async function testRpcs() {
  console.log("=== Testing RPCs on Supabase ===");

  // Check check_has_owner
  const r1 = await supabase.rpc('check_has_owner');
  console.log("check_has_owner:", r1);

  // Check get_auth_user_role
  const r2 = await supabase.rpc('get_auth_user_role');
  console.log("get_auth_user_role:", r2);

  // Check is_owner
  const r3 = await supabase.rpc('is_owner');
  console.log("is_owner:", r3);

  // Try reset_operational_data or restore_backup_data if any
  const r4 = await supabase.rpc('get_public_tracking_order', { p_token: 'test', p_phone: '123' });
  console.log("get_public_tracking_order:", r4);
}

testRpcs().catch(console.error);
