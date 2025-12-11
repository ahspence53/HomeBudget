// ----------------------
// Normalize stored transactions to ISO dates
// ----------------------
function normalizeStoredTransactions() {
    let changed = false;
    transactions = transactions.map(t => {
        const d = new Date(t.date);
        if (d instanceof Date && !isNaN(d)) {
            const iso = d.toISOString().split('T')[0];
            if (iso !== t.date) changed = true;
            t.date = iso;
        }
        // ensure fields exist
        t.frequency = t.frequency || 'irregular';
        t.category = t.category || "";
        t.description = t.description || "";
        t.type = t.type || 'expense';
        t.amount = parseFloat(t.amount) || 0;
        return t;
    });
    if (changed) localStorage.setItem('transactions', JSON.stringify(transactions));
}

// call this at the start
normalizeStoredTransactions();

// ================================
// app.js - Home Budget Tracker
// Recurrence-enabled projection + transaction management
// ================================

// ---------- Persistence / Data ----------
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// ---------- DOM refs (must match your index.html) ----------
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

const findInput = document.getElementById("find-input");
const findNextBtn = document.getElementById("find-next");

const gotoDateInput = document.getElementById("goto-date");
const gotoDateBtn = document.getElementById("goto-date-btn");

// ---------- Utilities ----------
// Convert Date or string to ISO yyyy-mm-dd
function toISO(dateLike) {
    if (!dateLike) return "";
    // If already a Date
    if (dateLike instanceof Date && !isNaN(dateLike)) {
        return dateLike.toISOString().split("T")[0];
    }
    // If string: try to detect formats:
    // - If looks like yyyy-mm-dd, return as-is (after basic validation)
    // - If looks like dd/mm/yyyy or d/m/yyyy or d-m-yyyy, parse accordingly
    const s = String(dateLike).trim();
    // yyyy-mm-dd
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (isoMatch.test(s)) {
        // Basic validation by constructing a date
        const d = new Date(s);
        if (!isNaN(d)) return d.toISOString().split("T")[0];
    }
    // dd/mm/yyyy or dd-mm-yyyy
    const dmMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const m = s.match(dmMatch);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d)) return d.toISOString().split("T")[0];
    }
    // fallback: attempt Date constructor
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return ""; // could not parse
}

// simple ISO -> formatted dd-MMM-yyyy (en-GB)
function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// normalize transactions loaded from storage (ensure date is ISO)
function normalizeStoredTransactions() {
    let changed = false;
    transactions = transactions.map(tx => {
        const t = Object.assign({}, tx);
        // convert any stored date-like to ISO
        const iso = toISO(t.date);
        if (iso && iso !== t.date) {
            t.date = iso;
            changed = true;
        }
        // ensure numeric amount
        t.amount = parseFloat(t.amount) || 0;
        // default frequency
        t.frequency = t.frequency || 'irregular';
        t.category = t.category || "";
        t.description = t.description || "";
        t.type = t.type || 'expense';
        return t;
    });
    if (changed) localStorage.setItem('transactions', JSON.stringify(transactions));
}

// ---------- Category handling ----------
function updateCategoryDropdown() {
    // maintain the "Select category" placeholder if empty
    txCategorySelect.innerHTML = '<option value="" disabled>Select category</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);
    });
}

function addCategory() {
    const c = (newCategoryInput.value || "").trim();
    if (!c) return;
    if (!categories.includes(c)) {
        categories.push(c);
        localStorage.setItem('categories', JSON.stringify(categories));
    }
    newCategoryInput.value = "";
    updateCategoryDropdown();
    txCategorySelect.value = c;
}

addCategoryButton.addEventListener("click", addCategory);

// ---------- Config handling ----------
saveConfigButton.addEventListener("click", () => {
    startDate = toISO(startDateInput.value);
    openingBalance = parseFloat(openingBalanceInput.value) || 0;
    localStorage.setItem('startDate', startDate);
    localStorage.setItem('openingBalance', openingBalance);
    // re-render projection on save
    renderProjectionTable();
});

// populate config inputs on load
startDateInput.value = startDate;
openingBalanceInput.value = isNaN(openingBalance) ? "" : openingBalance;

// ---------- Transactions: add / delete / persistence ----------
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function addTransactionObj(obj) {
    // obj: {date (string), description, type, amount, frequency, category}
    const tx = {
        description: String(obj.description || "").trim(),
        amount: parseFloat(obj.amount) || 0,
        type: obj.type || 'expense',
        frequency: obj.frequency || 'irregular',
        category: obj.category || ""
    };
    // Normalize date to ISO for storage (allow blank for irregular? Require for irregular)
    tx.date = toISO(obj.date) || "";
    // Validate
    if (!tx.description) { alert("Please enter a description."); return; }
    // For irregular and recurring we expect appropriate dates - recurring without a start date isn't allowed
    if ((tx.frequency === 'monthly' || tx.frequency === '4-weekly') && !tx.date) {
        alert("Please set a start date for recurring transactions.");
        return;
    }
    // push and sort
    transactions.push(tx);
    transactions.sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return da - db;
    });
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}

addTxButton.addEventListener("click", () => {
    const tx = {
        date: txDate.value,
        description: txDesc.value,
        type: txType.value,
        amount: txAmount.value,
        frequency: txFrequency.value,
        category: txCategorySelect.value || ""
    };
    addTransactionObj(tx);
    // clear form
    txDesc.value = "";
    txAmount.value = "";
    txDate.value = "";
    txCategorySelect.value = "";
    txFrequency.value = "irregular";
    txType.value = "expense";
});

// Delete function by index
function deleteTransaction(index) {
    if (index < 0 || index >= transactions.length) return;
    transactions.splice(index, 1);
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}

// ---------- Render transaction table ----------
function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function renderTransactionTable() {
    transactionTableBody.innerHTML = "";
    // compute running balance chronologically using the base openingBalance
    let runningBalance = openingBalance || 0;
    // Generate an array of transactions sorted by date (stable)
    const sorted = [...transactions].sort((a,b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return da - db;
    });

    sorted.forEach((tx, idx) => {
        runningBalance += tx.type === 'income' ? tx.amount : -tx.amount;

        const tr = document.createElement("tr");
        const descHtml = tx.frequency === 'irregular'
            ? `<span class="irregular">${escapeHtml(tx.description)}</span>`
            : escapeHtml(tx.description);

        tr.innerHTML = `
            <td>${tx.date ? formatDate(tx.date) : ""}</td>
            <td>${descHtml}</td>
            <td>${escapeHtml(tx.type)}</td>
            <td>${tx.amount.toFixed(2)}</td>
            <td>${escapeHtml(tx.category || "")}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td><button class="delete-btn" data-index="${idx}">Delete</button></td>
        `;
        transactionTableBody.appendChild(tr);

        // wire delete (use idx in the sorted array context -> need mapping back to original transactions)
        tr.querySelector(".delete-btn").addEventListener("click", (e) => {
            const buttonIndex = parseInt(e.target.getAttribute("data-index"), 10);
            // Find the actual transaction in the original transactions array by matching unique-ish fields:
            // We'll attempt to match by description + amount + date + type + frequency + category (first matching instance)
            const txToDelete = sorted[buttonIndex];
            // find index in original transactions
            const originalIndex = transactions.findIndex(t =>
                t.description === txToDelete.description &&
                t.amount === txToDelete.amount &&
                (t.date === txToDelete.date) &&
                t.type === txToDelete.type &&
                t.frequency === txToDelete.frequency &&
                t.category === txToDelete.category
            );
            if (originalIndex === -1) {
                // fallback: delete by approximated index (buttonIndex)
                if (confirm("Delete this transaction?")) {
                    transactions.splice(buttonIndex, 1);
                    saveTransactions();
                    renderTransactionTable();
                    renderProjectionTable();
                }
                return;
            }
            if (confirm("Delete this transaction?")) {
                deleteTransaction(originalIndex);
            }
        });
    });
}

// ---------- Recurrence logic ----------
// Determine whether a transaction "occurs" on a particular date (ISO strings)
function txOccursOn(tx, dateIso) {
    if (!tx || !dateIso) return false;
    // If irregular: must match exactly
    if (tx.frequency === 'irregular') {
        return tx.date === dateIso;
    }
    // For recurring: need a start date
    if (!tx.date) return false;
    const startIso = tx.date;
    const start = new Date(startIso);
    const d = new Date(dateIso);
    // only occurrences on or after start
    if (d < start) return false;

    if (tx.frequency === 'monthly') {
        // match day-of-month, fall back to last day of month
        const startDay = start.getDate();
        const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const matchDay = Math.min(startDay, lastDayOfMonth);
        return d.getDate() === matchDay;
    }

    if (tx.frequency === '4-weekly') {
        // every 28 days from start
        // compute difference in days (floor)
        const diffMs = d - start;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % 28 === 0;
    }

    return false;
}

// ---------- Projection rendering (24 months, one row per day) ----------
function renderProjectionTable() {
    projectionTbody.innerHTML = "";

    if (!startDate) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" class="small">Please set a Start Date in Configuration and press Save to generate the projection.</td>`;
        projectionTbody.appendChild(tr);
        return;
    }

    // compute end date = startDate + 24 months - 1 day
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 24);
    end.setDate(end.getDate() - 1);

    // running balance starts at openingBalance
    let runningBalance = openingBalance || 0;

    // iterate day by day
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toISO(d);
        // find all transactions that occur on this date (including recurrences)
        const todays = transactions.filter(t => txOccursOn(t, iso));

        let income = 0;
        let expense = 0;
        const descs = [];

        todays.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
            const catStr = t.category ? ` (${escapeHtml(t.category)})` : "";
            const label = t.frequency === 'irregular'
                ? `<span class="irregular">${escapeHtml(t.description)}${catStr}</span>`
                : `${escapeHtml(t.description)}${catStr}`;
            descs.push(label);
        });

        runningBalance += income - expense;

        const tr = document.createElement("tr");
        tr.setAttribute("data-date", iso);
        if (runningBalance < 0) tr.classList.add("negative");
        tr.innerHTML = `
            <td>${formatDate(iso)}</td>
            <td>${descs.join("<br>")}</td>
            <td>${income > 0 ? income.toFixed(2) : ""}</td>
            <td>${expense > 0 ? expense.toFixed(2) : ""}</td>
            <td>${runningBalance.toFixed(2)}</td>
        `;
        projectionTbody.appendChild(tr);
    }
}

// ---------- Find / Find Next ----------
let lastFindIndex = -1;
function findNext() {
    const q = (findInput.value || "").trim().toLowerCase();
    if (!q) return alert("Enter search text for Find.");
    const rows = Array.from(transactionTableBody.querySelectorAll("tr"));
    if (rows.length === 0) return alert("No transactions to search.");
    let start = lastFindIndex + 1;
    if (start >= rows.length) start = 0;
    for (let i = 0; i < rows.length; i++) {
        const idx = (start + i) % rows.length;
        const row = rows[idx];
        const txt = row.textContent.toLowerCase();
        if (txt.includes(q)) {
            // clear highlights
            rows.forEach(r => r.classList.remove("highlight"));
            row.classList.add("highlight");
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            lastFindIndex = idx;
            return;
        }
    }
    alert("No more matches.");
}

findNextBtn.addEventListener("click", findNext);
findInput.addEventListener("input", () => lastFindIndex = -1);

// ---------- Go to date in projection ----------
function gotoDate() {
    const date = gotoDateInput.value;
    if (!date) return alert("Choose a date first.");
    const row = projectionTbody.querySelector(`tr[data-date="${date}"]`);
    if (!row) return alert("Date not found in projection (ensure Start Date is set and Save was clicked).");
    // clear highlights
    Array.from(projectionTbody.querySelectorAll("tr")).forEach(r => r.classList.remove("highlight"));
    row.classList.add("highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
}
gotoDateBtn.addEventListener("click", gotoDate);

// also allow clicking date cell in transaction table to go to projection date
transactionTableBody.addEventListener("click", (e) => {
    const cell = e.target.closest("td");
    if (!cell) return;
    const row = e.target.closest("tr");
    if (!row) return;
    // if first cell (date) clicked
    const cellIndex = Array.from(row.children).indexOf(cell);
    if (cellIndex === 0) {
        // read date text and try to find a transaction date by matching the row's delete button mapping
        const deleteBtn = row.querySelector(".delete-btn");
        if (!deleteBtn) return;
        const btnIdx = parseInt(deleteBtn.getAttribute("data-index"), 10);
        // We need to map button idx back to original transactions; find the corresponding sorted tx as earlier
        const sorted = [...transactions].sort((a,b) => {
            const da = a.date ? new Date(a.date) : new Date(0);
            const db = b.date ? new Date(b.date) : new Date(0);
            return da - db;
        });
        const tx = sorted[btnIdx];
        if (tx && tx.date) {
            gotoDateInput.value = tx.date;
            gotoDate();
        }
    }
});

// ---------- Initialization ----------
function init() {
    normalizeStoredTransactions();
    updateCategoryDropdown();
    renderTransactionTable();
    renderProjectionTable();
}
init();
