import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Get token from URL path: /track/:tokenId
const pathParts = window.location.pathname.split('/');
const tokenId = pathParts[pathParts.length - 1] || null;

const tokenNumberEl = document.getElementById('token-number');
const statusBadgeEl = document.getElementById('status-badge');
const statusMessageEl = document.getElementById('status-message');
const progressFillEl = document.getElementById('progress-fill');

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    message: 'Your order has been received.',       progress: '10%',  class: '' },
  preparing:  { label: 'Preparing',  message: 'Your order is being prepared.',         progress: '40%',  class: '' },
  ready:      { label: 'Ready!',     message: 'Your order is ready to collect!',       progress: '90%',  class: 'ready' },
  served:     { label: 'Served',     message: 'Your order has been served. Enjoy!',    progress: '100%', class: 'served' },
  cancelled:  { label: 'Cancelled',  message: 'Your order has been cancelled.',        progress: '0%',   class: '' },
};

function updateUI(status, token) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  if (tokenNumberEl) tokenNumberEl.textContent = token || '--';
  if (statusBadgeEl) {
    statusBadgeEl.textContent = config.label;
    statusBadgeEl.className = 'status-badge ' + config.class;
  }
  if (statusMessageEl) statusMessageEl.textContent = config.message;
  if (progressFillEl) progressFillEl.style.width = config.progress;
}

async function loadOrder() {
  if (!tokenId) {
    updateUI('pending', '--');
    return;
  }

  const { data, error } = await supabase
    .from('orders')
    .select('token_number, status')
    .eq('token_id', tokenId)
    .single();

  if (error || !data) {
    console.error('Order not found', error);
    return;
  }

  updateUI(data.status, data.token_number);
}

// Subscribe to real-time updates
function subscribeToOrder() {
  if (!tokenId) return;

  supabase
    .channel('order-status-' + tokenId)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: 'token_id=eq.' + tokenId,
    }, (payload) => {
      updateUI(payload.new.status, payload.new.token_number);
    })
    .subscribe();
}

loadOrder();
subscribeToOrder();
