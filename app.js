/****************************************************
 * Home Budget Tracker – Unified app.js
 * Clean, single-source logic
 ****************************************************/

/* ---------- Storage ---------- */
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let categories = JSON.parse(localStorage.getItem("categories")) || [];

/* ---------- DOM Elements ---------- *
const txDesc = document.getElementById("tx-desc");
const txAmount = document.getElementById("tx-amount");
const txType = document.getElementById("tx-type");
const txFrequency = document.getElementById("tx-frequency");
const txDate = document.getElementById("tx-date");
const txCategory = document.getElementById("tx-category");
const addTxButton = document.getElementById("add-transaction");

const newCategoryInput = document.getElementById("new-category");
const addCategoryButton = document.getElementById("add-category");

const transactionTableBody = document.querySelector("#transaction-table tbody");
const projectionTableBody = document.querySelector("#projection-table tbody");

/* ---------- Categories ---------- */
function updateCategoryDropdown() {
    txCategory.innerHTML = '<option value="" disabled selected>Select category</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategory.appendChild(opt);
    });
}

addCategoryButton.addEventListener("click", () => {
    const cat = (newCategoryInput.value || "").trim();
    if (!cat) return;

    if (!categories.includes(cat)) {
        categories.push(cat);
        localStorage.setItem("categories", JSON.stringify(categories));
    }

    updateCategoryDropdown();
    txCategory.value = cat;
    newCategoryInput.value = "";
});

/* ---------- Add Transaction ---------- */
addTxButton.addEventListener("click", () => {
    const desc = (txDesc.value || "").trim();
    const amount = parseFloat(txAmount.value);
    const type = txType.value;
    const frequency = txFrequency.value;
    const date = txDate.value;
    const category = txCategory.value;

    if (!desc || isNaN(amount)) {
        alert("Please enter description and amount");
        return;
    }

    if (!category) {
        alert("Please select category");
        return;
    }

    if ((frequency === "monthly" || frequency === "4-weekly") && !date) {
        alert("Please select a start date");
        return;
    }

    transactions.push({
        description: desc,
        amount: amount,
        type: type,
        frequency: frequency,
        date: date || "",
        category: category
    });

    localStorage.setItem("transactions", JSON.stringify(transactions));

    txDesc.value = "";
    txAmount.value = "";
    txDate.value = "";
    txCategory.value = "";
    txFrequency.value = "irregular";
    txType.value = "expense";

    renderTransactionTable();
    renderProjectionTable();
});

/* ---------- Transaction Table ---------- */
function renderTransactionTable() {
    transactionTableBody.innerHTML = "";

    transactions.forEach(tx => {
        const tr = document.createElement("tr");

        if (tx.frequency === "irregular") {
            tr.style.fontWeight = "bold";
        }


        


        tr.innerHTML = `
            <td>${tx.date ? formatDate(tx.date) : ""}</td>
            <td>${tx.description}</td>
            <td>${tx.category}</td>
            <td>${tx.type === "income" ? tx.amount.toFixed(2) : ""}</td>
            <td>${tx.type === "expense" ? tx.amount.toFixed(2) : ""}</td>
        `;

        transactionTableBody.appendChild(tr);
    });
}

/* ---------- Projection ---------- */
function renderProjectionTable() {
    projectionTableBody.innerHTML = "";

    const start = new Date();
    start.setHours(0,0,0,0);

    let balance = 0;
    const days = 730;

    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];

        transactions.forEach(tx => {
            if (tx.frequency === "irregular" && tx.date === key) {
                balance += tx.type === "income" ? tx.amount : -tx.amount;
            }
            if (tx.frequency === "monthly" && tx.date) {
                const txDate = new Date(tx.date);
                if (txDate.getDate() === d.getDate()) {
                    balance += tx.type === "income" ? tx.amount : -tx.amount;
                }
            }
        });

        const tr = document.createElement("tr");
        if (balance < 0) tr.classList.add("negative");

        tr.innerHTML = `
            <td>${d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</td>
            <td>${balance.toFixed(2)}</td>
        `;

        projectionTableBody.appendChild(tr);
    }
}

/* ---------- Sticky Find ---------- */
const findInput = document.getElementById("find-input");
const findNextBtn = document.getElementById("find-next");
const findPrevBtn = document.getElementById("find-prev");
const findTopBtn = document.getElementById("find-top");

let matches = [];
let currentMatch = -1;

function performFind() {
    matches = [];
    currentMatch = -1;

    const term = (findInput.value || "").toLowerCase();
    if (!term) return;

    document.querySelectorAll("tr").forEach(row => {
        row.classList.remove("find-match", "find-current");
        if (row.innerText.toLowerCase().includes(term)) {
            matches.push(row);
            row.classList.add("find-match");
        }
    });

    gotoMatch(1);
}

function gotoMatch(dir) {
    if (!matches.length) return;
    currentMatch = (currentMatch + dir + matches.length) % matches.length;

    matches.forEach(r => r.classList.remove("find-current"));
    const row = matches[currentMatch];
    row.classList.add("find-current");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
}

findNextBtn.addEventListener("click", () => gotoMatch(1));
findPrevBtn.addEventListener("click", () => gotoMatch(-1));
findInput.addEventListener("input", performFind);

findTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- Init ---------- */
updateCategoryDropdown();
renderTransactionTable();
renderProjectionTable();
