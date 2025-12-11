// ================================
// Home Budget Tracker - app.js
// ================================

// Load from localStorage
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// DOM references (MATCHES YOUR HTML)
const txCategorySelect = document.getElementById("tx-category");
const newCategoryInput = document.getElementById("new-category");
const addCategoryButton = document.getElementById("add-category");

const txDesc = document.getElementById("tx-desc");
const txAmount = document.getElementById("tx-amount");
const txType = document.getElementById("tx-type");
const txFrequency = document.getElementById("tx-frequency");
const txDate = document.getElementById("tx-date");
const addTxButton = document.getElementById("add-transaction");

const startDateInput = document.getElementById("start-date");
const openingBalanceInput = document.getElementById("opening-balance");
const saveConfigButton = document.getElementById("save-config");

const tableBody = document.querySelector("#transaction-table tbody");

// ================================
// CATEGORY HANDLING
// ================================

// Render category dropdown
function updateCategoryDropdown() {
    txCategorySelect.innerHTML = "";

    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);
    });
}

// Add category
function addCategory() {
    const newCat = newCategoryInput.value.trim();
    if (!newCat) return;

    if (!categories.includes(newCat)) {
        categories.push(newCat);
        localStorage.setItem("categories", JSON.stringify(categories));
    }

    newCategoryInput.value = "";
    updateCategoryDropdown();

    // auto-select brand new category
    txCategorySelect.value = newCat;
}

// Event listener for adding category
addCategoryButton.addEventListener("click", addCategory);

// ================================
// CONFIG SAVE
// ================================

saveConfigButton.addEventListener("click", () => {
    startDate = startDateInput.value;
    openingBalance = parseFloat(openingBalanceInput.value) || 0;

    localStorage.setItem("startDate", startDate);
    localStorage.setItem("openingBalance", openingBalance);
});

// Load saved config on page load
startDateInput.value = startDate;
openingBalanceInput.value = openingBalance;

// ================================
// TRANSACTION HANDLING
// ================================

// Add a transaction
addTxButton.addEventListener("click", () => {
    const tx = {
        date: txDate.value,
        description: txDesc.value,
        type: txType.value,
        amount: parseFloat(txAmount.value) || 0,
        frequency: txFrequency.value,
        category: txCategorySelect.value
    };

    transactions.push(tx);

    // sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    localStorage.setItem("transactions", JSON.stringify(transactions));

    renderTransactionTable();

    // clear inputs
    txDesc.value = "";
    txAmount.value = "";
    txDate.value = "";
});

// Render table
function renderTransactionTable() {
    tableBody.innerHTML = "";

    let runningBalance = openingBalance;

    transactions.forEach(tx => {
        runningBalance += tx.type === "income" ? tx.amount : -tx.amount;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td>${tx.description}</td>
            <td>${tx.type}</td>
            <td>${tx.amount.toFixed(2)}</td>
            <td>${tx.category}</td>
            <td>${runningBalance.toFixed(2)}</td>
        `;

        tableBody.appendChild(row);
    });
}

// Format date dd-mmm-yyyy
function formatDate(val) {
    if (!val) return "";
    const d = new Date(val);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Initial render
updateCategoryDropdown();
renderTransactionTable();
