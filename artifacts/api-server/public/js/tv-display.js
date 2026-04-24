import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const preparingListEl = document.getElementById('preparing-list');
const readyListEl = document.getElementById('ready-list');
const servedListEl = document.getElementById('served-list');

function createTokenChip(tokenNumber) {
  const chip = document.createElement('div');
  chip.className = 'token-chip';
  chip.textContent = tokenNumber;
  return chip;
}

async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('token_number, status')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { console.error(error); return; }

  if (preparingListEl) preparingListEl.innerHTML = '';
  if (readyListEl) readyListEl.innerHTML = '';
  if (servedListEl) servedListEl.innerHTML = '';

  (data || []).forEach(order => {
    const chip = createTokenChip(order.token_number);
    if (order.status === 'preparing' || order.status === 'pending') {
      preparingListEl?.appendChild(chip);
    } else if (order.status === 'ready') {
      readyListEl?.appendChild(chip);
    } else if (order.status === 'served') {
      servedListEl?.appendChild(chip);
    }
  });
}

// Subscribe to real-time changes
supabase
  .channel('tv-display-orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
  }, () => loadOrders())
  .subscribe();

loadOrders();

// Auto-refresh every 30 seconds as a fallback
setInterval(loadOrders, 30000);
