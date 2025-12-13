// ======================================================
// Home Budget Tracker - Enhanced Version
// Sticky Find • Date Search • No Duplicate Dates
// ======================================================

// --------------------------
// Local Storage
// --------------------------
function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function loadData(key, defaultValue) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
}

// --------------------------
// Data
// --------------------------
let transactions = loadData("transactions", []);
let settings = loadData("settings", {
    startDate: "",
    openingBalance: 0
});

// --------------------------
// Elements
// --------------------------
const addBtn = document.getElementById("addTransaction");
const transactionTable = document.getElementById("transactionTable");
const projectionTable = document.getElementById("projectionTable");
const startDateInput = document.getElementById("startDate");
const openingBalanceInput = document.getElementById("openingBalance");

// Sticky Find toolbar
const findBar = document.getElementById("findBar");
const findInput = document.getElementById("findInput");
const findNextBtn = document.getElementById("findNext");
const findPrevBtn = document.getElementById("findPrev");
const findTopBtn  = document.getElementById("findTop");
const findCount = document.getElementById("findCount");

// Negative / irregular highlight toggles
const toggleNegRows = document.getElementById("toggleNegRows");
const toggleShowOnlyNeg = document.getElementById("toggleShowOnlyNeg");

let categories = JSON.parse(localStorage.getItem('categories')) || [];

// --------------------------
// Utility
// --------------------------
function formatDate(d) {
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function parseDate(input) {
    const parts = input.split(/[-/]/);
    if (parts.length === 3) {
        let [day, month, year] = parts;
        const parsed = new Date(`${day} ${month} ${year}`);
        if (!isNaN(parsed)) return parsed;
    }
    return new Date(input);
}

// --------------------------
// Render Transactions
// --------------------------
function renderTransactions() {
    transactionTable.innerHTML = "";

    // Sort newest date first
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    transactions.forEach((t, index) => {
        const row = document.createElement("tr");

        if (t.irregular) row.classList.add("irregular-row");

        row.innerHTML = `
            <td>${formatDate(new Date(t.date))}</td>
            <td><b>${t.description}</b></td>
            <td>${t.type}</td>
            <td>${t.amount.toFixed(2)}</td>
            <td>
                <button class="deleteBtn" data-index="${index}">Delete</button>
            </td>
        `;

        transactionTable.appendChild(row);
    });

    document.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.addEventListener("click", e => {
            const i = e.target.dataset.index;
            transactions.splice(i, 1);
            saveData("transactions", transactions);
            renderTransactions();
            buildProjection();
        });
    });
}

// --------------------------
// Build Projection Table
// --------------------------
function buildProjection() {
    projectionTable.innerHTML = "";

    if (!settings.startDate) return;

    const start = new Date(settings.startDate);
    let runningBalance = parseFloat(settings.openingBalance);

    const days = 730; // 24 months

    const rows = [];

    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);

        const dateStr = date.toISOString().split("T")[0];

        const todays = transactions.filter(t => t.date === dateStr);

        todays.forEach(t => {
            if (t.type === "income")
                runningBalance += parseFloat(t.amount);
            else
                runningBalance -= parseFloat(t.amount);
        });

        rows.push({
            date,
            list: todays,
            runningBalance
        });
    }

    rows.forEach(r => {
        const row = document.createElement("tr");

        if (toggleNegRows.checked && r.runningBalance < 0)
            row.classList.add("neg-row");

        if (toggleShowOnlyNeg.checked && r.runningBalance >= 0)
            row.classList.add("hidden-row");

        const transHtml = r.list.length
            ? r.list.map(t => `<div class="proj-${t.irregular ? "irreg" : "normal"}">${t.description} (${t.amount})</div>`).join("")
            : "";

        row.innerHTML = `
            <td>${formatDate(r.date)}</td>
            <td>${transHtml}</td>
            <td>${r.runningBalance.toFixed(2)}</td>
        `;

        projectionTable.appendChild(row);
    });
}
// ---------- Categories ----------
const txCategorySelect = document.getElementById("tx-category");
const newCategoryInput = document.getElementById("new-category");
const addCategoryButton = document.getElementById("add-category");

function updateCategoryDropdown() {
    txCategorySelect.innerHTML = '<option value="" disabled selected>Select category</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);
    });
}

function addCategory() {
    const newCat = (newCategoryInput.value || "").trim();
    if (!newCat) return;

    if (!categories.includes(newCat)) {
        categories.push(newCat);
        localStorage.setItem("categories", JSON.stringify(categories));
    }

    updateCategoryDropdown();
    txCategorySelect.value = newCat;
    newCategoryInput.value = "";
}

addCategoryButton.addEventListener("click", addCategory);

// Populate categories on load
updateCategoryDropdown();



// --------------------------
// Add Transaction
// --------------------------
addBtn.addEventListener("click", () => {
    const date = document.getElementById("tDate").value;
    const desc = document.getElementById("tDesc").value;
    const amt = parseFloat(document.getElementById("tAmount").value);
    const type = document.getElementById("tType").value;
    const irregular = document.getElementById("tIrregular").checked;

    if (!date || !desc || isNaN(amt)) return;

    transactions.push({
        date,
        description: desc,
        amount: amt,
        type,
        irregular
    });

    saveData("transactions", transactions);
    renderTransactions();
    buildProjection();
});

// --------------------------
// Sticky Find System
// --------------------------
let findMatches = [];
let findIndex = 0;

function clearFindHighlights() {
    document.querySelectorAll(".find-match").forEach(el => {
        el.classList.remove("find-match", "find-current");
    });
}

function runFind() {
    const query = findInput.value.trim().toLowerCase();
    clearFindHighlights();

    if (!query) {
        findMatches = [];
        findCount.textContent = "";
        return;
    }

    const rows = document.querySelectorAll("#projectionTable tr");

    findMatches = [];
    rows.forEach((row, idx) => {
        if (row.textContent.toLowerCase().includes(query)) {
            row.classList.add("find-match");
            findMatches.push(row);
        }
    });

    if (findMatches.length > 0) {
        findIndex = 0;
        focusFindMatch();
    }

    findCount.textContent = `${findMatches.length ? 1 : 0}/${findMatches.length}`;
}

function focusFindMatch() {
    clearFindHighlights();
    const row = findMatches[findIndex];
    if (!row) return;

    row.classList.add("find-current");

    row.scrollIntoView({ behavior: "smooth", block: "center" });

    findCount.textContent = `${findIndex + 1}/${findMatches.length}`;
}

findInput.addEventListener("input", runFind);

findNextBtn.addEventListener("click", () => {
    if (findMatches.length === 0) return;
    findIndex = (findIndex + 1) % findMatches.length;
    focusFindMatch();
});

findPrevBtn.addEventListener("click", () => {
    if (findMatches.length === 0) return;
    findIndex = (findIndex - 1 + findMatches.length) % findMatches.length;
    focusFindMatch();
});

// ✅ FIXED: Scroll to top now works
findTopBtn.addEventListener("click", () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});

// --------------------------
// Init
// --------------------------
startDateInput.addEventListener("change", () => {
    settings.startDate = startDateInput.value;
    saveData("settings", settings);
    buildProjection();
});

openingBalanceInput.addEventListener("change", () => {
    settings.openingBalance = openingBalanceInput.value;
    saveData("settings", settings);
    buildProjection();
});

startDateInput.value = settings.startDate;
openingBalanceInput.value = settings.openingBalance;

renderTransactions();
buildProjection();
