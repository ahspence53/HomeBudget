// -----------------------------
// Home Budget Tracker App.js
// Fully corrected for proper ledger
// -----------------------------

// Load transactions from localStorage
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// Load start date and opening balance
let startDate = localStorage.getItem("startDate") || new Date().toISOString().slice(0,10);
let openingBalance = localStorage.getItem("openingBalance") ? parseFloat(localStorage.getItem("openingBalance")) : 0;

// Quick Add defaults
let lastType = "";
let lastDescription = "";
let lastAmount = 0;
let lastFrequency = "";

// Initialize form values
document.getElementById("startDate").value = startDate;
document.getElementById("openingBalance").value = openingBalance;
document.getElementById("date").valueAsDate = new Date();

// -----------------------------
// Start Panel
// -----------------------------
document.getElementById("startForm").addEventListener("submit", e => {
    e.preventDefault();
    startDate = document.getElementById("startDate").value;
    openingBalance = parseFloat(document.getElementById("openingBalance").value);
    localStorage.setItem("startDate", startDate);
    localStorage.setItem("openingBalance", openingBalance);
    updateLedgerAndSummary();
});

// -----------------------------
// Add Transaction Form
// -----------------------------
document.getElementById("transactionForm").addEventListener("submit", e => {
    e.preventDefault();

    const desc = document.getElementById("description").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);
    const type = document.getElementById("type").value;
    const frequency = document.getElementById("frequency").value;
    const date = document.getElementById("date").value;

    if (!desc || !amount || !type || !frequency || !date) {
        alert("Please fill in all fields.");
        return;
    }

    const tx = {description: desc, amount, type, frequency, date};
    transactions.push(tx);
    localStorage.setItem("transactions", JSON.stringify(transactions));

    // Quick Add defaults
    lastType = type;
    lastDescription = desc;
    lastAmount = amount;
    lastFrequency = frequency;

    // Prefill form for next entry
    document.getElementById("description").value = lastDescription;
    document.getElementById("amount").value = lastAmount;
    document.getElementById("type").value = lastType;
    document.getElementById("frequency").value = lastFrequency;
    document.getElementById("date").valueAsDate = new Date();

    updateLedgerAndSummary();
});

// -----------------------------
// Utility: format date dd-MMM-yyyy
// -----------------------------
function formatDateDDMMMYYYY(dateStr){
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2,'0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// -----------------------------
// Generate Ledger
// -----------------------------
let showFullDaily = false;

function generateLedger(startDate, openingBalance, transactions, months=12, fullDaily=false){
    const ledger = [];
    let balance = openingBalance;
    const todayStr = new Date().toISOString().slice(0,10);

    // Calculate the end date for the projection
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    // Build all transaction occurrences
    const allOccurrences = [];

    transactions.forEach(tx => {
        const txDate = new Date(tx.date);

        if (tx.frequency === "irregular") {
            if (txDate >= start && txDate < end) allOccurrences.push({...tx, occurrenceDate: txDate});
        }
        else if (tx.frequency === "monthly") {
            let d = new Date(txDate);
            while(d < end){
                if(d >= start) allOccurrences.push({...tx, occurrenceDate: new Date(d)});
                d.setMonth(d.getMonth() + 1);
            }
        }
        else if (tx.frequency === "4weekly") {
            let d = new Date(txDate);
            while(d < end){
                if(d >= start) allOccurrences.push({...tx, occurrenceDate: new Date(d)});
                d.setDate(d.getDate() + 28);
            }
        }
    });

    // Sort all occurrences chronologically
    allOccurrences.sort((a,b) => a.occurrenceDate - b.occurrenceDate);

    // Process each occurrence
    allOccurrences.forEach(tx => {
        const dayStr = tx.occurrenceDate.toISOString().slice(0,10);
        // Income first
        if (tx.type === "income") balance += tx.amount;
        else if (tx.type === "expense") balance -= tx.amount;

        ledger.push({
            date: formatDateDDMMMYYYY(dayStr),
            description: tx.description,
            type: tx.type,
            amount: parseFloat(tx.amount.toFixed(2)),
            projectedBalance: parseFloat(balance.toFixed(2)),
            today: dayStr === todayStr
        });
    });

    // Optionally add full daily rows with no transactions
    if(fullDaily){
        const ledgerDays = new Set(ledger.map(e=>e.date));
        for(let d=new Date(start); d<end; d.setDate(d.getDate()+1)){
            const dayStrFormatted = formatDateDDMMMYYYY(d.toISOString().slice(0,10));
            if(!ledgerDays.has(dayStrFormatted)){
                ledger.push({
                    date: dayStrFormatted,
                    description: "",
                    type: "",
                    amount: "",
                    projectedBalance: parseFloat(balance.toFixed(2)),
                    today: d.toISOString().slice(0,10) === todayStr
                });
            }
        }
        // Re-sort by date after adding empty days
        ledger.sort((a,b) => new Date(a.date.split('-').reverse().join('-')) - new Date(b.date.split('-').reverse().join('-')));
    }

    return ledger;
}

// -----------------------------
// Display Ledger & Summary
// -----------------------------
function displayLedger(ledger){
    const tbody = document.getElementById("ledgerBody");
    tbody.innerHTML = "";
    ledger.forEach(e=>{
        const row = document.createElement("tr");
        if(e.type==="income") row.classList.add("income");
        else if(e.type==="expense") row.classList.add("expense");
        if(e.today) row.classList.add("today");
        row.innerHTML = `<td>${e.date}</td><td>${e.description}</td><td>${e.type}</td><td>${e.amount}</td><td>${e.projectedBalance.toFixed(2)}</td>`;
        tbody.appendChild(row);
    });
}

function displaySummary(ledger){
    let income=0, expenses=0, ending=0;
    ledger.forEach(e=>{
        if(e.type==="income") income+=e.amount;
        else if(e.type==="expense") expenses+=e.amount;
        ending = e.projectedBalance;
    });
    document.getElementById("summary").innerHTML = `Total Income: ${income.toFixed(2)} | Total Expenses: ${expenses.toFixed(2)} | Ending Balance: ${ending.toFixed(2)}`;
}

function updateLedgerAndSummary(){
    const ledger = generateLedger(startDate, openingBalance, transactions, 12, showFullDaily);
    displayLedger(ledger);
    displaySummary(ledger);
}

// -----------------------------
// Initial Display
// -----------------------------
updateLedgerAndSummary();

// -----------------------------
// Toggle View
// -----------------------------
document.getElementById("toggleViewBtn").addEventListener("click", ()=>{
    showFullDaily = !showFullDaily;
    updateLedgerAndSummary();
    document.getElementById("toggleViewBtn").textContent = showFullDaily ? "Show Compact Ledger":"Show Full Daily Ledger";
});

// -----------------------------
// Scroll-to-top button
// -----------------------------
const scrollBtn = document.getElementById("scrollTopBtn");
window.onscroll = ()=>{scrollBtn.style.display = document.documentElement.scrollTop>100?"block":"none";};
scrollBtn.addEventListener("click", ()=>{window.scrollTo({top:0,behavior:"smooth"});});
