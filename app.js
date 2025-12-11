// ================================
// Home Budget Tracker - app.js
// Implements:
// - categories (add, persist)
// - add/delete transactions
// - recurring transactions (monthly, 4-weekly, irregular)
// - 24-month daily projection (one row per day)
// - find / find next in transaction table
// - auto-scroll to date in projection table
// - bold irregular transactions, negative-day highlight
// ================================

// --- Persistence / Data ---
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// --- DOM refs (match ids in index.html) ---
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

// --- Utility functions ---
function isoDate(d) {
    if (!d) return "";
    const dt = (d instanceof Date) ? d : new Date(d);
    return dt.toISOString().split('T')[0];
}
function formatDate(val) {
    if (!val) return "";
    const d = new Date(val);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// --- Category handling ---
function updateCategoryDropdown() {
    txCategorySelect.innerHTML = '<option value="" disabled>Select category</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);
    });
}
function addCategory() {
    const newCat = newCategoryInput.value.trim();
    if (!newCat) return;
    if (!categories.includes(newCat)) {
        categories.push(newCat);
        localStorage.setItem("categories", JSON.stringify(categories));
    }
    newCategoryInput.value = "";
    updateCategoryDropdown();
    txCategorySelect.value = newCat;
}
addCategoryButton.addEventListener("click", addCategory);

// --- Config handling ---
saveConfigButton.addEventListener("click", () => {
    startDate = startDateInput.value;
    openingBalance = parseFloat(openingBalanceInput.value) || 0;
    localStorage.setItem("startDate", startDate);
    localStorage.setItem("openingBalance", openingBalance);
    renderProjectionTable();
});
startDateInput.value = startDate;
openingBalanceInput.value = isNaN(openingBalance) ? "" : openingBalance;

// --- Transactions: add / delete / render ---
function saveTransactions() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

function addTransactionObj(obj) {
    // expected obj: {date, description, type, amount, frequency, category}
    transactions.push(obj);
    // sort by date (earliest first), stable sort
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}

addTxButton.addEventListener("click", () => {
    const tx = {
        date: txDate.value || "",
        description: txDesc.value.trim(),
        type: txType.value,
        amount: parseFloat(txAmount.value) || 0,
        frequency: txFrequency.value,
        category: txCategorySelect.value || ""
    };
    if (!tx.description) {
        alert("Please enter a description.");
        return;
    }
    if (!tx.date && tx.frequency !== 'irregular') {
        alert("Please choose a start date for recurring transactions.");
        return;
    }
    addTransactionObj(tx);

    // clear form
    txDesc.value = "";
    txAmount.value = "";
    txDate.value = "";
    txCategorySelect.value = "";
    txFrequency.value = "irregular";
    txType.value = "expense";
});

// Delete by index
function deleteTransaction(index) {
    if (index < 0 || index >= transactions.length) return;
    transactions.splice(index, 1);
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}

// Render transaction table (with delete and bold irregular)
function renderTransactionTable() {
    transactionTableBody.innerHTML = "";
    let runningBalance = openingBalance || 0;

    // we compute running balance in chronological order
    transactions.forEach((tx, idx) => {
        runningBalance += tx.type === "income" ? tx.amount : -tx.amount;

        const row = document.createElement("tr");

        // mark description bold if irregular
        const descHtml = tx.frequency === 'irregular'
            ? `<span class="irregular">${escapeHtml(tx.description)}</span>`
            : escapeHtml(tx.description);

        row.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td>${descHtml}</td>
            <td>${escapeHtml(tx.type)}</td>
            <td>${tx.amount.toFixed(2)}</td>
            <td>${escapeHtml(tx.category || "")}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td><button class="delete-btn" data-index="${idx}">Delete</button></td>
        `;
        transactionTableBody.appendChild(row);

        row.querySelector(".delete-btn").addEventListener("click", (e) => {
            const i = parseInt(e.target.getAttribute("data-index"), 10);
            if (confirm("Delete this transaction?")) deleteTransaction(i);
        });
    });
}

// escape simple HTML to avoid injection from data
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// --- Projection table (24 months of daily rows) ---
// Determine if a transaction should apply on a specific date
function txOccursOn(tx, dateIso) {
    if (!tx || !dateIso) return false;
    // irregular: only if dates exactly equal
    if (tx.frequency === 'irregular') {
        return tx.date === dateIso;
    }
    // For recurring (monthly or 4-weekly), tx.date is the start date for recurrence.
    if (!tx.date) return false;
    const start = new Date(tx.date);
    const d = new Date(dateIso);

    // only apply if d >= start
    if (d < start) return false;

    if (tx.frequency === 'monthly') {
        // apply if day-of-month matches
        const startDay = start.getDate();
        // handle end-of-month cases: if startDay > last day of current month, match last day
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const dayToMatch = Math.min(startDay, lastDay);
        return d.getDate() === dayToMatch;
    }
    if (tx.frequency === '4-weekly') {
        // every 28 days from start
        const diffDays = Math.floor((d - start) / (1000 * 60 * 60 * 24));
        return diffDays % 28 === 0;
    }
    return false;
}

function renderProjectionTable() {
    projectionTbody.innerHTML = "";

    if (!startDate) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" class="small">Please set a Start Date in Configuration and press Save to generate the projection.</td>`;
        projectionTbody.appendChild(tr);
        return;
    }

    const start = new Date(startDate);
    const end = new Date(start);
    // set to 24 months later, then step back one day to get exactly 24 months of days
    end.setMonth(end.getMonth() + 24);
    end.setDate(end.getDate() - 1);

    let runningBalance = openingBalance || 0;
    // We'll prebuild an array of dates to enable find/goto easily
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateIso = isoDate(d);

        // collect all transactions that "occur" on this date (including recurring ones)
        const todays = transactions.filter(tx => txOccursOn(tx, dateIso));

        let income = 0;
        let expense = 0;
        let descs = [];

        todays.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
            const category = t.category ? ` (${escapeHtml(t.category)})` : "";
            // mark irregular ones bold here too
            const label = t.frequency === 'irregular'
                ? `<span class="irregular">${escapeHtml(t.description)}${category}</span>`
                : `${escapeHtml(t.description)}${category}`;
            descs.push(label);
        });

        runningBalance += income - expense;

        const row = document.createElement("tr");
        // attach data-date attribute for goto/scroll
        row.setAttribute("data-date", dateIso);

        if (runningBalance < 0) row.classList.add("negative");

        row.innerHTML = `
            <td>${formatDate(dateIso)}</td>
            <td>${descs.join("<br>")}</td>
            <td>${income > 0 ? income.toFixed(2) : ""}</td>
            <td>${expense > 0 ? expense.toFixed(2) : ""}</td>
            <td>${runningBalance.toFixed(2)}</td>
        `;
        projectionTbody.appendChild(row);
    }
}

// --- Find / Find Next in the transaction table ---
let lastFindIndex = -1;
function findNext() {
    const term = (findInput.value || "").trim().toLowerCase();
    if (!term) return alert("Enter search text for Find.");

    const rows = Array.from(transactionTableBody.querySelectorAll("tr"));
    // start after lastFindIndex
    let start = lastFindIndex + 1;
    if (start >= rows.length) start = 0;

    for (let i = 0; i < rows.length; i++) {
        const idx = (start + i) % rows.length;
        const row = rows[idx];
        const txt = row.textContent.toLowerCase();
        if (txt.includes(term)) {
            // clear previous highlights
            rows.forEach(r => r.classList.remove("highlight"));
            row.classList.add("highlight");
            row.scrollIntoView({block: "center", behavior: "smooth"});
            lastFindIndex = idx;
            return;
        }
    }
    alert("No more matches.");
}
findNextBtn.addEventListener("click", findNext);

// reset lastFindIndex if user edits term
findInput.addEventListener("input", () => lastFindIndex = -1);

// --- Go to date in projection table ---
function gotoDate() {
    const date = gotoDateInput.value;
    if (!date) return alert("Choose a date first.");
    const row = projectionTbody.querySelector(`tr[data-date="${date}"]`);
    if (!row) return alert("Date not found in projection (ensure Start Date is set and Save was clicked).");
    // clear old highlights
    const all = Array.from(projectionTbody.querySelectorAll("tr"));
    all.forEach(r => r.classList.remove("highlight"));
    row.classList.add("highlight");
    row.scrollIntoView({block: "center", behavior: "smooth"});
}
gotoDateBtn.addEventListener("click", gotoDate);

// --- Utility: auto scroll to selected date from transaction table (if user clicks on date cell) ---
transactionTableBody.addEventListener("click", (e) => {
    const cell = e.target.closest("td");
    if (!cell) return;
    const row = e.target.closest("tr");
    if (!row) return;
    // if user clicked the Date cell (first cell) scroll projection to that date
    const cellIndex = Array.from(row.children).indexOf(cell);
    if (cellIndex === 0) {
        // parse date text back to yyyy-mm-dd by searching transactions array for that row index
        const idx = parseInt(row.querySelector(".delete-btn").getAttribute("data-index"), 10);
        const tx = transactions[idx];
        if (tx && tx.date) {
            gotoDateInput.value = tx.date;
            gotoDate();
        }
    }
});

// --- Initial render ---
updateCategoryDropdown();
renderTransactionTable();
renderProjectionTable();
