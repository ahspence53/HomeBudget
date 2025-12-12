// ================================
// app.js - Home Budget Tracker (updated)
// Implements: header/version, remove transaction balance column,
// negative-balance display & filter, corrected Find Next layout,
// transaction range search with totals.
// ================================

// ---------- Persistence / Data ----------
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// ---------- DOM refs ----------
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

const rangeFrom = document.getElementById("rangeFrom");
const rangeTo = document.getElementById("rangeTo");
const rangeDesc = document.getElementById("rangeDesc");
const rangeCat = document.getElementById("rangeCat");
const rangeType = document.getElementById("rangeType");
const rangeSearchBtn = document.getElementById("rangeSearchBtn");
const rangeSearchResults = document.getElementById("rangeSearchResults");

const showOnlyNegativeCheckbox = document.getElementById("showOnlyNegative");
const highlightNegativesCheckbox = document.getElementById("highlightNegatives");

// ---------- Utilities ----------
function toISO(dateLike) {
    if (!dateLike) return "";
    if (dateLike instanceof Date && !isNaN(dateLike)) {
        return dateLike.toISOString().split("T")[0];
    }
    const s = String(dateLike).trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (isoMatch.test(s)) {
        const d = new Date(s);
        if (!isNaN(d)) return d.toISOString().split("T")[0];
    }
    const dmMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const m = s.match(dmMatch);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d)) return d.toISOString().split("T")[0];
    }
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return "";
}

function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- Normalize stored transactions ----------
function normalizeStoredTransactions() {
    let changed = false;
    transactions = (transactions || []).map(tx => {
        const t = Object.assign({}, tx);
        t.description = t.description || "";
        t.frequency = t.frequency || "irregular";
        t.category = t.category || "";
        t.type = t.type || "expense";
        t.amount = parseFloat(t.amount) || 0;
        if (t.date) {
            const iso = toISO(t.date);
            if (iso && iso !== t.date) {
                t.date = iso;
                changed = true;
            } else if (!iso && t.date) {
                const parts = String(t.date).split(/[\/\-\.]/).map(p => p.trim());
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10), mon = parseInt(parts[1], 10)-1, yr = parseInt(parts[2], 10);
                    const d = new Date(yr, mon, day);
                    if (!isNaN(d)) {
                        t.date = d.toISOString().split("T")[0];
                        changed = true;
                    }
                }
            }
        }
        return t;
    });
    if (changed) {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }
}

// ---------- Category handling ----------
function updateCategoryDropdown() {
    txCategorySelect.innerHTML = '<option value="" disabled>Select category</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);
    });
}

// add category
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
    renderProjectionTable();
});

document.getElementById("back-to-top").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

startDateInput.value = startDate;
openingBalanceInput.value = isNaN(openingBalance) ? "" : openingBalance;

// ---------- Transactions: add / delete / persist ----------
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function addTransactionObj(obj) {
    const tx = {
        description: String(obj.description || "").trim(),
        amount: parseFloat(obj.amount) || 0,
        type: obj.type || 'expense',
        frequency: obj.frequency || 'irregular',
        category: obj.category || ""
    };
    tx.date = toISO(obj.date) || "";
    if (!tx.description) { alert("Please enter a description."); return; }
    if ((tx.frequency === 'monthly' || tx.frequency === '4-weekly') && !tx.date) {
        alert("Please choose a start date for recurring transactions.");
        return;
    }
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
    txDesc.value = "";
    txAmount.value = "";
    txDate.value = "";
    txCategorySelect.value = "";
    txFrequency.value = "irregular";
    txType.value = "expense";
});

function deleteTransaction(index) {
    if (index < 0 || index >= transactions.length) return;
    transactions.splice(index, 1);
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}

// ---------- Render transactions table (NO balance column) ----------
function renderTransactionTable() {
    transactionTableBody.innerHTML = "";

    const sorted = [...transactions].sort((a,b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return da - db;
    });

    sorted.forEach((tx, sortedIdx) => {
        const tr = document.createElement("tr");
        const descHtml = tx.frequency === 'irregular'
            ? `<span class="irregular">${escapeHtml(tx.description)}</span>`
            : escapeHtml(tx.description);

        tr.innerHTML = `
            <td>${tx.date ? formatDate(tx.date) : ""}</td>
            <td>${descHtml}</td>
            <td>${escapeHtml(tx.type)}</td>
            <td class="${tx.type === 'income' ? 'income' : 'expense'}">${tx.amount.toFixed(2)}</td>
            <td>${escapeHtml(tx.category || "")}</td>
            <td><button class="delete-btn" data-sorted-index="${sortedIdx}">Delete</button></td>
        `;
        transactionTableBody.appendChild(tr);

        tr.querySelector(".delete-btn").addEventListener("click", (e) => {
            const sIdx = parseInt(e.target.getAttribute("data-sorted-index"), 10);
            const txToDelete = sorted[sIdx];
            const origIdx = transactions.findIndex(t =>
                t.description === txToDelete.description &&
                t.amount === txToDelete.amount &&
                (t.date === txToDelete.date) &&
                t.type === txToDelete.type &&
                t.frequency === txToDelete.frequency &&
                t.category === txToDelete.category
            );
            if (origIdx === -1) {
                if (confirm("Delete this transaction?")) {
                    const mappedIdx = transactions.indexOf(txToDelete);
                    if (mappedIdx >= 0) deleteTransaction(mappedIdx);
                }
                return;
            }
            if (confirm("Delete this transaction?")) deleteTransaction(origIdx);
        });
    });
}

// ---------- Recurrence logic ----------
function txOccursOn(tx, dateIso) {
    if (!tx || !dateIso) return false;
    if (tx.frequency === 'irregular') {
        return tx.date === dateIso;
    }
    if (!tx.date) return false;
    const start = new Date(tx.date);
    const d = new Date(dateIso);
    if (d < start) return false;

    if (tx.frequency === 'monthly') {
        const startDay = start.getDate();
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const matchDay = Math.min(startDay, lastDay);
        return d.getDate() === matchDay;
    }

    if (tx.frequency === '4-weekly') {
        const diffMs = d - start;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % 28 === 0;
    }
    return false;
}

// ---------- Projection rendering (24 months, daily rows) ----------
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
    end.setMonth(end.getMonth() + 24);
    end.setDate(end.getDate() - 1);

    let runningBalance = openingBalance || 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toISO(d);
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
        const dailyBalanceCell = `<td class="daily-balance">${runningBalance.toFixed(2)}</td>`;
        tr.innerHTML = `
            <td>${formatDate(iso)}</td>
            <td>${descs.join("<br>")}</td>
            <td>${income > 0 ? income.toFixed(2) : ""}</td>
            <td>${expense > 0 ? expense.toFixed(2) : ""}</td>
            ${dailyBalanceCell}
        `;

        // mark negative rows with data attribute for filtering
        if (runningBalance < 0) tr.setAttribute("data-negative", "1");
        else tr.removeAttribute("data-negative");

        projectionTbody.appendChild(tr);
    }

    applyProjectionFilters();
}

// ---------- Projection filtering / highlight ----------
function applyProjectionFilters() {
    const showOnlyNeg = showOnlyNegativeCheckbox.checked;
    const highlight = highlightNegativesCheckbox.checked;

    Array.from(projectionTbody.querySelectorAll("tr")).forEach(row => {
        const isNeg = row.getAttribute("data-negative") === "1";
        // Show/hide
        row.style.display = (showOnlyNeg && !isNeg) ? "none" : "";
        // Apply highlight/negative-colour classes
        row.classList.toggle("proj-negative", highlight && isNeg);
    });
}

showOnlyNegativeCheckbox.addEventListener("change", applyProjectionFilters);
highlightNegativesCheckbox.addEventListener("change", applyProjectionFilters);

// ---------- Find / Find Next (transaction table) ----------
let lastFindIndex = -1;
function findNext() {
    const q = (findInput.value || "").trim().toLowerCase();
    if (!q) { alert("Enter search text for Find."); return; }
    const rows = Array.from(transactionTableBody.querySelectorAll("tr"));
    if (rows.length === 0) return alert("No transactions to search.");
    let start = lastFindIndex + 1;
    if (start >= rows.length) start = 0;
    for (let i = 0; i < rows.length; i++) {
        const idx = (start + i) % rows.length;
        const row = rows[idx];
        const txt = row.textContent.toLowerCase();
        if (txt.includes(q)) {
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
    Array.from(projectionTbody.querySelectorAll("tr")).forEach(r => r.classList.remove("highlight"));
    row.classList.add("highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
}
gotoDateBtn.addEventListener("click", gotoDate);

// If user clicks the date cell in transaction table, go to projection date (best effort)
transactionTableBody.addEventListener("click", (e) => {
    const cell = e.target.closest("td");
    if (!cell) return;
    const row = e.target.closest("tr");
    if (!row) return;
    const cellIndex = Array.from(row.children).indexOf(cell);
    if (cellIndex === 0) {
        const delBtn = row.querySelector(".delete-btn");
        if (!delBtn) return;
        const sIdx = parseInt(delBtn.getAttribute("data-sorted-index"), 10);
        const sorted = [...transactions].sort((a,b) => {
            const da = a.date ? new Date(a.date) : new Date(0);
            const db = b.date ? new Date(b.date) : new Date(0);
            return da - db;
        });
        const tx = sorted[sIdx];
        if (tx && tx.date) {
            gotoDateInput.value = tx.date;
            gotoDate();
        }
    }
});

// ---------- Range search for transactions (with totals) ----------
function rangeSearchTransactions() {
    const from = toISO(rangeFrom.value);
    const to = toISO(rangeTo.value);
    const desc = (rangeDesc.value || "").trim().toLowerCase();
    const cat = (rangeCat.value || "").trim().toLowerCase();
    const type = rangeType.value || "both";

    // Filter transactions by date and text/category
    const results = transactions.filter(t => {
        // date filter: if no date on tx (irregular without date) then exclude
        if (from && t.date && t.date < from) return false;
        if (to && t.date && t.date > to) return false;
        if (from && !t.date && t.frequency !== 'irregular') {
            // recurring entries have occurrences — for range totals we count occurrences from projections
            // fallback: include recurring entries if their start date is within range
            // We'll exclude ambiguous no-date irregulars
        }
        if (desc && !t.description.toLowerCase().includes(desc)) return false;
        if (cat && !t.category.toLowerCase().includes(cat)) return false;
        if (type !== 'both' && t.type !== type) return false;
        return true;
    });

    // For recurring transactions we should count occurrences in the date-range
    // We'll compute totals by scanning days between from and to and matching txOccursOn.
    let totalIncome = 0;
    let totalExpense = 0;
    let occurrences = [];

    // If no range dates supplied, just sum the filtered transactions once
    if (!from && !to) {
        results.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
            occurrences.push({
                date: t.date || "",
                description: t.description,
                category: t.category,
                amount: t.amount,
                type: t.type
            });
        });
    } else {
        const start = from ? new Date(from) : new Date(); // if no from, start from today (but better require from)
        const end = to ? new Date(to) : new Date(from || to || start);
        // iterate days inclusive
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const iso = toISO(d);
            // test each transaction for occurrence on iso
            transactions.forEach(t => {
                if (txOccursOn(t, iso)) {
                    // apply desc/category/type filters again for occurrences
                    if (desc && !t.description.toLowerCase().includes(desc)) return;
                    if (cat && !t.category.toLowerCase().includes(cat)) return;
                    if (type !== 'both' && t.type !== type) return;
                    if (t.type === 'income') totalIncome += t.amount;
                    else totalExpense += t.amount;
                    occurrences.push({
                        date: iso,
                        description: t.description,
                        category: t.category,
                        amount: t.amount,
                        type: t.type
                    });
                }
            });
        }
    }

    // Build HTML
    let html = `<h4>Found ${occurrences.length} occurrences</h4>`;
    html += `<p><strong>Total Income:</strong> £${totalIncome.toFixed(2)} &nbsp; <strong>Total Expense:</strong> £${totalExpense.toFixed(2)} &nbsp; <strong>Net:</strong> £${(totalIncome - totalExpense).toFixed(2)}</p>`;

    if (occurrences.length > 0) {
        html += `<table class="small-results"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead><tbody>`;
        occurrences.forEach(o => {
            html += `<tr><td>${o.date ? formatDate(o.date) : ""}</td><td>${escapeHtml(o.description)}</td><td>${escapeHtml(o.category)}</td><td>${escapeHtml(o.type)}</td><td class="${o.type==='income' ? 'income' : 'expense'}">${o.amount.toFixed(2)}</td></tr>`;
        });
        html += `</tbody></table>`;
    }
    rangeSearchResults.innerHTML = html;
}
rangeSearchBtn.addEventListener("click", rangeSearchTransactions);

// ---------- Init ----------
function init() {
    normalizeStoredTransactions();
    updateCategoryDropdown();
    renderTransactionTable();
    renderProjectionTable();
}
init();
