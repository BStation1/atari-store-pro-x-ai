import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sitypxfezcsyusivbufc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdHlweGZlemNzeXVzaXZidWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MzQ1NjUsImV4cCI6MjA1NjExMDU2NX0.1S48M1Yx-VnThnSp01Xp4p9wW1_Lp9q2M3N4O5P6Q7R';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Testing Supabase Connection & Schema ---');

  // 1. Fetch sample products
  const { data: products, error: pErr } = await supabase.from('products').select('*').limit(5);
  console.log('Products sample:', pErr ? pErr : products);

  // 2. Fetch sample inventory_movements
  const { data: movements, error: mErr } = await supabase.from('inventory_movements').select('*').limit(5);
  console.log('Inventory movements sample/err:', mErr ? mErr : movements);

  // 3. Fetch sample partner_transactions
  const { data: partnerTxs, error: ptErr } = await supabase.from('partner_transactions').select('*').limit(5);
  console.log('Partner transactions sample/err:', ptErr ? ptErr : partnerTxs);

  // 4. Fetch sample repair_part_usages
  const { data: partUsages, error: puErr } = await supabase.from('repair_part_usages').select('*').limit(5);
  console.log('Repair part usages sample/err:', puErr ? puErr : partUsages);
}

main().catch(console.error);
