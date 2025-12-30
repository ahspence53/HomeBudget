document.addEventListener("DOMContentLoaded", () => {

  
/* ================= STORAGE ================= */
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let startDate = localStorage.getItem("startDate") || "";
let openingBalance = parseFloat(localStorage.getItem("openingBalance")) || 0;
let editingIndex = null;
let nudges = JSON.parse(localStorage.getItem("nudges")) || {};
let scrollBeforeHelp = 0;
let transactionSortAscending = true;
/* ================= DOM ================= */
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

const editCategorySelect = document.getElementById("edit-category-select");
const editCategoryInput = document.getElementById("edit-category-name");
const renameCategoryButton = document.getElementById("rename-category");
const MAX_PAST_NUDGE_DAYS = 7;
  
/* added edit category code*/
  renameCategoryButton.onclick = () => {
  const oldName = editCategorySelect.value;
  const newName = editCategoryInput.value.trim();

  if (!oldName) return alert("Select a category to rename");
  if (!newName) return alert("Enter a new category name");
  if (categories.includes(newName)) return alert("Category already exists");

  // Update category list
  categories = categories.map(c => c === oldName ? newName : c);
  localStorage.setItem("categories", JSON.stringify(categories));

  // Update all transactions using that category
  transactions.forEach(tx => {
    if (tx.category === oldName) {
      tx.category = newName;
    }
  });
  localStorage.setItem("transactions", JSON.stringify(transactions));

  editCategoryInput.value = "";

  updateCategoryDropdown();
  updateEditCategoryDropdown();
  renderTransactionTable();
  renderProjectionTable();

  alert(`Category "${oldName}" renamed to "${newName}"`);
};
  
/* ================= UTILS ================= */
function txId(tx) {
  return `${tx.date}|${tx.frequency}|${tx.description}|${tx.amount}|${tx.type}`;
}

function nudgeKey(id, iso) {
  return `${id}|${iso}`;
}

function getDisplayedTransactionDate(tx) {
  if (!tx.date) return "";

  // Monthly or irregular → show original day
  if (tx.frequency !== "4-weekly") {
    return formatDayOnly(tx.date);
  }

  // 4-weekly → roll forward to next occurrence ≥ startDate
  let d = new Date(tx.date);
  d.setHours(12, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);

  while (d < start) {
    d.setDate(d.getDate() + 28);
  }

  return d.getDate() + getOrdinalSuffix(d.getDate());
}  
  
function saveNudges() {
  localStorage.setItem("nudges", JSON.stringify(nudges));
}
  
  function toISO(d) {
  if (!d) return "";
  const x = new Date(d);
  x.setHours(12,0,0,0);
  return x.toISOString().slice(0,10);
}

function formatDayOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.getDate() + getOrdinalSuffix(d.getDate());
}

function getOrdinalSuffix(n) {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
  
/*function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:"2-digit", month:"short", year:"numeric"
  });
}
*/
function jumpToProjectionDate(iso) {
  const rows = document.querySelectorAll("#projection-table tbody tr");

  for (const row of rows) {
    const cell = row.querySelector("td");
    if (!cell) continue;

    const text = cell.textContent.trim();
    if (normalizeSearch(text).includes(normalizeSearch(formatDate(iso)))) {
      row.classList.add("projection-jump-highlight");
      row.scrollIntoView({ behavior: "smooth", block: "center" });

      // Remove highlight after a moment
      setTimeout(() => {
        row.classList.remove("projection-jump-highlight");
      }, 1500);

      break;
    }
  }
}
  
  
/* ====== NEW DATE FORMAT =======*/
function formatDate(iso) {
  const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
  return new Date(iso).toLocaleDateString("en-GB", options).replace(',', '');
}

/* ==============================*/

function normalizeSearch(str) {
  return str.toLowerCase().replace(/\s+/g,"").replace(/[-\/]/g,"");
}
function hasNudgedAwayTransaction(iso) {
  return Object.keys(nudges).some(key => key.endsWith("|" + iso));
}
  
/* ====== nudge code =======*/
  


function saveNudges() {
  localStorage.setItem("nudges", JSON.stringify(nudges));
}


  

  
/* ================= CATEGORIES ================= */
function updateCategoryDropdown() {
  txCategorySelect.innerHTML = '<option value="">Select category</option>';
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    txCategorySelect.appendChild(opt);
  });
}

function updateEditCategoryDropdown() {
  if (!editCategorySelect) return;

  editCategorySelect.innerHTML = '<option value="">Select category</option>';
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    editCategorySelect.appendChild(opt);
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

/* ================= CONFIG ================= */
saveConfigButton.onclick = () => {
  startDate = startDateInput.value;
  openingBalance = parseFloat(openingBalanceInput.value) || 0;
  localStorage.setItem("startDate", startDate);
  localStorage.setItem("openingBalance", openingBalance);
  /*alert("Saving config");*/
  renderProjectionTable();
};

startDateInput.value = startDate;
openingBalanceInput.value = openingBalance || "";

/* ==============HELP============ */
const helpButton = document.getElementById("help");
const helpModal = document.getElementById("help-modal");
const helpClose = document.getElementById("help-close");
/* ===== ADDITION ======*/
  helpButton.addEventListener("click", () => {
  scrollBeforeHelp = window.scrollY;

  helpModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
});
  /* ==============*/
if (helpButton) {
  helpButton.addEventListener("click", () => {
    document.body.classList.add("modal-open");
    helpModal.classList.remove("hidden");
  });
}

helpClose.addEventListener("click", () => {
  helpModal.classList.add("hidden");
  document.body.classList.remove("modal-open");

  window.scrollTo({
    top: scrollBeforeHelp,
    behavior: "auto"
  });
});

// Click outside to close
helpModal.addEventListener("click", e => {
  if (e.target === helpModal) {
    helpModal.classList.add("hidden");
    document.body.classList.remove("modal-open");

    window.scrollTo({
      top: scrollBeforeHelp,
      behavior: "auto"
    });
  }
});


/* ================= TRANSACTIONS ================= */
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
  if (!tx.category) return alert("Category required");
  if ((tx.frequency !== "irregular") && !tx.date)
    return alert("Start date required");

  if (editingIndex !== null) {
    transactions[editingIndex] = tx;
    editingIndex = null;
    addTxButton.textContent = "Add Transaction";
  } else {
    transactions.push(tx);
  }

  saveTransactions();
  renderTransactionTable();
  renderProjectionTable();

  txDesc.value = txAmount.value = txDate.value = "";
  txCategorySelect.value = "";
};

/* ================= TRANSACTION TABLE ================= */
function renderTransactionTable() {
  transactionTableBody.innerHTML = "";

  const sorted = [...transactions].sort((a, b) => {
  const diff = new Date(a.date) - new Date(b.date);
  return transactionSortAscending ? diff : -diff;
});

  sorted.forEach(tx => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
<td>
  <div class="tx-date-cell">
    <span class="tx-date-text">${getDisplayedTransactionDate(tx)}</span>
    <span class="tx-date-icon">
      ${tx.frequency === "monthly" ? '🔁' : ""}
      ${tx.frequency === "4-weekly" ? '📆' : ""}
    </span>
  </div>
</td>
      <td>${tx.description}</td>
      <td>${tx.type}</td>
      <td>${tx.amount.toFixed(2)}</td>
      <td>${tx.category}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </td>
    `;

    tr.querySelector(".edit-btn").onclick = () => {
      txDesc.value = tx.description;
      txAmount.value = tx.amount;
      txType.value = tx.type;
      txFrequency.value = tx.frequency;
      txDate.value = tx.date;
      txCategorySelect.value = tx.category;

      editingIndex = transactions.indexOf(tx);
      addTxButton.textContent = "Save Changes";
      window.scrollTo({top:0,behavior:"smooth"});
    };

    tr.querySelector(".delete-btn").onclick = () => {
      if (!confirm("Delete this transaction?")) return;
      transactions.splice(transactions.indexOf(tx),1);
      saveTransactions();
      renderTransactionTable();
      renderProjectionTable();
    };
    /* added to make expense red*/
    if (tx.type === "expense") tr.classList.add("expense-row");
    if (tx.frequency === "4-weekly") {
  tr.classList.add("freq-4weekly");
}
    transactionTableBody.appendChild(tr);
  });
}
/* ======== */
  const dateSortHeader = document.getElementById("date-sort-header");
const dateSortIndicator = document.getElementById("date-sort-indicator");

if (dateSortHeader) {
  dateSortHeader.onclick = () => {
    transactionSortAscending = !transactionSortAscending;
    dateSortIndicator.textContent = transactionSortAscending ? "▲" : "▼";
    renderTransactions();
  };
}
/* ================= RECURRENCE ================= */
function occursOn(tx, iso) {
  if (!tx.date) return false;

  const start = new Date(tx.date);
  const cur = new Date(iso);
  start.setHours(12,0,0,0);
  cur.setHours(12,0,0,0);

  if (cur < start) return false;

  if (tx.frequency === "irregular") return tx.date === iso;

  if (tx.frequency === "monthly") {
    const day = start.getDate();
    const last = new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
    return cur.getDate() === Math.min(day,last);
  }

  if (tx.frequency === "4-weekly") {
    const diff = Math.round((cur-start)/86400000);
    return diff % 28 === 0;
  }

  return false;
}





/* ================= NUDGE HELPERS ================= */

// A stable unique ID for each transaction occurrence
function txId(tx) {
  return `${tx.date}|${tx.frequency}|${tx.description}|${tx.amount}|${tx.type}`;
}

// Was this transaction nudged away from THIS date?
function isNudgedAway(tx, iso) {
  return nudges.hasOwnProperty(nudgeKey(tx, iso));
}

function isNudgedHere(tx, iso) {
  return Object.values(nudges).includes(iso) &&
    Object.keys(nudges).some(k =>
      k.startsWith(txId(tx) + "|") && nudges[k] === iso
    );
}
  
/* projection*/
/* ================= PROJECTION ================= */

function renderProjectionTable() {
  projectionTbody.innerHTML = "";
  if (!startDate) {
  document.body.classList.remove("modal-open");
  alert("Start date not set");
  return;
}

  let balance = openingBalance;

  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);

  // Build a map: isoDate -> array of transactions for that day
  const dayMap = {};

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dayMap[toISO(d)] = [];
  }

  // Place each transaction occurrence on exactly ONE date
  transactions.forEach(tx => {
    for (let iso in dayMap) {
      if (!occursOn(tx, iso)) continue;

      const id = txId(tx);
      const nudgeKeyForDay = `${id}|${iso}`;

      // If nudged, move it
      if (nudges[nudgeKeyForDay]) {
        const targetIso = nudges[nudgeKeyForDay];
        if (dayMap[targetIso]) {
          dayMap[targetIso].push(tx);
        }
      } else {
        // Not nudged → stays on natural day
        dayMap[iso].push(tx);
      }
    }
  });

  // Now render day by day
  Object.keys(dayMap).forEach(iso => {
    const todaysTx = dayMap[iso];

    if (todaysTx.length === 0) {
      const tr = document.createElement("tr");
      if ([0, 6].includes(new Date(iso).getDay())) {
        tr.classList.add("weekend-row");
      }

      tr.innerHTML = `
        <td>${formatDate(iso)}</td>
        <td></td><td></td><td></td>
        <td><strong>${balance.toFixed(2)}</strong></td>
      `;
      projectionTbody.appendChild(tr);
      return;
    }

    // Income first
    todaysTx.sort((a, b) =>
      a.type === b.type ? 0 : a.type === "income" ? -1 : 1
    );

    todaysTx.forEach((tx, index) => {
      const isIncome = tx.type === "income";
      balance += isIncome ? tx.amount : -tx.amount;

      const tr = document.createElement("tr");

      if ([0, 6].includes(new Date(iso).getDay())) {
        tr.classList.add("weekend-row");
      }
      if (balance < 0) tr.classList.add("negative");

      const today = new Date(toISO(new Date()));
const diffDays = Math.round((new Date(iso) - today) / 86400000);

const showNudge =
  (diffDays >= 0 && diffDays <= 7) ||           // future nudging (unchanged)
  (diffDays < 0 && diffDays >= -MAX_PAST_NUDGE_DAYS); // limited past nudging

      tr.innerHTML = `
        <td>${index === 0 ? formatDate(iso) : ""}</td>
        <td>
          <div class="projection-item ${tx.type}">
            <span class="desc">${tx.description}</span>
            <span class="cat">${tx.category || ""}</span>
            ${showNudge ? `
              <button class="nudge-btn"
                data-id="${txId(tx)}"
                data-iso="${iso}">+1</button>
            ` : ""}
          </div>
        </td>
        <td>${isIncome ? tx.amount.toFixed(2) : ""}</td>
        <td>${!isIncome ? tx.amount.toFixed(2) : ""}</td>
        <td>${index === todaysTx.length - 1
          ? `<strong>${balance.toFixed(2)}</strong>`
          : balance.toFixed(2)
        }</td>
      `;

      projectionTbody.appendChild(tr);
    });
  });
}
  
/* ================= STICKY FIND ================= */
const findInput=document.getElementById("projection-find-input");
const findNext=document.getElementById("projection-find-next");
const findPrev=document.getElementById("projection-find-prev");
const findCounter=document.getElementById("find-counter");

let matches=[], findIdx=-1;

function collectMatches(){
  matches=[];
  findIdx=-1;
  const q=normalizeSearch(findInput.value);
  if(!q){updateCounter();return;}
  document.querySelectorAll("#projection-table tbody tr").forEach(r=>{
    if(normalizeSearch(r.textContent).includes(q))matches.push(r);
  });
  updateCounter();
}

function updateCounter(){
  findCounter.textContent = matches.length ? `${findIdx+1}/${matches.length}` : "0/0";
}

function showMatch(){
  matches.forEach(r=>r.classList.remove("projection-match-highlight"));
  if(findIdx<0||findIdx>=matches.length)return;
  matches[findIdx].classList.add("projection-match-highlight");
  matches[findIdx].scrollIntoView({behavior:"smooth",block:"center"});
}

findInput.oninput=collectMatches;
findNext.onclick=()=>{if(matches.length){findIdx=(findIdx+1)%matches.length;showMatch();updateCounter();}};
findPrev.onclick=()=>{if(matches.length){findIdx=(findIdx-1+matches.length)%matches.length;showMatch();updateCounter();}};

/* ================= TOP ================= */
document.getElementById("back-to-top").onclick = () =>
  window.scrollTo({top:1500,behavior:"smooth"});
/* ============== VIEW TRANSACTIONS =========== */
document.getElementById("TopofApp").onclick = () =>
  window.scrollTo({top:0,behavior:"smooth"});
  
  const floatingFind = document.getElementById("floating-find");

function lockFindBar() {
  if (!floatingFind) return;

  const y =
    window.visualViewport
      ? window.visualViewport.pageTop
      : window.scrollY;

  floatingFind.style.top = y + "px";
}

// iOS-safe listeners
window.addEventListener("scroll", lockFindBar, { passive: true });
window.addEventListener("resize", lockFindBar);
if (window.visualViewport) {
  window.visualViewport.addEventListener("scroll", lockFindBar);
  window.visualViewport.addEventListener("resize", lockFindBar);
}

// initial position
lockFindBar();

/* ================= CSV IMPORT ================= */

/* ================= CSV IMPORT (AUTO CATEGORY) ================= */
const csvInput = document.getElementById("csv-import");
document.getElementById("import-btn").onclick = () => {
  if (!csvInput.files.length) return alert("Choose CSV");

  const rows = csvInput.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    const lines = reader.result.trim().split(/\r?\n/);
    if (lines.shift().trim() !== "Date,Amount,Income/Expense,Category,Description,Frequency") {
      return alert("Invalid CSV header");
    }

    categories = [...new Set(categories)];
    transactions = [];

    lines.forEach(line=>{
      const [date,amount,typeRaw,cat,desc,freq] = line.split(",");
      if (!categories.includes(cat)) categories.push(cat);
      const normalizedType = typeRaw.trim().toLowerCase();

if (normalizedType !== "income" && normalizedType !== "expense") {
  throw new Error(`Invalid Income/Expense value: "${typeRaw}"`);
}

transactions.push({
  date: date.trim(),
  description: desc.trim(),
  category: cat.trim(),
  amount: parseFloat(amount),
  type: normalizedType,
  frequency: freq.trim().toLowerCase()
});
    });

    localStorage.setItem("categories", JSON.stringify(categories));
    localStorage.setItem("transactions", JSON.stringify(transactions));
    updateCategoryDropdown();
    updateEditCategoryDropdown();
    renderTransactionTable();
    renderProjectionTable();
    /*alert("CSV import successful");*/
  };

  reader.readAsText(rows);
};

  /* ================= EXPORT 24-MONTH PROJECTION ================= */

document.getElementById("export-projection-btn").onclick = () => {
if (!startDate) {
  document.body.classList.remove("modal-open");
  alert("Start date not set");
  return;
}

  let csv = "Date,Description,Category,Income,Expense,Balance\n";

  let balance = openingBalance;
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);

    let inc = 0;
    let exp = 0;
    const descs = [];
    const cats = [];

    transactions.forEach(tx => {
      if (occursOn(tx, iso)) {
        if (tx.type === "income") inc += tx.amount;
        else exp += tx.amount;

        descs.push(tx.description);
        cats.push(tx.category);
      }
    });

    balance += inc - exp;

    csv += [
      iso,
      `"${descs.join(" | ")}"`,
      `"${cats.join(" | ")}"`,
      inc ? inc.toFixed(2) : "",
      exp ? exp.toFixed(2) : "",
      balance.toFixed(2)
    ].join(",") + "\n";
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "24-month-projection.csv";
  a.click();

  URL.revokeObjectURL(url);
};
/*---negative balances-----*/
  /* ================= NEGATIVE BALANCES POPUP ================= */

const negativeBtn = document.getElementById("negative-popup-btn");
const negativePopup = document.getElementById("negative-popup");
const negativePopupBody = document.getElementById("negative-popup-body");
const negativeClose = document.getElementById("negative-popup-close");

negativeBtn.onclick = () => {
  negativePopupBody.innerHTML = "";
  document.body.classList.add("modal-open");

  if (!startDate) {
    document.body.classList.remove("modal-open");
    alert("Start date not set");
    return;
  }

  let foundAny = false;
  let balance = openingBalance;

  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);

    transactions.forEach(tx => {
      const id = txId(tx);
      const natural = occursOn(tx, iso);
      const nudgedAway = nudges[`${id}|${iso}`];
      const nudgedHere = Object.entries(nudges).some(
        ([key, target]) => key.startsWith(id + "|") && target === iso
      );

      if ((natural && !nudgedAway) || (!natural && nudgedHere)) {
        balance += tx.type === "income" ? tx.amount : -tx.amount;
      }
    });

    if (balance < 0) {
      foundAny = true;

      const tr = document.createElement("tr");
      tr.classList.add("negative");
      tr.style.cursor = "pointer";

      tr.innerHTML = `
        <td class="salary-date">
          <span class="salary-date-text">${formatDate(iso)}</span>
          <span class="salary-jump-icon">🔍</span>
        </td>
        <td style="text-align:right">
          <strong>${balance.toFixed(2)}</strong>
        </td>
      `;

      tr.onclick = () => {
        negativePopup.classList.add("hidden");
        document.body.classList.remove("modal-open");
        setTimeout(() => jumpToProjectionDate(iso), 200);
      };

      negativePopupBody.appendChild(tr);
    }
  }

  if (!foundAny) {
    document.body.classList.remove("modal-open");
    alert("No negative balances in the next 24 months");
    return;
  }

  negativePopup.classList.remove("hidden");
};

negativeClose.onclick = () => {
  negativePopup.classList.add("hidden");
  document.body.classList.remove("modal-open");
  * alex spence */
  window.scrollTo({top:1500,behavior:"smooth"});
};

negativePopup.addEventListener("click", e => {
  if (e.target === negativePopup) {
    negativePopup.classList.add("hidden");
    document.body.classList.remove("modal-open");
    * alex spence */
  window.scrollTo({top:1500,behavior:"smooth"});
  }
});
  
  /* salary minus one day*/
/* ================= SALARY -1 DAY POPUP ================= */

const salaryBtn = document.getElementById("salary-popup-btn");
const salaryPopup = document.getElementById("salary-popup");
const salaryPopupBody = document.getElementById("salary-popup-body");
const salaryClose = document.getElementById("salary-popup-close");

salaryBtn.onclick = () => {
  document.body.classList.add("modal-open");
  salaryPopupBody.innerHTML = "";

  if (!startDate) {
    document.body.classList.remove("modal-open");
    alert("Start date not set");
    return;
  }

  // Collect salary -1 dates
  const salaryMinusOne = new Set();

  transactions.forEach(tx => {
    if (tx.type === "income") {
      const start = new Date(tx.date);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 24);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toISO(d);
        if (occursOn(tx, iso)) {
          const prev = new Date(d);
          prev.setDate(prev.getDate() - 1);
          salaryMinusOne.add(toISO(prev));
        }
      }
    }
  });

  // Calculate balances day-by-day
  let balance = openingBalance;

  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);

    transactions.forEach(tx => {
      const id = txId(tx);
      const natural = occursOn(tx, iso);
      const nudgedAway = nudges[`${id}|${iso}`];
      const nudgedHere = Object.entries(nudges).some(
        ([key, target]) =>
          key.startsWith(id + "|") && target === iso
      );

      if ((natural && !nudgedAway) || (!natural && nudgedHere)) {
        balance += tx.type === "income" ? tx.amount : -tx.amount;
      }
    });

    if (salaryMinusOne.has(iso)) {
      const tr = document.createElement("tr");
      if (balance < 0) tr.classList.add("negative");

      tr.innerHTML = `
        <td class="salary-date">
          <span class="salary-date-text">${formatDate(iso)}</span>
          <span class="salary-jump-icon" title="Tap to jump to this date">🔍</span>
        </td>
        <td style="text-align:right">
          <strong>${balance.toFixed(2)}</strong>
        </td>
      `;

      tr.style.cursor = "pointer";
      tr.title = "Tap to jump to this date";

      tr.addEventListener("click", () => {
        salaryPopup.classList.add("hidden");
        document.body.classList.remove("modal-open");

        setTimeout(() => {
          jumpToProjectionDate(iso);
        }, 200);
      });

      salaryPopupBody.appendChild(tr);
    }
  }

  salaryPopup.classList.remove("hidden");
};

salaryClose.onclick = () => {
  salaryPopup.classList.add("hidden");
  document.body.classList.remove("modal-open");
      /* alex spence */
  window.scrollTo({top:1500,behavior:"smooth"});
};

salaryPopup.addEventListener("click", e => {
  if (e.target === salaryPopup) {
    salaryPopup.classList.add("hidden");
    document.body.classList.remove("modal-open");
    /* alex spence */
    window.scrollTo({top:1500,behavior:"smooth"});
  }
});
  /* ===== */
  /* ================= DATE SORT HANDLER ================= */

/*const dateSortHeader = document.getElementById("date-sort-header");
const dateSortIndicator = document.getElementById("date-sort-indicator");

if (dateSortHeader && dateSortIndicator) {
  dateSortHeader.addEventListener("click", () => {
    transactionSortAscending = !transactionSortAscending;
    dateSortIndicator.textContent = transactionSortAscending ? "▲" : "▼";
    renderTransactionTable();
  });
}*/

 /*=====nudge=====*/
  
  
projectionTbody.addEventListener("click", e => {
  const btn = e.target.closest(".nudge-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  const visibleIso = btn.dataset.iso;

  // Find existing nudge (if any) for this transaction
  let sourceIso = visibleIso;

  for (const [key, target] of Object.entries(nudges)) {
    if (key.startsWith(id + "|") && target === visibleIso) {
      // This transaction was already nudged here
      sourceIso = key.split("|").slice(-1)[0];
      break;
    }
  }

  // Calculate next day
  const next = new Date(visibleIso);
  next.setDate(next.getDate() + 1);
  const toIso = toISO(next);

  // Remove all existing nudges for this transaction
  Object.keys(nudges).forEach(k => {
    if (k.startsWith(id + "|")) delete nudges[k];
  });

  // Add the new nudge using the ORIGINAL source date
  nudges[`${id}|${sourceIso}`] = toIso;

  saveNudges();
  renderProjectionTable();
});
  projectionTbody.addEventListener("click", e => {
  const row = e.target.closest("tr");
  if (!row) return;

  // Clear previous selection
  projectionTbody
    .querySelectorAll(".projection-selected")
    .forEach(r => r.classList.remove("projection-selected"));

  // Highlight clicked row
  row.classList.add("projection-selected");
});

  
/* ================= INIT ================= */
updateCategoryDropdown();
updateEditCategoryDropdown();
renderTransactionTable();
renderProjectionTable();

});
