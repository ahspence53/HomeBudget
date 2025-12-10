// Load transactions from localStorage if exists
let storedTransactions = JSON.parse(localStorage.getItem("transactions"));
if (storedTransactions) transactions = storedTransactions;

// Set default date to today
document.getElementById("date").valueAsDate = new Date();

let lastType = ""; // remember last added type
let lastDescription = "";
let lastAmount = 0;

// Form handling
const form = document.getElementById("transactionForm");
form.addEventListener("submit", (e) => {
    e.preventDefault();

    const descriptionInput = document.getElementById("description");
    const amountInput = document.getElementById("amount");
    const typeInput = document.getElementById("type");
    const frequencyInput = document.getElementById("frequency");
    const dateInput = document.getElementById("date");

    const newTx = {
        description: descriptionInput.value,
        amount: parseFloat(amountInput.value),
        type: typeInput.value,
        frequency: frequencyInput.value,
        date: dateInput.value
    };

    transactions.push(newTx);
    localStorage.setItem("transactions", JSON.stringify(transactions));

    // Update last transaction defaults
    lastType = newTx.type;
    lastDescription = newTx.description;
    lastAmount = newTx.amount;

    // Clear form but keep defaults
    descriptionInput.value = lastDescription;
    amountInput.value = lastAmount;
    typeInput.value = lastType;
    frequencyInput.value = "";
    dateInput.valueAsDate = new Date();

    updateLedgerAndSummary();
});
