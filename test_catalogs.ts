import { supabase } from './src/lib/supabaseClient';

async function testPostgresCatalogs() {
  console.log("=== Testing Postgres Catalog Queries via PostgREST ===");

  const t1 = await supabase.from('pg_tables' as any).select('*');
  console.log("pg_tables:", t1.error?.message || t1.data?.length);

  const t2 = await supabase.from('information_schema.tables' as any).select('*');
  console.log("information_schema.tables:", t2.error?.message || t2.data?.length);
}

testPostgresCatalogs().catch(console.error);
