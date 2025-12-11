// ================================
// Home Budget Tracker - app.js
// ================================

// --- Initialize / Load Data ---
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// --- Elements ---
const categoryInput = document.getElementById('newCategoryInput');
const addCategoryBtn = document.getElementById('addCategoryButton');
const categorySelect = document.getElementById('categorySelect');
const transactionForm = document.getElementById('transactionForm'); // assuming a form
const transactionTableBody = document.getElementById('transactionTableBody'); // tbody
const openingBalanceInput = document.getElementById('openingBalanceInput');

// --- CATEGORY FUNCTIONS ---
// Update category dropdown
function updateCategoryDropdown() {
    categorySelect.innerHTML = '<option value="" disabled selected>Select category</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

// Add a new category
function addCategory(newCategory) {
    newCategory = newCategory.trim();
    if (newCategory && !categories.includes(newCategory)) {
        categories.push(newCategory);
        localStorage.setItem('categories', JSON.stringify(categories));
        updateCategoryDropdown();
        categorySelect.value = newCategory; // auto-select the new category
    }
}

// --- TRANSACTION FUNCTIONS ---
// Add transaction
function addTransaction(transaction) {
    transactions.push(transaction);
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date)); // sort by date
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderTransactionTable();
}

// Render transaction table
function renderTransactionTable() {
    transactionTableBody.innerHTML = '';
    transactions.forEach(tx => {
        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(tx.date);
        row.appendChild(dateCell);

        const descCell = document.createElement('td');
        descCell.textContent = tx.description;
        row.appendChild(descCell);

        const categoryCell = document.createElement('td');
        categoryCell.textContent = tx.category;
        row.appendChild(categoryCell);

        const typeCell = document.createElement('td');
        typeCell.textContent = tx.type; // income/expense
        row.appendChild(typeCell);

        const amountCell = document.createElement('td');
        amountCell.textContent = parseFloat(tx.amount).toFixed(2);
        row.appendChild(amountCell);

        transactionTableBody.appendChild(row);
    });
}

// Format date dd-mmm-yyyy
function formatDate(dateStr) {
    const d = new Date(dateStr);
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('en-GB', options);
}

// --- EVENT LISTENERS ---
// Add category button
addCategoryBtn.addEventListener('click', () => {
    addCategory(categoryInput.value);
    categoryInput.value = '';
});

// Transaction form submit
transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const tx = {
        date: document.getElementById('transactionDate').value,
        description: document.getElementById('transactionDescription').value,
        category: categorySelect.value,
        type: document.querySelector('input[name="transactionType"]:checked').value,
        amount: parseFloat(document.getElementById('transactionAmount').value)
    };
    addTransaction(tx);

    // Clear form
    transactionForm.reset();
});

// Opening balance
openingBalanceInput.addEventListener('change', () => {
    openingBalance = parseFloat(openingBalanceInput.value) || 0;
    localStorage.setItem('openingBalance', openingBalance);
});

// --- INITIAL RENDER ---
updateCategoryDropdown();
renderTransactionTable();
openingBalanceInput.value = openingBalance;
