// ================================
// app.js - Home Budget Tracker (with Advanced Search modal + projection-find fix)
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

// Projection controls
const showOnlyNegativeCheckbox = document.getElementById("showOnlyNegative");
const highlightNegativesCheckbox = document.getElementById("highlightNegatives");

// Advanced search modal elements
const advOverlay = document.getElementById("adv-overlay");
const openAdvBtn = document.getElementById("open-advanced-search");
const closeAdvBtn = document.getElementById("close-advanced-search");
const advDesc = document.getElementById("adv-desc");
const advCategory = document.getElementById("adv-category");
const advFrom = document.getElementById("adv-from");
const advTo = document.getElementById("adv-to");
const advAmountField = document.getElementById("adv-amount-field");
const advAmountCompare = document.getElementById("adv-amount-compare");
const advAmount = document.getElementById("adv-amount");
const advSearchBtn = document.getElementById("adv-search-btn");
const advClearBtn = document.getElementById("adv-clear-btn");
const advFeedback = document.getElementById("adv-feedback");

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
    if (str === 0) return "0";
    if (!str) return "";
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
    advCategory.innerHTML = '<option value="">(any)</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);

        const opt2 = document.createElement("option");
        opt2.value = cat;
        opt2.textContent = cat;
        advCategory.appendChild(opt2);
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

// ---------- Render transactions table (no balance column) ----------
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

// ---------- Projection rendering (24 months) ----------
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
        tr.innerHTML = `
            <td>${formatDate(iso)}</td>
            <td>${descs.join("<br>")}</td>
            <td>${income > 0 ? income.toFixed(2) : ""}</td>
            <td>${expense > 0 ? expense.toFixed(2) : ""}</td>
            <td class="daily-balance">${runningBalance.toFixed(2)}</td>
        `;

        if (runningBalance < 0) tr.setAttribute("data-negative", "1");
        projectionTbody.appendChild(tr);
    }

    applyProjectionFilters();
}

// ---------- Projection filters/highlights ----------
function applyProjectionFilters() {
    const showOnlyNeg = showOnlyNegativeCheckbox.checked;
    const highlight = highlightNegativesCheckbox.checked;

    Array.from(projectionTbody.querySelectorAll("tr")).forEach(row => {
        const isNeg = row.getAttribute("data-negative") === "1";
        row.style.display = (showOnlyNeg && !isNeg) ? "none" : "";
        row.classList.toggle("proj-negative", highlight && isNeg);
    });
}

showOnlyNegativeCheckbox.addEventListener("change", applyProjectionFilters);
highlightNegativesCheckbox.addEventListener("change", applyProjectionFilters);

// ---------- Simple Find (search projection descriptions only) ----------
let simpleFindMatchIndexes = [];
let simpleFindCursor = -1;

function computeSimpleFindMatches() {
    simpleFindMatchIndexes = [];
    simpleFindCursor = -1;
    const q = (findInput.value || "").trim().toLowerCase();
    if (!q) return;
    const rows = Array.from(projectionTbody.querySelectorAll("tr"));
    rows.forEach((r, i) => {
        // description column is index 1 (second column)
        const descCell = r.children[1];
        const txt = descCell ? descCell.textContent.toLowerCase() : "";
        if (txt.includes(q)) simpleFindMatchIndexes.push(i);
    });
}

function simpleFindNext() {
    computeSimpleFindMatches();
    if (simpleFindMatchIndexes.length === 0) {
        alert("No matches for simple Find in projection descriptions.");
        return;
    }
    simpleFindCursor = (simpleFindCursor + 1) % simpleFindMatchIndexes.length;
    const rows = Array.from(projectionTbody.querySelectorAll("tr"));
    // clear previous simple highlights (but do NOT touch advanced highlights/classes)
    rows.forEach(r => r.classList.remove("simple-find-highlight"));

    const idx = simpleFindMatchIndexes[simpleFindCursor];
    const row = rows[idx];
    if (row) {
        row.classList.add("simple-find-highlight");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

findNextBtn.addEventListener("click", simpleFindNext);
findInput.addEventListener("input", () => {
    // reset cursor when user types a new query
    simpleFindMatchIndexes = [];
    simpleFindCursor = -1;
    // remove simple-find-highlight classes
    Array.from(projectionTbody.querySelectorAll("tr")).forEach(r => r.classList.remove("simple-find-highlight"));
});

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

// ---------- Transaction table click date goto ----------
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

// ---------- Advanced Search Modal logic (Option B) ----------
function openAdvModal() {
    advOverlay.style.display = "block";
    advOverlay.setAttribute("aria-hidden", "false");
    advFeedback.innerHTML = "";
}
function closeAdvModal() {
    advOverlay.style.display = "none";
    advOverlay.setAttribute("aria-hidden", "true");
}
openAdvBtn.addEventListener("click", openAdvModal);
closeAdvBtn.addEventListener("click", closeAdvModal);
advOverlay.addEventListener("click", (e) => { if (e.target === advOverlay) closeAdvModal(); });

// helper parse float (empty => 0)
function parseNumCell(text) {
    if (!text) return 0;
    const cleaned = String(text).replace(/[^0-9\.\-]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function applyAdvancedSearch() {
    // clear previous adv highlights
    Array.from(projectionTbody.querySelectorAll("tr")).forEach(r => {
        r.classList.remove("adv-highlight");
        r.removeAttribute("data-adv");
    });

    const descQ = (advDesc.value || "").trim().toLowerCase();
    const catQ = (advCategory.value || "").trim().toLowerCase();
    const from = toISO(advFrom.value) || "";
    const to = toISO(advTo.value) || "";
    const field = advAmountField.value; // none|income|expense|daily
    const cmp = advAmountCompare.value; // =, >, <
    const amt = advAmount.value !== "" ? parseFloat(advAmount.value) : null;

    const rows = Array.from(projectionTbody.querySelectorAll("tr"));
    let found = 0;

    rows.forEach(row => {
        // date filter
        const date = row.getAttribute("data-date") || "";
        if (from && date < from) return;
        if (to && date > to) return;

        // description filter (search row text — descriptions include "(Category)")
        const rowText = row.children[1] ? row.children[1].textContent.toLowerCase() : "";
        if (descQ && !rowText.includes(descQ)) return;

        // category filter — check row text for bracketed category OR full text
        if (catQ) {
            const hasCat = row.textContent.toLowerCase().includes(`(${catQ})`) || rowText.includes(`(${catQ})`) || rowText.includes(catQ);
            if (!hasCat) return;
        }

        // amount filter if requested
        if (field !== "none" && amt !== null) {
            const incomeCell = row.children[2] ? parseNumCell(row.children[2].textContent) : 0;
            const expenseCell = row.children[3] ? parseNumCell(row.children[3].textContent) : 0;
            const dailyCell = row.querySelector(".daily-balance") ? parseNumCell(row.querySelector(".daily-balance").textContent) : 0;
            let val = 0;
            if (field === "income") val = incomeCell;
            else if (field === "expense") val = expenseCell;
            else val = dailyCell;

            // comparison
            let ok = false;
            if (cmp === "=") ok = Math.abs(val - amt) < 0.0001;
            if (cmp === ">") ok = val > amt;
            if (cmp === "<") ok = val < amt;
            if (!ok) return;
        }

        // passed all checks -> highlight
        row.classList.add("adv-highlight");
        row.setAttribute("data-adv", "1");
        found++;
    });

    advFeedback.innerHTML = `<p>Found <strong>${found}</strong> matching projection rows. Highlights applied.</p>`;
    if (found > 0) {
        // scroll to first match
        const first = projectionTbody.querySelector('tr[data-adv="1"]');
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

advSearchBtn.addEventListener("click", applyAdvancedSearch);

function clearAdvancedHighlights() {
    Array.from(projectionTbody.querySelectorAll("tr")).forEach(r => {
        r.classList.remove("adv-highlight");
        r.removeAttribute("data-adv");
    });
    advFeedback.innerHTML = `<p>Highlights cleared.</p>`;
}
advClearBtn.addEventListener("click", clearAdvancedHighlights);

// ---------- Init ----------
function init() {
    normalizeStoredTransactions();
    updateCategoryDropdown();
    renderTransactionTable();
    renderProjectionTable();

    // ensure modal hidden
    advOverlay.style.display = "none";
    advOverlay.setAttribute("aria-hidden", "true");
}
init();
