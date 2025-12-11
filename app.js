// Load from localStorage
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

// Add a transaction
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
    renderTransactions();
});

// Save configuration
document.getElementById("saveConfigBtn").addEventListener("click", () => {
    saveConfig();
    renderTransactions();
});

// Generate recurring monthly
function addMonths(date, n) {
    let d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

// Generate 4-weekly recurrence
function addWeeks(date, n) {
    let d = new Date(date);
    d.setDate(d.getDate() + n * 7);
    return d;
}

// Create a 24-month projection based on frequency
function buildProjection(transactions) {
    let projected = [];

    const startDate = new Date(localStorage.getItem("startDate"));
    const endDate = addMonths(startDate, 24);

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
                break; // irregular: no repetition
            }
        }
    });

    return projected;
}

// Render the table
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
            <td>£${tx.amount.toFixed(2)}</td>
            <td>£${balance.toFixed(2)}</td>
            <td><button onclick="deleteTx(${tx.id})">X</button></td>
        `;

        tbody.appendChild(row);
    });
}

// Delete transaction
function deleteTx(id) {
    let transactions = load();
    transactions = transactions.filter(t => t.id !== id);
    save(transactions);
    renderTransactions();
}

// Format date dd-mon-yyyy
function formatDate(d) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

loadConfig();
renderTransactions();
