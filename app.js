document.addEventListener("DOMContentLoaded", function() {

    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

    const startDateEl = document.getElementById("startDate");
    const openingBalanceEl = document.getElementById("openingBalance");
    const saveConfigBtn = document.getElementById("saveConfigBtn");

    const descriptionEl = document.getElementById("description");
    const typeEl = document.getElementById("type");
    const amountEl = document.getElementById("amount");
    const categoryEl = document.getElementById("category");
    const frequencyEl = document.getElementById("frequency");
    const dateEl = document.getElementById("date");
    const addBtn = document.getElementById("addBtn");

    const exportCSVBtn = document.getElementById("exportCSVBtn");
    const restoreCSVInput = document.getElementById("restoreCSVInput");
    const restoreCSVBtn = document.getElementById("restoreCSVBtn");

    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // ---------- Helper ----------
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMMYYYY(dateStr) {
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(dateStr).toLocaleDateString('en-GB', options).replace(/ /g, '-');
    }

    function calculateBalances() {
        let balance = parseFloat(openingBalanceEl.value) || 0;
        transactions.forEach(tx => {
            if (tx.type === "income") balance += tx.amount;
            else balance -= tx.amount;
            tx.balance = balance;
        });
    }

    // ---------- Render Transactions ----------
    function renderTransactions() {
        const tbody = document.querySelector("#transactionsTable tbody");
        tbody.innerHTML = "";

        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        calculateBalances();
        saveTransactions();

        transactions.forEach((tx, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${formatDateDDMMMYYYY(tx.date)}</td>
                <td class="${tx.frequency === "irregular" ? "desc-strong" : ""}">${tx.description}</td>
                <td>${tx.category}</td>
                <td class="${tx.type}">${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${tx.balance.toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;

            tbody.appendChild(row);
        });

        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const idx = parseInt(this.dataset.index);
                if (confirm(`Delete transaction "${transactions[idx].description}" on ${formatDateDDMMMYYYY(transactions[idx].date)}?`)) {
                    transactions.splice(idx, 1);
                    renderTransactions();
                    renderDailyProjection();
                }
            });
        });
    }

    // ---------- Add Transaction ----------
    function addTransaction() {
        const tx = {
            description: descriptionEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value),
            category: categoryEl.value.trim(),
            frequency: frequencyEl.value,
            date: dateEl.value
        };
        if (!tx.description || isNaN(tx.amount) || !tx.date) return alert("Please fill in Description, Amount, and Date.");
        transactions.push(tx);

        descriptionEl.value = "";
        amountEl.value = "";
        categoryEl.value = "";
        dateEl.value = "";

        renderTransactions();
        renderDailyProjection();
    }

    saveConfigBtn.addEventListener("click", function() {
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderDailyProjection();
    });

    addBtn.addEventListener("click", function(e) {
        e.preventDefault();
        addTransaction();
    });

    // ---------- Export CSV ----------
    exportCSVBtn.addEventListener("click", function() {
        if (transactions.length === 0) return alert("No transactions to export.");
        const headers = ["Date","Description","Category","Type","Amount","Balance"];
        const csvRows = [headers.join(",")];
        transactions.forEach(tx => {
            const row = [
                tx.date,
                `"${tx.description}"`,
                `"${tx.category}"`,
                tx.type,
                tx.amount.toFixed(2),
                tx.balance ? tx.balance.toFixed(2) : ""
            ];
            csvRows.push(row.join(","));
        });
        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "transactions_backup.csv";
        a.click();
        URL.revokeObjectURL(url);
    });

    // ---------- Restore CSV ----------
    restoreCSVBtn.addEventListener("click", function() {
        const file = restoreCSVInput.files[0];
        if (!file) return alert("Please select a CSV file to restore.");
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const rows = text.split("\n").slice(1);
            const restored = rows.map(row => {
                const [date, desc, cat, type, amount, balance] = row.split(",");
                return {
                    date,
                    description: desc.replace(/^"|"$/g, ""),
                    category: cat.replace(/^"|"$/g, ""),
                    type,
                    amount: parseFloat(amount),
                    balance: balance ? parseFloat(balance) : 0,
                    frequency: "irregular" // default restored frequency
                };
            });
            transactions = restored;
            saveTransactions();
            renderTransactions();
            renderDailyProjection();
        };
        reader.readAsText(file);
    });

    // ---------- Daily Projection ----------
    function renderDailyProjection() {
        const tbody = document.querySelector("#dailyProjectionTable tbody");
        tbody.innerHTML = "";
        const startDateStr = startDateEl.value;
        if (!startDateStr) return;

        let balance = parseFloat(openingBalanceEl.value) || 0;
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 24, startDate.getDate());

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)) {
            transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate.toDateString() === d.toDateString()) {
                    if (tx.type === "income") balance += tx.amount;
                    else balance -= tx.amount;
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td class="freeze-col">${formatDateDDMMMYYYY(tx.date)}</td>
                        <td>${tx.description}</td>
                        <td>${tx.category}</td>
                        <td>${tx.type}</td>
                        <td>${tx.amount.toFixed(2)}</td>
                        <td>${balance.toFixed(2)}</td>
                    `;
                    tbody.appendChild(row);
                }
            });
        }
    }

    // ---------- Initial render ----------
    renderTransactions();
    renderDailyProjection();
});
