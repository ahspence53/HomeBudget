document.addEventListener("DOMContentLoaded", () => {

/* ================= STORAGE ================= */
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let startDate = localStorage.getItem("startDate") || "";
let openingBalance = parseFloat(localStorage.getItem("openingBalance")) || 0;
let editingIndex = null;

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

/* ================= UTILS ================= */
function toISO(d) {
  if (!d) return "";
  const x = new Date(d);
  x.setHours(12,0,0,0);
  return x.toISOString().slice(0,10);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:"2-digit", month:"short", year:"numeric"
  });
}

function normalizeSearch(str) {
  return str.toLowerCase().replace(/\s+/g,"").replace(/[-\/]/g,"");
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
  updateEditCategoryDropdown();
};

renameCategoryButton.onclick = () => {
  const oldName = editCategorySelect.value;
  const newName = editCategoryInput.value.trim();

  if (!oldName || !newName) return alert("Select and enter a category name");
  if (categories.includes(newName)) return alert("Category already exists");

  categories = categories.map(c => c === oldName ? newName : c);
  transactions.forEach(tx => {
    if (tx.category === oldName) tx.category = newName;
  });

  localStorage.setItem("categories", JSON.stringify(categories));
  localStorage.setItem("transactions", JSON.stringify(transactions));

  editCategoryInput.value = "";
  updateCategoryDropdown();
  updateEditCategoryDropdown();
  renderTransactionTable();
  renderProjectionTable();
};

/* ================= CONFIG ================= */
saveConfigButton.onclick = () => {
  startDate = startDateInput.value;
  openingBalance = parseFloat(openingBalanceInput.value) || 0;
  localStorage.setItem("startDate", startDate);
  localStorage.setItem("openingBalance", openingBalance);
  renderProjectionTable();
};

startDateInput.value = startDate;
openingBalanceInput.value = openingBalance || "";

/* ================= TRANSACTIONS ================= */
function saveTransactions() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

addTxButton.onclick = () => {
  const tx = {
    description: txDesc.value.trim(),
    amount: parseFloat(txAmount.value),
    type: txType.value,
    frequency: txFrequency.value,
    date: txDate.value,
    category: txCategorySelect.value
  };

  if (!tx.description || !tx.category || isNaN(tx.amount)) {
    return alert("All fields required");
  }

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

  [...transactions].sort((a,b)=>new Date(a.date)-new Date(b.date))
    .forEach(tx => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(tx.date)}</td>
        <td>${tx.description}</td>
        <td>${tx.type}</td>
        <td>${tx.amount.toFixed(2)}</td>
        <td>${tx.category}</td>
        <td>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </td>
      `;

      if (tx.type === "expense") tr.classList.add("expense-row");

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
        if (!confirm("Delete transaction?")) return;
        transactions.splice(transactions.indexOf(tx),1);
        saveTransactions();
        renderTransactionTable();
        renderProjectionTable();
      };

      transactionTableBody.appendChild(tr);
    });
}

/* ================= RECURRENCE ================= */
function occursOn(tx, iso) {
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
    return Math.round((cur-start)/86400000) % 28 === 0;
  }
  return false;
}

/* ================= PROJECTION ================= */
function renderProjectionTable() {
  projectionTbody.innerHTML = "";
  if (!startDate) return;

  let balance = openingBalance;
  const start = new Date(startDate);
  start.setHours(12,0,0,0);
  const end = new Date(start);
  end.setMonth(end.getMonth()+24);

  for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
    const iso = toISO(d);
    let inc=0, exp=0, desc=[];

    transactions.forEach(tx=>{
      if (occursOn(tx,iso)) {
        tx.type==="income"?inc+=tx.amount:exp+=tx.amount;
        desc.push(`${tx.description} (${tx.category})`);
      }
    });

    balance += inc-exp;

    const tr=document.createElement("tr");
    if (balance<0) tr.classList.add("negative");
    if (iso===toISO(new Date())) tr.classList.add("projection-today");

    tr.innerHTML = `
      <td>${formatDate(iso)}</td>
      <td>${desc.join("<br>")}</td>
      <td>${inc?inc.toFixed(2):""}</td>
      <td>${exp?exp.toFixed(2):""}</td>
      <td>${balance.toFixed(2)}</td>
    `;

    projectionTbody.appendChild(tr);
  }
}

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
      transactions.push({
        date, description:desc, category:cat,
        amount:parseFloat(amount),
        type:typeRaw.toLowerCase(),
        frequency:freq.toLowerCase()
      });
    });

    localStorage.setItem("categories", JSON.stringify(categories));
    localStorage.setItem("transactions", JSON.stringify(transactions));
    updateCategoryDropdown();
    updateEditCategoryDropdown();
    renderTransactionTable();
    renderProjectionTable();
    alert("CSV import successful");
  };

  reader.readAsText(rows);
};

/* ================= INIT ================= */
updateCategoryDropdown();
updateEditCategoryDropdown();
renderTransactionTable();
renderProjectionTable();

});
