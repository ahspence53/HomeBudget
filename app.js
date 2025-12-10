// Transactions array
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// Load start date and opening balance from localStorage
let startDate = localStorage.getItem("startDate") || new Date().toISOString().slice(0,10);
let openingBalance = localStorage.getItem("openingBalance") ? parseFloat(localStorage.getItem("openingBalance")) : 0;

// Set start panel defaults
document.getElementById("startDate").value = startDate;
document.getElementById("openingBalance").value = openingBalance;

// Quick Add defaults
document.getElementById("date").valueAsDate = new Date();
let lastType = "";
let lastDescription = "";
let lastAmount = 0;

// --- Start Panel ---
document.getElementById("startForm").addEventListener("submit", (e) => {
    e.preventDefault();
    startDate = document.getElementById("startDate").value;
    openingBalance = parseFloat(document.getElementById("openingBalance").value);

    localStorage.setItem("startDate", startDate);
    localStorage.setItem("openingBalance", openingBalance);

    updateLedgerAndSummary();
});

// --- Add Transaction Form ---
const form = document.getElementById("transactionForm");
form.addEventListener("submit", (e) => {
    e.preventDefault();

    const newTx = {
        description: document.getElementById("description").value,
        amount: parseFloat(document.getElementById("amount").value),
        type: document.getElementById("type").value,
        frequency: document.getElementById("frequency").value,
        date: document.getElementById("date").value
    };

    transactions.push(newTx);
    localStorage.setItem("transactions", JSON.stringify(transactions));

    // Update Quick Add defaults
    lastType = newTx.type;
    lastDescription = newTx.description;
    lastAmount = newTx.amount;

    // Prefill form for next quick add
    document.getElementById("description").value = lastDescription;
    document.getElementById("amount").value = lastAmount;
    document.getElementById("type").value = lastType;
    document.getElementById("frequency").value = "";
    document.getElementById("date").valueAsDate = new Date();

    updateLedgerAndSummary();
});

// --- Ledger Functions ---
let showFullDaily = false;

function generateDailyProjectionWithOption(startDate, openingBalance, transactions, months = 12, fullDaily = false) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    let dailyLedger = [];
    let balance = openingBalance;
    const todayStr = new Date().toISOString().slice(0,10);

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        let dayStr = d.toISOString().slice(0, 10);
        let dayTransactions = [];

        transactions.forEach(tx => {
            let txDate = new Date(tx.date);
            if (tx.frequency === "monthly" && d.getDate() === txDate.getDate()) dayTransactions.push(tx);
            else if (tx.frequency === "4weekly") {
                let diffDays = Math.floor((d - txDate) / (1000*60*60*24));
                if (diffDays >= 0 && diffDays % 28 === 0) dayTransactions.push(tx);
            }
            else if (tx.frequency === "irregular" && dayStr === tx.date) dayTransactions.push(tx);
        });

        if (dayTransactions.length > 0) {
            const incomes = dayTransactions.filter(tx => tx.type === "income");
            if (incomes.length > 0) {
                let totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);
                balance += totalIncome;
                dailyLedger.push({date: dayStr, description: incomes.map(tx => tx.description).join(", "), type: "income", amount: totalIncome, projectedBalance: balance, today: dayStr===todayStr});
            }
            const expenses = dayTransactions.filter(tx => tx.type === "expense");
            if (expenses.length > 0) {
                let totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);
                balance -= totalExpense;
                dailyLedger.push({date: dayStr, description: expenses.map(tx => tx.description).join(", "), type: "expense", amount: totalExpense, projectedBalance: balance, today: dayStr===todayStr});
            }
        } else if (fullDaily) {
            dailyLedger.push({date: dayStr, description:"", type:"", amount:"", projectedBalance: balance, today: dayStr===todayStr});
        }
    }
    return dailyLedger;
}

function displayLedger(ledger) {
    const tableBody = document.getElementById("ledgerBody");
    tableBody.innerHTML = "";
    ledger.forEach(entry => {
        const row = document.createElement("tr");
        if (entry.type==="income") row.classList.add("income");
        else if (entry.type==="expense") row.classList.add("expense");
        if (entry.today) row.classList.add("today");
        row.innerHTML = `<td>${entry.date}</td><td>${entry.description}</td><td>${entry.type}</td><td>${entry.amount}</td><td>${entry.projectedBalance.toFixed(2)}</td>`;
        tableBody.appendChild(row);
    });
}

function displaySummary(ledger) {
    let totalIncome=0, totalExpenses=0, endingBalance=0;
    ledger.forEach(entry => { if(entry.type==="income") totalIncome+=entry.amount; else if(entry.type==="expense") totalExpenses+=entry.amount; endingBalance=entry.projectedBalance; });
    document.getElementById("summary").innerHTML = `Total Income: ${totalIncome.toFixed(2)} | Total Expenses: ${totalExpenses.toFixed(2)} | Ending Balance: ${endingBalance.toFixed(2)}`;
}

function updateLedgerAndSummary() {
    const ledger = generateDailyProjectionWithOption(startDate, openingBalance, transactions, 12, showFullDaily);
    displayLedger(ledger);
    displaySummary(ledger);
}

// --- Initial Display ---
updateLedgerAndSummary();

// --- Toggle View ---
document.getElementById("toggleViewBtn").addEventListener("click", () => {
    showFullDaily = !showFullDaily;
    updateLedgerAndSummary();
    document.getElementById("toggleViewBtn").textContent = showFullDaily ? "Show Compact Ledger" : "Show Full Daily Ledger";
});

// --- Scroll-to-top button ---
const scrollBtn = document.getElementById("scrollTopBtn");
window.onscroll = function() { scrollBtn.style.display = document.documentElement.scrollTop > 100 ? "block" : "none"; };
scrollBtn.addEventListener("click", ()=>{ window.scrollTo({top:0, behavior:"smooth"}); });
