// Home Budget Tracker - Updated app.js

// Load transactions from localStorage
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || '';
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// Utility functions
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Add transaction
function addTransaction(description, amount, type, frequency, date) {
    transactions.push({ description, amount: parseFloat(amount), type, frequency, date });
    saveTransactions();
    renderTransactions();
}

// Generate 24-month projection
function generateProjection() {
    if (!startDate) return [];
    const projection = [];
    const start = new Date(startDate);

    for (const tx of transactions) {
        const txDate = new Date(tx.date);
        const freq = tx.frequency;
        let current = new Date(txDate);

        if (freq === 'irregular') {
            projection.push({ ...tx, date: new Date(current) });
        } else if (freq === 'monthly') {
            while (current <= addMonths(start, 24)) {
                if (current >= start) projection.push({ ...tx, date: new Date(current) });
                current = addMonths(current, 1);
            }
        } else if (freq === '4-weekly') {
            while (current <= addMonths(start, 24)) {
                if (current >= start) projection.push({ ...tx, date: new Date(current) });
                current.setDate(current.getDate() + 28); // Strict 28-day increments
            }
        }
    }

    projection.sort((a, b) => new Date(a.date) - new Date(b.date));
    return projection;
}

// Helper to add months correctly
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

// Render transactions table
function renderTransactions() {
    const table = document.getElementById('transaction-table');
    table.innerHTML = '';

    const projection = generateProjection();
    let balance = openingBalance;

    for (const tx of projection) {
        const row = document.createElement('tr');
        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(tx.date);

        const descCell = document.createElement('td');
        descCell.textContent = tx.description;

        const typeCell = document.createElement('td');
        typeCell.textContent = tx.type;

        const amountCell = document.createElement('td');
        amountCell.textContent = tx.amount.toFixed(2);

        const balanceCell = document.createElement('td');
        balance = tx.type === 'income' ? balance + tx.amount : balance - tx.amount;
        balanceCell.textContent = balance.toFixed(2);

        row.append(dateCell, descCell, typeCell, amountCell, balanceCell);
        table.appendChild(row);
    }
}

// Load initial values
document.getElementById('start-date').value = startDate;
document.getElementById('opening-balance').value = openingBalance;

// Save start date and opening balance
document.getElementById('save-config').addEventListener('click', () => {
    startDate = document.getElementById('start-date').value;
    openingBalance = parseFloat(document.getElementById('opening-balance').value) || 0;
    localStorage.setItem('startDate', startDate);
    localStorage.setItem('openingBalance', openingBalance);
    renderTransactions();
});

// Add transaction form
document.getElementById('add-transaction').addEventListener('click', () => {
    const desc = document.getElementById('tx-desc').value;
    const amt = document.getElementById('tx-amount').value;
    const type = document.getElementById('tx-type').value;
    const freq = document.getElementById('tx-frequency').value;
    const date = document.getElementById('tx-date').value;

    if (!desc || !amt || !date) return alert('Please fill in all fields');
    addTransaction(desc, amt, type, freq, date);

    // Clear form
    document.getElementById('tx-desc').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-date').value = '';
});

// Initial render
renderTransactions();
