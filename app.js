// Home Budget Tracker - Full 24-month table with blank rows, categories & highlighting

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

// Helper to add months
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

// Generate 24-month projection with blank rows
function generateProjectionWithBlanks() {
    if (!startDate) return [];
    const projection = [];

    // Map transactions by date string
    const txByDate = {};
    transactions.forEach(tx => {
        const freq = tx.frequency;
        let current = new Date(tx.date);
        const endDate = addMonths(new Date(startDate), 24);

        if(freq === 'irregular') {
            const key = formatDate(current);
            if(!txByDate[key]) txByDate[key] = [];
            txByDate[key].push(tx);
        } else if(freq === 'monthly') {
            while(current <= endDate) {
                if(current >= new Date(startDate)){
                    const key = formatDate(current);
                    if(!txByDate[key]) txByDate[key] = [];
                    txByDate[key].push(tx);
                }
                current = addMonths(current,1);
            }
        } else if(freq === '4-weekly') {
            while(current <= endDate) {
                if(current >= new Date(startDate)){
                    const key = formatDate(current);
                    if(!txByDate[key]) txByDate[key] = [];
                    txByDate[key].push(tx);
                }
                current.setDate(current.getDate() + 28);
            }
        }
    });

    // Generate rows for every day in 24 months
    let currentDate = new Date(startDate);
    const endDate = addMonths(new Date(startDate),24);

    while(currentDate <= endDate){
        const key = formatDate(currentDate);
        if(txByDate[key]) {
            txByDate[key].forEach(tx => {
                projection.push({...tx, date: new Date(currentDate)});
            });
        } else {
            // Blank row
            projection.push({description:'', amount:0, type:'', frequency:'', category:'', date: new Date(currentDate)});
        }
        currentDate.setDate(currentDate.getDate()+1); // daily increments
    }

    return projection;
}

// Render transactions table
function renderTransactions() {
    const table = document.getElementById('transaction-table').querySelector('tbody');
    table.innerHTML = '';

    const projection = generateProjectionWithBlanks();
    let balance = openingBalance;

    for(const tx of projection){
        const row = document.createElement('tr');

        // Highlight irregular transactions
        if(tx.frequency === 'irregular' && tx.description !== '') {
            row.style.fontWeight = 'bold';
            row.style.backgroundColor = '#f0f8ff';
        }

        // Color-code Income / Expense
        if(tx.type === 'income') row.style.color = 'green';
        if(tx.type === 'expense') row.style.color = 'red';

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(tx.date);

        const descCell = document.createElement('td');
        descCell.textContent = tx.description;

        const typeCell = document.createElement('td');
        typeCell.textContent = tx.type;

        const amountCell = document.createElement('td');
        amountCell.textContent = tx.amount ? tx.amount.toFixed(2) : '';

        const categoryCell = document.createElement('td');
        categoryCell.textContent = tx.category || '';
        categoryCell.style.fontWeight = 'bold';

        const balanceCell = document.createElement('td');
        balance = tx.type === 'income' ? balance + tx.amount : (tx.type==='expense'? balance - tx.amount : balance);
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
