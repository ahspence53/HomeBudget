document.addEventListener("DOMContentLoaded", function() {

    // ---------- Initial Setup ----------
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

    const tbody = document.getElementById("transaction-list");

    // Load start date and opening balance from localStorage
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // ---------- Utility Functions ----------
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
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
        tbody.innerHTML = "";

        calculateBalances();
        saveTransactions();

        transactions.forEach((tx, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${tx.date}</td>
                <td class="${tx.frequency === "irregular" ? "desc-strong" : ""}">${tx.description}</td>
                <td>${tx.category}</td>
                <td class="${tx.type}">${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${tx.balance.toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            tbody.appendChild(row);
        });

        // Attach delete handlers
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const idx = parseInt(this.dataset.index);
                transactions.splice(idx, 1);
                renderTransactions();
                renderSummary();
                renderChart();
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

        if (!tx.description || isNaN(tx.amount) || !tx.date) {
            alert("Please fill in Description, Amount, and Date.");
            return;
        }

        transactions.push(tx);

        // Clear inputs
        descriptionEl.value = "";
        amountEl.value = "";
        categoryEl.value = "";
        dateEl.value = "";

        renderTransactions();
        renderSummary();
        renderChart();
    }

    // ---------- Save Config ----------
    saveConfigBtn.addEventListener("click", function() {
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderSummary();
        renderChart();
    });

    // ---------- Add Button ----------
    addBtn.addEventListener("click", function(e) {
        e.preventDefault(); // Prevent page reload
        addTransaction();
    });

    // ---------- Projection (24 months) ----------
    function generateProjection() {
        const startDateStr = startDateEl.value;
        let balance = parseFloat(openingBalanceEl.value) || 0;
        if (!startDateStr) return [];

        const projection = [];
        const startDate = new Date(startDateStr);

        for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
            const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);
            const monthStr = monthDate.toLocaleString("default", { month: "short", year: "numeric" });

            let monthlyIncome = 0;
            let monthlyExpense = 0;

            transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                const freq = tx.frequency;

                if (freq === "monthly" && txDate <= monthDate) {
                    if (tx.type === "income") monthlyIncome += tx.amount;
                    else monthlyExpense += tx.amount;
                } else if (freq === "4weekly" && txDate <= monthDate) {
                    if (tx.type === "income") monthlyIncome += tx.amount;
                    else monthlyExpense += tx.amount;
                } else if (freq === "irregular" && txDate.getMonth() === monthDate.getMonth() && txDate.getFullYear() === monthDate.getFullYear()) {
                    if (tx.type === "income") monthlyIncome += tx.amount;
                    else monthlyExpense += tx.amount;
                }
            });

            const net = monthlyIncome - monthlyExpense;
            balance += net;

            projection.push({
                month: monthStr,
                income: monthlyIncome,
                expense: monthlyExpense,
                net: net,
                balance: balance
            });
        }

        return projection;
    }

    // ---------- Render Projection Table ----------
    function renderSummary() {
        const summaryTbody = document.querySelector("#summaryTable tbody");
        summaryTbody.innerHTML = "";

        const projection = generateProjection();

        projection.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${p.month}</td>
                <td>${p.income.toFixed(2)}</td>
                <td>${p.expense.toFixed(2)}</td>
                <td>${p.net.toFixed(2)}</td>
                <td>${p.balance.toFixed(2)}</td>
            `;
            summaryTbody.appendChild(row);
        });
    }

    // ---------- Chart ----------
    let budgetChart;  // Chart instance

    function renderChart() {
        const projection = generateProjection();
        const labels = projection.map(p => p.month);
        const incomeData = projection.map(p => p.income);
        const expenseData = projection.map(p => p.expense);
        const balanceData = projection.map(p => p.balance);

        const ctx = document.getElementById("budgetChart").getContext("2d");

        // Destroy previous chart instance if exists
        if (budgetChart) budgetChart.destroy();

        budgetChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income (£)',
                        data: incomeData,
                        borderColor: '#1a8f2e',
                        backgroundColor: 'rgba(26,143,46,0.2)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Expenses (£)',
                        data: expenseData,
                        borderColor: '#cc0000',
                        backgroundColor: 'rgba(204,0,0,0.2)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Cumulative Balance (£)',
                        data: balanceData,
                        borderColor: '#2a7bff',
                        backgroundColor: 'rgba(42,123,255,0.2)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Financial Overview' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // ---------- Initial Render ----------
    renderTransactions();
    renderSummary();
    renderChart();
});
