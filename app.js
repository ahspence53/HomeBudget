// ---------- Storage ----------
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let startDate = localStorage.getItem("startDate") || "";
let openingBalance = parseFloat(localStorage.getItem("openingBalance")) || 0;

// ---------- DOM ----------
const txCategorySelect = document.getElementById("tx-category");
const newCategoryInput = document.getElementById("new-category");
const addCategoryButton = document.getElementById("add-category");

const txDesc = document.getElementById("tx-desc");
const txAmount = document.getElementById("tx-amount");
const txType = document.getElementById("tx-type");
const txFrequency = document.getElementById("tx-frequency");
const txDate = document.getElementById("tx-date");
const addTxButton = document.getElementById("add-transaction");

const startDateInput = document.getElementById("start-date");
const openingBalanceInput = document.getElementById("opening-balance");
const saveConfigButton = document.getElementById("save-config");

const transactionTableBody = document.querySelector("#transaction-table tbody");
const projectionTbody = document.querySelector("#projection-table tbody");

// ---------- Utils ----------
function toISO(d) {
  if (!d) return "";
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function normalizeSearch(str) {
  return str.toLowerCase().replace(/\s+/g, "").replace(/[-\/]/g, "");
}

// ---------- Categories ----------
function updateCategoryDropdown() {
  txCategorySelect.innerHTML = '<option value="">Select category</option>';
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    txCategorySelect.appendChild(opt);
  });
}

addCategoryButton.onclick = () => {
  const c = newCategoryInput.value.trim();
  if (!c) return;
  if (!categories.includes(c)) {
    categories.push(c);
    localStorage.setItem("categories", JSON.stringify(categories));
  }
  newCategoryInput.value = "";
  updateCategoryDropdown();
};

// ---------- Config ----------
saveConfigButton.onclick = () => {
  startDate = startDateInput.value;
  openingBalance = parseFloat(openingBalanceInput.value) || 0;
  localStorage.setItem("startDate", startDate);
  localStorage.setItem("openingBalance", openingBalance);
  renderProjectionTable();
};

startDateInput.value = startDate;
openingBalanceInput.value = openingBalance || "";

// ---------- Transactions ----------
function saveTransactions() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

addTxButton.onclick = () => {
  const tx = {
    description: txDesc.value.trim(),
    amount: parseFloat(txAmount.value) || 0,
    type: txType.value,
    frequency: txFrequency.value,
    date: txDate.value,
    category: txCategorySelect.value
  };

  if (!tx.description) return alert("Description required");
if (!tx.category) return alert("Please select a category");

  transactions.push(tx);
  saveTransactions();
  renderTransactionTable();
  renderProjectionTable();

  txDesc.value = txAmount.value = txDate.value = "";
};


// ---------- Tables ----------
function renderTransactionTable() {
    transactionTableBody.innerHTML = "";

    // SORT by date (earliest first)
    const sorted = [...transactions].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );
  transactionTableBody.innerHTML = "";
  sorted.forEach((tx, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(tx.date)}</td>
      <td>${tx.description}</td>
      <td>${tx.type}</td>
      <td>${tx.amount.toFixed(2)}</td>
      <td>${tx.category}</td>
      <td><button>Delete</button></td>`;
    tr.querySelector("button").onclick = () => {
      transactions.splice(i, 1);
      saveTransactions();
      renderTransactionTable();
      renderProjectionTable();
    };
    transactionTableBody.appendChild(tr);
  });
}

// ---------- Recurrence ----------
function occursOn(tx, iso) {
    if (!tx.date || !iso) return false;

    const start = new Date(tx.date);
    const cur = new Date(iso);

    // DST-safe normalisation
    start.setHours(12, 0, 0, 0);
    cur.setHours(12, 0, 0, 0);

    if (cur < start) return false;

    if (tx.frequency === "irregular") {
        return tx.date === iso;
    }

    if (tx.frequency === "monthly") {
        const day = start.getDate();
        const lastDay = new Date(
            cur.getFullYear(),
            cur.getMonth() + 1,
            0
        ).getDate();
        return cur.getDate() === Math.min(day, lastDay);
    }

    if (tx.frequency === "4-weekly") {
        const diffDays = Math.round(
            (cur - start) / 86400000
        );
        return diffDays % 28 === 0;
    }

    return false;
}

// ---------- Projection ----------
function renderProjectionTable() {
  projectionTbody.innerHTML = "";
  if (!startDate) return;

  let balance = openingBalance;
  const start = new Date(startDate);
  start.setHours(12,0,0,0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);
    let inc = 0, exp = 0, desc = [];

    transactions.forEach(tx => {
      if (occursOn(tx, iso)) {
        tx.type === "income" ? inc += tx.amount : exp += tx.amount;
        desc.push(tx.description);
      }
    });

    balance += inc - exp;
    const tr = document.createElement("tr");
    if (balance < 0) tr.classList.add("negative");
    tr.innerHTML = `
      <td>${formatDate(iso)}</td>
      <td>${desc.join("<br>")}</td>
      <td>${inc ? inc.toFixed(2) : ""}</td>
      <td>${exp ? exp.toFixed(2) : ""}</td>
      <td>${balance.toFixed(2)}</td>`;
    projectionTbody.appendChild(tr);
  }
}

// ---------- Sticky Find ----------
const findInput = document.getElementById("projection-find-input");
const findNext = document.getElementById("projection-find-next");
const findPrev = document.getElementById("projection-find-prev");
const findCounter = document.getElementById("find-counter");

let matches = [], idx = -1;

function collectMatches() {
  matches = [];
  idx = -1;
  const q = normalizeSearch(findInput.value);
  if (!q) return updateCounter();

  document.querySelectorAll("#projection-table tbody tr").forEach(r => {
    if (normalizeSearch(r.textContent).includes(q)) matches.push(r);
  });
  updateCounter();
}

function updateCounter() {
  findCounter.textContent = matches.length ? `${idx+1}/${matches.length}` : "0/0";
}

function showMatch() {
  matches.forEach(r => r.classList.remove("projection-match-highlight"));
  if (idx < 0 || idx >= matches.length) return;
  matches[idx].classList.add("projection-match-highlight");
  matches[idx].scrollIntoView({behavior:"smooth",block:"center"});
}

findInput.oninput = collectMatches;
findNext.onclick = () => { if(matches.length){ idx=(idx+1)%matches.length; showMatch(); updateCounter(); }};
findPrev.onclick = () => { if(matches.length){ idx=(idx-1+matches.length)%matches.length; showMatch(); updateCounter(); }};

// ---------- Top ----------
document.getElementById("back-to-top").onclick = () =>
  window.scrollTo({top:0,behavior:"smooth"});

// ---------- Init ----------

updateCategoryDropdown();
renderTransactionTable();
renderProjectionTable();
