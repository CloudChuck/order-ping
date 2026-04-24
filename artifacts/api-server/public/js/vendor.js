import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let selectedOrderId = null;
const ordersListEl = document.getElementById('orders-list');
const btnReady = document.getElementById('btn-ready');
const btnServed = document.getElementById('btn-served');
const btnCancel = document.getElementById('btn-cancel');

function renderOrder(order) {
  const div = document.createElement('div');
  div.className = 'order-item';
  div.style.cssText = 'padding:0.75rem;border:2px solid #ddd;border-radius:8px;cursor:pointer;background:white;';
  div.textContent = `Token #${order.token_number} — ${order.status}`;
  div.dataset.id = order.id;
  div.addEventListener('click', () => {
    selectedOrderId = order.id;
    document.querySelectorAll('.order-item').forEach(el => el.style.borderColor = '#ddd');
    div.style.borderColor = '#e23744';
  });
  return div;
}

async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, token_number, status')
    .not('status', 'in', '(served,cancelled)')
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  if (ordersListEl) {
    ordersListEl.innerHTML = '';
    (data || []).forEach(order => ordersListEl.appendChild(renderOrder(order)));
  }
}

async function updateStatus(status) {
  if (!selectedOrderId) { alert('Please select an order first.'); return; }
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', selectedOrderId);
  if (error) { console.error(error); return; }
  selectedOrderId = null;
  loadOrders();
}

// Subscribe to real-time changes
supabase
  .channel('vendor-orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
  }, () => loadOrders())
  .subscribe();

if (btnReady) btnReady.addEventListener('click', () => updateStatus('ready'));
if (btnServed) btnServed.addEventListener('click', () => updateStatus('served'));
if (btnCancel) btnCancel.addEventListener('click', () => updateStatus('cancelled'));

loadOrders();
