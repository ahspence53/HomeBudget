/* Home Budget Tracker — app.js
   Option A: Clean reset — clears older storage and uses new schema.
   Features:
   - Unique id per transaction
   - parentId for projected entries
   - Projections created only once at add-time
   - Delete single entry and delete series
   - LocalStorage persistence
   - Date format dd-MMM-yyyy (e.g. 01-Jan-2026)
   - Frequencies: irregular, monthly, four-weekly
   - Projection window: 24 months from parent transaction date
*/

// ---------- CONFIG ----------
const STORAGE_KEY = 'homeBudgetTransactions_v2';
const PROJECTION_MONTHS = 24; // forward projection window
// -----------------------------

// Utility functions
const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateISOToDisplay(isoDate) {
  // isoDate: YYYY-MM-DD
  const d = new Date(isoDate + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2,'0');
  const m = monthsShort[d.getMonth()];
  const yy = d.getFullYear();
  return `${dd}-${m}-${yy}`;
}

function addMonths(dateObj, months) {
  const d = new Date(dateObj);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // preserve end-of-month behaviour
  if (d.getDate() < day) {
    d.setDate(0); // go to last day of previous month
  }
  return d;
}

function nextDateByFrequency(dateObj, freq) {
  const d = new Date(dateObj);
  if (freq === 'monthly') return addMonths(d, 1);
  if (freq === 'four-weekly') {
    d.setDate(d.getDate() + 28);
    return d;
  }
  return null;
}

function ymdFromDate(d) {
  const year = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${m}-${day}`;
}

function uid(prefix='id') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
}

// ---------- STORAGE (clean reset) ----------
function resetStorage() {
  localStorage.removeItem(STORAGE_KEY);
  const initial = { transactions: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
}

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    resetStorage();
    return { transactions: [] };
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.transactions)) {
      resetStorage();
      return { transactions: [] };
    }
    return obj;
  } catch (e) {
    resetStorage();
    return { transactions: [] };
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Immediately enforce clean reset (Option A)
resetStorage(); // user asked for clean reset

// ---------- APP ----------
const form = document.getElementById('txForm');
const titleInput = document.getElementById('title');
const amountInput = document.getElementById('amount');
const typeInput = document.getElementById('type');
const freqInput = document.getElementById('frequency');
const dateInput = document.getElementById('date');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const txTableBody = document.querySelector('#txTable tbody');

let store = loadStore();

function render() {
  store = loadStore();
  txTableBody.innerHTML = '';
  // sort by date ascending
  const rows = [...store.transactions].sort((a,b) => new Date(a.date) - new Date(b.date));
  rows.forEach(tx => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = fmtDateISOToDisplay(tx.date);

    const tdTitle = document.createElement('td');
    tdTitle.innerHTML = tx.title + (tx.parentId ? `<div class="small-muted">child of ${tx.parentId}</div>` : '');

    const tdType = document.createElement('td');
    tdType.textContent = tx.type;

    const tdAmount = document.createElement('td');
    tdAmount.textContent = Number(tx.amount).toFixed(2);
    if (tx.type === 'expense') tdAmount.classList.add('amount-negative');

    const tdFreq = document.createElement('td');
    tdFreq.textContent = tx.frequency || '';

    const tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';

    const btnDelSingle = document.createElement('button');
    btnDelSingle.textContent = '🗑️ Delete';
    btnDelSingle.className = 'btn-delete-single';
    btnDelSingle.onclick = () => {
      deleteSingle(tx.id);
    };

    const btnDelSeries = document.createElement('button');
    btnDelSeries.textContent = '🗂️ Delete series';
    btnDelSeries.className = 'btn-delete-series';
    btnDelSeries.onclick = () => {
      deleteSeries(tx.id);
    };

    tdActions.appendChild(btnDelSingle);
    tdActions.appendChild(btnDelSeries);

    tr.appendChild(tdDate);
    tr.appendChild(tdTitle);
    tr.appendChild(tdType);
    tr.appendChild(tdAmount);
    tr.appendChild(tdFreq);
    tr.appendChild(tdActions);

    txTableBody.appendChild(tr);
  });
}

// Delete single row by id
function deleteSingle(id) {
  store = loadStore();
  const idx = store.transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  store.transactions.splice(idx, 1);
  saveStore(store);
  render();
}

// Delete series: if clicked on a child, find its parentId and delete parent and all children
// If clicked on a parent (a transaction that has frequency !== 'irregular' and projectionsCreated true), delete parent and children
function deleteSeries(id) {
  store = loadStore();
  const tx = store.transactions.find(t => t.id === id);
  if (!tx) return;
  let parentId = tx.parentId || tx.id;
  // if tx is a child, parentId is tx.parentId
  // if tx is a parent, we delete parent and all children with parentId === parentId
  store.transactions = store.transactions.filter(t => {
    // keep only those not matching the parent group
    if (t.id === parentId) return false;
    if (t.parentId && t.parentId === parentId) return false;
    return true;
  });
  saveStore(store);
  render();
}


// Add transaction and if recurring, create projections (only once)
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const title = titleInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const type = typeInput.value;
  const frequency = freqInput.value;
  const dateISO = dateInput.value; // YYYY-MM-DD

  if (!title || !dateISO || isNaN(amount)) {
    alert('Please complete title, amount and date.');
    return;
  }

  // create parent transaction
  const id = uid('tx');
  const parentTx = {
    id,
    parentId: null,
    title,
    amount: Number(amount),
    type,
    frequency, // 'monthly', 'four-weekly', 'irregular'
    date: dateISO,
    projectionsCreated: false, // marker
    createdAt: new Date().toISOString()
  };

  store = loadStore();
  store.transactions.push(parentTx);

  // if recurring, create projection children now (only once)
  if (frequency === 'monthly' || frequency === 'four-weekly') {
    const baseDate = new Date(dateISO + 'T00:00:00');
    const endDate = addMonths(baseDate, PROJECTION_MONTHS);
    let next = null;
    // create subsequent instances AFTER the parent date up to endDate inclusive
    next = nextDateByFrequency(baseDate, frequency);
    while (next && next <= endDate) {
      const child = {
        id: uid('tx'),
        parentId: id,
        title,
        amount: Number(amount),
        type,
        frequency,
        date: ymdFromDate(next),
        createdAt: new Date().toISOString()
      };
      store.transactions.push(child);
      next = nextDateByFrequency(next, frequency);
    }
    // mark projectionsCreated on parent
    const parentIndex = store.transactions.findIndex(t => t.id === id);
    if (parentIndex !== -1) store.transactions[parentIndex].projectionsCreated = true;
  }

  saveStore(store);
  render();

  // clear form fields (preserve frequency? we'll clear everything)
  titleInput.value = '';
  amountInput.value = '';
  typeInput.value = 'expense';
  freqInput.value = 'irregular';
  dateInput.value = '';
});

// clear storage manually (extra safety: confirm)
clearBtn.addEventListener('click', () => {
  if (!confirm('This will clear all stored transactions and reset to a clean app state. Proceed?')) return;
  resetStorage();
  store = loadStore();
  render();
});

// initial render
render();
