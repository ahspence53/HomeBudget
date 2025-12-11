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

    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

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
                if (confirm(`Delete "${transactions[idx].description}" on ${formatDateDDMMMYYYY(transactions[idx].date)} (£${transactions[idx].amount.toFixed(2)})?`)) {
                    transactions.splice(idx, 1);
                    renderTransactions();
                    renderProjection();
                }
            });
        });
    }

    function addTransaction() {
        const tx = {
            description: descriptionEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value),
            category: categoryEl.value.trim(),
            frequency: frequencyEl.value,
            date: dateEl.value
        };

        if (!tx.description || isNaN(tx.amount) || !tx.date) {
            alert("Please fill in Description, Amount, and Date.");
            return;
        }

        transactions.push(tx);
        descriptionEl.value = "";
        amountEl.value = "";
        categoryEl.value = "";
        dateEl.value = "";

        renderTransactions();
        renderProjection();
    }

    saveConfigBtn.addEventListener("click", function() {
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderProjection();
    });

    addBtn.addEventListener("click", function(e) { e.preventDefault(); addTransaction(); });

    function generateDailyProjection() {
        const startDateStr = startDateEl.value;
        if (!startDateStr) return [];

        let balance = parseFloat(openingBalanceEl.value) || 0;
        const projection = [];
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 24, startDate.getDate());

        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            let dailyIncome = 0;
            let dailyExpense = 0;

            transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                if (tx.frequency === "monthly") {
                    if (txDate.getDate() === d.getDate() && txDate <= d) tx.type === "income" ? dailyIncome += tx.amount : dailyExpense += tx.amount;
                } else if (tx.frequency === "4weekly") {
                    const diffDays = Math.floor((d - txDate)/(1000*60*60*24));
                    if (diffDays >= 0 && diffDays % 28 === 0) tx.type === "income" ? dailyIncome += tx.amount : dailyExpense += tx.amount;
                } else if (tx.frequency === "irregular") {
                    if (txDate.toDateString() === d.toDateString()) tx.type === "income" ? dailyIncome += tx.amount : dailyExpense += tx.amount;
                }
            });

            const net = dailyIncome - dailyExpense;
            balance += net;

            projection.push({ date: new Date(d), income: dailyIncome, expense: dailyExpense, net: net, balance: balance });
        }

        return projection;
    }

    function renderProjection() {
        const tbody = document.querySelector("#projectionTable tbody");
        tbody.innerHTML = "";
        const projection = generateDailyProjection();

        projection.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDateDDMMMYYYY(p.date)}</td>
                <td>${p.income.toFixed(2)}</td>
                <td>${p.expense.toFixed(2)}</td>
                <td>${p.net.toFixed(2)}</td>
                <td>${p.balance.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    document.getElementById("jumpToProjectionBtn").addEventListener("click", () => {
        document.getElementById("projectionSection").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("backToTopBtn").addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.getElementById("exportProjectionBtn").addEventListener("click", () => {
        const projection = generateDailyProjection();
        let csv = "Date,Total Income (£),Total Expenses (£),Net (£),Closing Balance (£)\n";
        projection.forEach(p => {
            const dStr = formatDateDDMMMYYYY(p.date);
            csv += `${dStr},${p.income.toFixed(2)},${p.expense.toFixed(2)},${p.net.toFixed(2)},${p.balance.toFixed(2)}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "daily_projection.csv";
        a.click();
        URL.revokeObjectURL(url);
    });

    renderTransactions();
    renderProjection();
});
