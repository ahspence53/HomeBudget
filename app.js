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

    const tx = {
        id: Date.now(),
        description: document.getElementById("description").value,
        category: document.getElementById("category").value,
        type: document.getElementById("type").value,
        frequency: document.getElementById("frequency").value,
        amount: parseFloat(document.getElementById("amount").value),
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
        let d = new Date(tx.date);

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
                break; // irregular
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
        row.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td>${tx.description}</td>
            <td>${tx.category}</td>
            <td>${tx.type}</td>
            <td class="${tx.type}">£${tx.amount.toFixed(2)}</td>
            <td>£${balance.toFixed(2)}</td>
            <td><button onclick="deleteTx(${tx.id})">X</button></td>
        `;

        tbody.appendChild(row);
    });

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

        const label = new Date(key + "-01").toLocaleString("en-GB", {
            month: "short",
            year: "numeric"
        });

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
// Chart Rendering
// -------------------------
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
    ctx.stroke();

    const max = Math.max(...balances);
    const scale = 300 / max;

    // Draw line
    ctx.beginPath();
    ctx.lineWidth = 2;

    balances.forEach((v, i) => {
        const x = 40 + i * (820 / balances.length);
        const y = 330 - v * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
}


// -------------------------
// Init
// -------------------------
loadConfig();
renderTransactions();
