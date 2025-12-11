// -------------------------
// Local Storage Handling
// -------------------------
function load() {
    return JSON.parse(localStorage.getItem("transactions") || "[]");
}
function save(transactions) {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}
function saveConfig() {
    localStorage.setItem("startDate", document.getElementById("startDate").value);
    localStorage.setItem("openingBalance", document.getElementById("openingBalance").value);
}
function loadConfig() {
    document.getElementById("startDate").value = localStorage.getItem("startDate") || "";
    document.getElementById("openingBalance").value = localStorage.getItem("openingBalance") || "";
}

// -------------------------
// Add New Transaction
// -------------------------
document.getElementById("addBtn").addEventListener("click", () => {
    let transactions = load();

    const rawAmount = document.getElementById("amount").value;
    const parsedAmount = rawAmount === "" ? 0 : parseFloat(rawAmount);

    const tx = {
        id: Date.now(),
        description: document.getElementById("description").value || "",
        category: document.getElementById("category").value || "",
        type: document.getElementById("type").value,
        frequency: document.getElementById("frequency").value,
        amount: parsedAmount,
        date: document.getElementById("date").value
    };

    transactions.push(tx);
    save(transactions);

    // Clear fields after adding
    document.getElementById("description").value = "";
    document.getElementById("category").value = "";
    document.getElementById("type").value = "expense";
    document.getElementById("frequency").value = "monthly";
    document.getElementById("amount").value = "";
    document.getElementById("date").value = "";

    // reset any find state (keeps UX simple)
    clearFindHighlights();

    renderTransactions();
});

document.getElementById("saveConfigBtn").addEventListener("click", () => {
    saveConfig();
    renderTransactions();
});

// -------------------------
// Recurrence Generators
// -------------------------
function addMonths(date, n) {
    let d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}
function addWeeks(date, n) {
    let d = new Date(date);
    d.setDate(d.getDate() + n * 7);
    return d;
}

// -------------------------
// Build 24-Month Projection
// -------------------------
function buildProjection(transactions) {
    const savedStart = localStorage.getItem("startDate");
    if (!savedStart) return [];

    const startDate = new Date(savedStart);
    const endDate = addMonths(startDate, 24);

    let projected = [];

    transactions.forEach(tx => {
        if (!tx.date) return; // skip if no date
        let d = new Date(tx.date);

        // If initial date is before the start date, move it forward to first occurrence at/after startDate
        if (d < startDate) {
            if (tx.frequency === "monthly") {
                while (d < startDate) d = addMonths(d, 1);
            } else if (tx.frequency === "4weekly") {
                while (d < startDate) d = addWeeks(d, 4);
            } else {
                // irregular: skip if before start
                if (d < startDate) return;
            }
        }

        while (d <= endDate) {
            projected.push({
                ...tx,
                date: d.toISOString().split("T")[0]
            });

            if (tx.frequency === "monthly") {
                d = addMonths(d, 1);
            } else if (tx.frequency === "4weekly") {
                d = addWeeks(d, 4);
            } else {
                break; // irregular: single instance
            }
        }
    });

    return projected;
}

// -------------------------
// Render Transaction Table
// -------------------------
function renderTransactions() {
    loadConfig();

    let transactions = load();
    let projected = buildProjection(transactions);

    projected.sort((a, b) => new Date(a.date) - new Date(b.date));

    const tbody = document.querySelector("#transactionsTable tbody");
    tbody.innerHTML = "";

    let balance = parseFloat(localStorage.getItem("openingBalance") || "0");

    projected.forEach(tx => {
        if (tx.type === "income") balance += tx.amount;
        else balance -= tx.amount;

        const row = document.createElement("tr");
        const descClass = tx.frequency === "irregular" ? "desc-strong" : "";
        row.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td class="${descClass}">${escapeHtml(tx.description)}</td>
            <td>${escapeHtml(tx.category)}</td>
            <td>${tx.type}</td>
            <td class="${tx.type}">£${tx.amount.toFixed(2)}</td>
            <td>£${balance.toFixed(2)}</td>
            <td><button class="del-btn" data-id="${tx.id}">X</button></td>
        `;

        tbody.appendChild(row);
    });

    // attach delete handlers (use event delegation for safety)
    document.querySelectorAll(".del-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = parseInt(e.currentTarget.getAttribute("data-id"));
            deleteTx(id);
        });
    });

    // Re-apply any find highlight state if a search term exists
    if (currentFindTerm) {
        computeFindMatches(projected); // recompute indexes
        highlightCurrentFind(projected);
    } else {
        clearFindHighlights();
    }

    renderMonthlySummary(projected);
    renderChart(projected);
}

// -------------------------
// Delete Transaction
// -------------------------
function deleteTx(id) {
    let transactions = load();
    transactions = transactions.filter(t => t.id !== id);
    save(transactions);
    renderTransactions();
}

// -------------------------
// Date Formatting
// -------------------------
function formatDate(d) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

// -------------------------
// HTML escape (small safety)
function escapeHtml(s) {
    if (!s) return "";
    return s.replace(/[&<>"']/g, function(m) {
        return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m];
    });
}

// -------------------------
// Monthly Summary
// -------------------------
function renderMonthlySummary(projected) {
    const tbody = document.querySelector("#summaryTable tbody");
    tbody.innerHTML = "";

    if (!projected.length) return;

    const startBalance = parseFloat(localStorage.getItem("openingBalance") || "0");
    let running = startBalance;

    const summary = {};

    projected.forEach(tx => {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;

        if (!summary[key]) {
            summary[key] = { income: 0, expense: 0, closing: 0 };
        }

        if (tx.type === "income") summary[key].income += tx.amount;
        else summary[key].expense += tx.amount;
    });

    let keys = Object.keys(summary).sort();

    keys.forEach(key => {
        const m = summary[key];
        running += m.income - m.expense;
        m.closing = running;

        const row = document.createElement("tr");
        const label = new Date(key + "-01").toLocaleString("en-GB", { month: "short", year: "numeric" });

        row.innerHTML = `
            <td>${label}</td>
            <td>£${m.income.toFixed(2)}</td>
            <td>£${m.expense.toFixed(2)}</td>
            <td>£${(m.income - m.expense).toFixed(2)}</td>
            <td>£${m.closing.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

// -------------------------
// Chart Rendering (simple balance line)
function renderChart(projected) {
    const canvas = document.getElementById("budgetChart");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!projected.length) return;

    const startBalance = parseFloat(localStorage.getItem("openingBalance") || "0");
    let bal = startBalance;

    let balances = [];
    projected.forEach(tx => {
        if (tx.type === "income") bal += tx.amount;
        else bal -= tx.amount;
        balances.push(bal);
    });

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, 330);
    ctx.lineTo(880, 330);
    ctx.strokeStyle = "#333";
    ctx.stroke();

    const max = Math.max(...balances, 1); // guard
    const min = Math.min(...balances, 0);
    const range = max - min || 1;
    const scaleY = 300 / range;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2a7bff";

    balances.forEach((v, i) => {
        const x = 40 + i * (820 / Math.max(1, balances.length));
        const y = 330 - ((v - min) * scaleY);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
}

// -------------------------
// Find / Find Next Logic (Description only)
// -------------------------
let currentFindTerm = "";
let findMatches = []; // array of row indices in the projected array
let currentFindIndex = -1;
let lastProjectedForFind = []; // store projected array corresponding to table rows

const findInput = document.getElementById("findInput");
const findBtn = document.getElementById("findBtn");
const findNextBtn = document.getElementById("findNextBtn");
const clearFindBtn = document.getElementById("clearFindBtn");

findBtn.addEventListener("click", () => {
    currentFindTerm = findInput.value.trim();
    if (!currentFindTerm) return;
    const projected = lastProjectedForFind.length ? lastProjectedForFind : buildProjection(load());
    computeFindMatches(projected);
    if (findMatches.length) {
        currentFindIndex = 0;
        highlightCurrentFind(projected);
    } else {
        alert("No matches found.");
    }
});

findNextBtn.addEventListener("click", () => {
    if (!currentFindTerm || !findMatches.length) return;
    currentFindIndex = (currentFindIndex + 1) % findMatches.length;
    const projected = lastProjectedForFind.length ? lastProjectedForFind : buildProjection(load());
    highlightCurrentFind(projected);
});

clearFindBtn.addEventListener("click", () => {
    currentFindTerm = "";
    findInput.value = "";
    findMatches = [];
    currentFindIndex = -1;
    clearFindHighlights();
});

// Build list of matches (indexes into projected array)
function computeFindMatches(projected) {
    findMatches = [];
    lastProjectedForFind = projected.slice(); // copy so indexing matches table
    projected.forEach((tx, idx) => {
        if (!tx.description) return;
        if (tx.description.toLowerCase().includes(currentFindTerm.toLowerCase())) {
            findMatches.push(idx);
        }
    });
    if (findMatches.length === 0) {
        currentFindIndex = -1;
    } else {
        currentFindIndex = 0;
    }
}

// Highlight current match and scroll into view
function highlightCurrentFind(projected) {
    clearFindHighlights();
    if (!findMatches.length || currentFindIndex < 0) return;

    const matchIdx = findMatches[currentFindIndex];

    const tbody = document.querySelector("#transactionsTable tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));

    if (rows[matchIdx]) {
        rows[matchIdx].classList.add("highlight-row");
        rows[matchIdx].scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

// Remove any highlight class
function clearFindHighlights() {
    document.querySelectorAll("#transactionsTable tbody tr").forEach(r => r.classList.remove("highlight-row"));
}

// -------------------------
// Jump buttons (smooth)
document.getElementById("jumpToSummaryBtn").addEventListener("click", () => {
    document.getElementById("monthlySummary").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("backToTopBtn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// -------------------------
// Utility: when table is rendered we store the projected array used for find
// Modify renderTransactions: we stored projected earlier; ensure lastProjectedForFind sync
// (We will update lastProjectedForFind inside renderTransactions)
(function overrideRenderTransactionsForFind() {
    const orig = renderTransactions;
    renderTransactions = function() {
        // call original render code body defined above by referencing the function's code.
        // But since we already have a renderTransactions implementation, overwrite earlier definition:
    };
})();

// To ensure lastProjectedForFind is in sync, replace renderTransactions with an updated version:
function renderTransactions() {
    loadConfig();

    let transactions = load();
    let projected = buildProjection(transactions);

    projected.sort((a, b) => new Date(a.date) - new Date(b.date));

    lastProjectedForFind = projected.slice(); // keep for find indexing

    const tbody = document.querySelector("#transactionsTable tbody");
    tbody.innerHTML = "";

    let balance = parseFloat(localStorage.getItem("openingBalance") || "0");

    projected.forEach(tx => {
        if (tx.type === "income") balance += tx.amount;
        else balance -= tx.amount;

        const row = document.createElement("tr");
        const descClass = tx.frequency === "irregular" ? "desc-strong" : "";
        row.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td class="${descClass}">${escapeHtml(tx.description)}</td>
            <td>${escapeHtml(tx.category)}</td>
            <td>${tx.type}</td>
            <td class="${tx.type}">£${tx.amount.toFixed(2)}</td>
            <td>£${balance.toFixed(2)}</td>
            <td><button class="del-btn" data-id="${tx.id}">X</button></td>
        `;

        tbody.appendChild(row);
    });

    // attach delete handlers (use event delegation for safety)
    document.querySelectorAll(".del-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = parseInt(e.currentTarget.getAttribute("data-id"));
            deleteTx(id);
        });
    });

    // Re-apply any find highlight state if a search term exists
    if (currentFindTerm) {
        computeFindMatches(projected);
        if (findMatches.length) {
            // keep currentFindIndex within bounds
            if (currentFindIndex >= findMatches.length) currentFindIndex = 0;
            highlightCurrentFind(projected);
        } else {
            clearFindHighlights();
        }
    } else {
        clearFindHighlights();
    }

    renderMonthlySummary(projected);
    renderChart(projected);
}

// -------------------------
// Init
// -------------------------
loadConfig();
renderTransactions();
