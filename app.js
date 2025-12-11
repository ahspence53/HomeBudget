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

    const goToChartBtn = document.getElementById("goToChartBtn");
    const backToTopBtn = document.getElementById("backToTopBtn");
    const regenProjectionBtn = document.getElementById("regenProjectionBtn");

    // Load start date and opening balance from localStorage
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // ---------- Helper Functions ----------
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMMYYYY(dateStr) {
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        // dateStr might be a Date or a string
        const d = (dateStr instanceof Date) ? dateStr : new Date(dateStr);
        return d.toLocaleDateString('en-GB', options).replace(/ /g, '-');
    }

    function daysInMonth(year, monthIndex) {
        // monthIndex: 0-based (0 = Jan)
        return new Date(year, monthIndex + 1, 0).getDate();
    }

    function calculateBalances() {
        let balance = parseFloat(openingBalanceEl.value) || 0;
        // transactions already sorted by date
        transactions.forEach(tx => {
            if (tx.type === "income") balance += tx.amount;
            else balance -= tx.amount;
            tx.balance = balance;
        });
    }

    // ---------- Render Transactions ----------
    function renderTransactions() {
        const tbody = document.querySelector("#transactionsTable tbody"); // correct tbody
        tbody.innerHTML = "";

        // Sort transactions by date ascending
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

        // Delete confirmation
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const idx = parseInt(this.dataset.index);
                const tx = transactions[idx];
                const confirmDelete = confirm(`Are you sure you want to delete the transaction:\n"${tx.description}" on ${formatDateDDMMMYYYY(tx.date)} (£${tx.amount.toFixed(2)})?`);
                if (confirmDelete) {
                    transactions.splice(idx, 1);
                    renderTransactions();
                    renderSummary();
                    renderChart();
                    renderDailyProjection();
                }
            });
        });

        // regenerate daily projection after rendering transactions
        renderDailyProjection();
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
        renderDailyProjection();
    });

    // ---------- Add Button ----------
    addBtn.addEventListener("click", function(e) {
        e.preventDefault();
        addTransaction();
    });

    // ---------- Monthly Projection (existing) ----------
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

    // ---------- Render Projection Table (Monthly Summary) ----------
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

    // ---------- Daily Projection (24 months, one line per day) ----------
    function generateDailyProjectionArray() {
        const startDateStr = startDateEl.value;
        let runningBalance = parseFloat(openingBalanceEl.value) || 0;
        if (!startDateStr) return [];

        const result = [];
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 24, startDate.getDate());
        // ensure endDate is 24 months ahead minus one day (we include start day through the day before same day 24 months later)
        // But to include exactly 24 months of days starting at startDate, we'll advance 24 months and subtract 1 day
        endDate.setMonth(startDate.getMonth() + 24);
        endDate.setDate(endDate.getDate() - 1);

        // Normalize transactions' date objects for speed
        const txs = transactions.map(tx => {
            return {
                ...tx,
                _date: new Date(tx.date)
            };
        });

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            // create a copy of date for storage
            const currentDate = new Date(d);
            let incomeForDay = 0;
            let expenseForDay = 0;

            txs.forEach(tx => {
                const txDate = tx._date;
                const freq = tx.frequency;

                if (freq === "irregular") {
                    // only on exact date
                    if (txDate.getFullYear() === currentDate.getFullYear() &&
                        txDate.getMonth() === currentDate.getMonth() &&
                        txDate.getDate() === currentDate.getDate()) {
                        if (tx.type === "income") incomeForDay += tx.amount;
                        else expenseForDay += tx.amount;
                    }
                } else if (freq === "monthly") {
                    // occurs on the same day-of-month; if original day > days in this month, use last day
                    const desiredDay = txDate.getDate();
                    const dim = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
                    const occurrenceDay = (desiredDay > dim) ? dim : desiredDay;
                    if (currentDate.getDate() === occurrenceDay && currentDate >= txDate) {
                        if (tx.type === "income") incomeForDay += tx.amount;
                        else expenseForDay += tx.amount;
                    }
                } else if (freq === "4weekly") {
                    // repeats every 28 days from tx.date
                    if (currentDate >= txDate) {
                        const diffMs = currentDate - txDate;
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        if (diffDays % 28 === 0) {
                            if (tx.type === "income") incomeForDay += tx.amount;
                            else expenseForDay += tx.amount;
                        }
                    }
                }
            });

            runningBalance += (incomeForDay - expenseForDay);

            result.push({
                date: new Date(currentDate),
                income: incomeForDay,
                expense: expenseForDay,
                balance: runningBalance
            });
        }

        return result;
    }

    function renderDailyProjection() {
        const tbody = document.getElementById("dailyProjectionBody");
        tbody.innerHTML = "";

        const arr = generateDailyProjectionArray();
        if (!arr || arr.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="4">No projection. Please set a start date and opening balance.</td>`;
            tbody.appendChild(row);
            return;
        }

        // For performance: build HTML string then set once
        let html = "";
        arr.forEach(rowObj => {
            html += `
                <tr>
                    <td>${formatDateDDMMMYYYY(rowObj.date)}</td>
                    <td>${rowObj.income.toFixed(2)}</td>
                    <td>${rowObj.expense.toFixed(2)}</td>
                    <td>${rowObj.balance.toFixed(2)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Hook regen button
    regenProjectionBtn.addEventListener("click", function() {
        renderDailyProjection();
        // smooth scroll to projection if user clicked regenerate
        document.getElementById("dailyProjectionSection").scrollIntoView({ behavior: 'smooth' });
    });

    // ---------- Chart ----------
    let budgetChart;

    function renderChart() {
        const projection = generateProjection();
        const labels = projection.map(p => p.month);
        const incomeData = projection.map(p => p.income);
        const expenseData = projection.map(p => p.expense);
        const balanceData = projection.map(p => p.balance);

        const canvas = document.getElementById("budgetChart");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        if (budgetChart) budgetChart.destroy();

        // Chart.js expects to be available. If Chart is not defined, skip silently.
        if (typeof Chart === "undefined") return;

        budgetChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Income (£)',
                        data: incomeData,
                        backgroundColor: 'rgba(26,143,46,0.7)',
                        stack: 'financial'
                    },
                    {
                        type: 'bar',
                        label: 'Expenses (£)',
                        data: expenseData,
                        backgroundColor: 'rgba(204,0,0,0.7)',
                        stack: 'financial'
                    },
                    {
                        type: 'line',
                        label: 'Cumulative Balance (£)',
                        data: balanceData,
                        borderColor: '#2a7bff',
                        backgroundColor: 'rgba(42,123,255,0.2)',
                        yAxisID: 'balanceAxis',
                        tension: 0.3,
                        fill: false
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
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        title: { display: true, text: 'Income / Expenses (£)' }
                    },
                    balanceAxis: {
                        position: 'right',
                        beginAtZero: true,
                        title: { display: true, text: 'Cumulative Balance (£)' }
                    }
                }
            }
        });
    }

    // ---------- Jump Buttons (smooth scroll) ----------
    goToChartBtn.addEventListener("click", function() {
        const el = document.getElementById("chartSection");
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    });

    backToTopBtn.addEventListener("click", function() {
        const el = document.getElementById("transactionsTop");
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    });

    // ---------- Initial Render ----------
    renderTransactions();
    renderSummary();
    renderChart();
    renderDailyProjection();

});
