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

    // Load start date and opening balance from localStorage
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // ---------- Helper Functions ----------
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
                const tx = transactions[idx];
                const confirmDelete = confirm(`Are you sure you want to delete "${tx.description}" on ${formatDateDDMMMYYYY(tx.date)} (£${tx.amount.toFixed(2)})?`);
                if (confirmDelete) {
                    transactions.splice(idx, 1);
                    renderTransactions();
                    renderProjection();
                    renderSummary();
                    renderChart();
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
        renderSummary();
        renderChart();
    }

    // ---------- Save Config ----------
    saveConfigBtn.addEventListener("click", function() {
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderProjection();
        renderSummary();
        renderChart();
    });

    addBtn.addEventListener("click", function(e) {
        e.preventDefault();
        addTransaction();
    });

    // ---------- Projection ----------
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
                    tx.type === "income" ? monthlyIncome += tx.amount : monthlyExpense += tx.amount;
                } else if (freq === "4weekly" && txDate <= monthDate) {
                    tx.type === "income" ? monthlyIncome += tx.amount : monthlyExpense += tx.amount;
                } else if (freq === "irregular" && txDate.getMonth() === monthDate.getMonth() && txDate.getFullYear() === monthDate.getFullYear()) {
                    tx.type === "income" ? monthlyIncome += tx.amount : monthlyExpense += tx.amount;
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
    function renderProjection() {
        const tbody = document.querySelector("#projectionTable tbody");
        tbody.innerHTML = "";
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
            tbody.appendChild(row);
        });
    }

    // ---------- Export Projection CSV ----------
    document.getElementById("exportProjectionBtn").addEventListener("click", () => {
        const projection = generateProjection();
        let csv = "Month,Total Income (£),Total Expenses (£),Net (£),Closing Balance (£)\n";
        projection.forEach(p => {
            csv += `${p.month},${p.income.toFixed(2)},${p.expense.toFixed(2)},${p.net.toFixed(2)},${p.balance.toFixed(2)}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "projection.csv";
        a.click();
        URL.revokeObjectURL(url);
    });

    // ---------- Render Monthly Summary ----------
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

    // ---------- Jump Buttons ----------
    document.getElementById("jumpToProjectionBtn").addEventListener("click", () => {
        document.getElementById("projectionSection").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("backToTopBtn").addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // ---------- Chart ----------
    let budgetChart;
    function renderChart() {
        const projection = generateProjection();
        const labels = projection.map(p => p.month);
        const incomeData = projection.map(p => p.income);
        const expenseData = projection.map(p => p.expense);
        const balanceData = projection.map(p => p.balance);

        const ctx = document.getElementById("budgetChart").getContext("2d");
        if (budgetChart) budgetChart.destroy();

        budgetChart = new Chart(ctx, {
            data: {
                labels: labels,
                datasets: [
                    { type: 'bar', label: 'Income (£)', data: incomeData, backgroundColor: 'rgba(26,143,46,0.7)', stack: 'financial' },
                    { type: 'bar', label: 'Expenses (£)', data: expenseData, backgroundColor: 'rgba(204,0,0,0.7)', stack: 'financial' },
                    { type: 'line', label: 'Cumulative Balance (£)', data: balanceData, borderColor: '#2a7bff', backgroundColor: 'rgba(42,123,255,0.2)', yAxisID: 'balanceAxis', tension: 0.3, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' }, title: { display: true, text: 'Financial Overview' } },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, title: { display: true, text: 'Income / Expenses (£)' } },
                    balanceAxis: { position: 'right', beginAtZero: true, title: { display: true, text: 'Cumulative Balance (£)' } }
                }
            }
        });
    }

    // ---------- Initial Render ----------
    renderTransactions();
    renderProjection();
    renderSummary();
    renderChart();

});
