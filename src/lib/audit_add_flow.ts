import { supabase } from './supabaseClient';

async function auditAddFlow() {
  console.log("=== AUDIT PRODUCTS IN SUPABASE BY NAME ===");

  const { data: products, error } = await supabase
    .from('products')
    .select('*');

  console.log("Error:", error);
  console.log("Total products count in Supabase:", products?.length);
  if (products) {
    products.forEach((p, idx) => {
      console.log(`Product #${idx + 1}:`, {
        id: p.id,
        uuid: p.uuid,
        sku: p.sku,
        name: p.name,
        quantity: p.quantity,
        cost_price: p.cost_price,
        sale_price: p.sale_price,
        selling_price: p.selling_price
      });
    });
  }
}

auditAddFlow().catch(console.error);
