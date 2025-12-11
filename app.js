// Home Budget Tracker - Full with categories and 4-weekly fix

// Load transactions and categories
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || ['General'];
let startDate = localStorage.getItem('startDate') || '';
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// Save helpers
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}
function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
}

// Format date
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Add transaction
function addTransaction(description, amount, type, frequency, date, category) {
    transactions.push({ description, amount: parseFloat(amount), type, frequency, date, category });
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
                current.setDate(current.getDate() + 28); // exact 4-week increments
            }
        }
    }

    projection.sort((a, b) => new Date(a.date) - new Date(b.date));
    return projection;
}

// Helper to add months
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

// Render transactions table
function renderTransactions() {
    const table = document.getElementById('transaction-table').querySelector('tbody');
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

        const categoryCell = document.createElement('td');
        categoryCell.textContent = tx.category || 'General';

        const balanceCell = document.createElement('td');
        balance = tx.type === 'income' ? balance + tx.amount : balance - tx.amount;
        balanceCell.textContent = balance.toFixed(2);

        row.append(dateCell, descCell, typeCell, amountCell, categoryCell, balanceCell);
        table.appendChild(row);
    }
}

// Update category dropdown
function updateCategoryDropdown() {
    const select = document.getElementById('tx-category');
    select.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}
updateCategoryDropdown();

// Save start date and opening balance
document.getElementById('save-config').addEventListener('click', () => {
    startDate = document.getElementById('start-date').value;
    openingBalance = parseFloat(document.getElementById('opening-balance').value) || 0;
    localStorage.setItem('startDate', startDate);
    localStorage.setItem('openingBalance', openingBalance);
    renderTransactions();
});

// Add new category
document.getElementById('add-category').addEventListener('click', () => {
    const newCat = document.getElementById('new-category').value.trim();
    if(newCat && !categories.includes(newCat)){
        categories.push(newCat);
        saveCategories();
        updateCategoryDropdown();
        document.getElementById('new-category').value = '';
    }
});

// Add transaction button
document.getElementById('add-transaction').addEventListener('click', () => {
    const desc = document.getElementById('tx-desc').value;
    const amt = document.getElementById('tx-amount').value;
    const type = document.getElementById('tx-type').value;
    const freq = document.getElementById('tx-frequency').value;
    const date = document.getElementById('tx-date').value;
    const category = document.getElementById('tx-category').value;

    if (!desc || !amt || !date) return alert('Please fill in all fields');
    addTransaction(desc, amt, type, freq, date, category);

    // Clear form
    document.getElementById('tx-desc').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-date').value = '';
});

renderTransactions();
