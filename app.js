// ---------- Data ----------
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let startDate = localStorage.getItem("startDate") || "";
let openingBalance = parseFloat(localStorage.getItem("openingBalance")) || 0;

// ---------- DOM ----------
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

const transactionTableBody = document.querySelector("#transaction-table tbody");
const projectionTbody = document.querySelector("#projection-table tbody");

// Find
const projectionFindInput = document.getElementById("projection-find-input");
const projectionFindNextBtn = document.getElementById("projection-find-next");
let lastFindIndex = -1;

// ---------- Utils ----------
function toISO(d) {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d)
        ? iso
        : d.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
          });
}

function escapeHtml(str) {
    return str
        ? String(str)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
        : "";
}

// ---------- Categories ----------
function updateCategoryDropdown() {
    txCategorySelect.innerHTML =
        '<option value="" disabled selected>Select category</option>';
    categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        txCategorySelect.appendChild(opt);
    });
}

addCategoryButton.addEventListener("click", () => {
    const c = newCategoryInput.value.trim();
    if (!c) return;
    if (!categories.includes(c)) {
        categories.push(c);
        localStorage.setItem("categories", JSON.stringify(categories));
    }
    newCategoryInput.value = "";
    updateCategoryDropdown();
    txCategorySelect.value = c;
});

// ---------- Config ----------
saveConfigButton.addEventListener("click", () => {
    startDate = toISO(startDateInput.value);
    openingBalance = parseFloat(openingBalanceInput.value) || 0;
    localStorage.setItem("startDate", startDate);
    localStorage.setItem("openingBalance", openingBalance);
    renderProjectionTable();
});

startDateInput.value = startDate;
openingBalanceInput.value = openingBalance || "";

// ---------- Transactions ----------
function saveTransactions() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

addTxButton.addEventListener("click", () => {
    const tx = {
        description: txDesc.value.trim(),
        amount: parseFloat(txAmount.value) || 0,
        type: txType.value,
        frequency: txFrequency.value,
        date: toISO(txDate.value),
        category: txCategorySelect.value || "",
    };

    if (!tx.description) return alert("Enter description");
    if (
        (tx.frequency === "monthly" || tx.frequency === "4-weekly") &&
        !tx.date
    )
        return alert("Choose a start date");

    transactions.push(tx);
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();

    txDesc.value = "";
    txAmount.value = "";
    txDate.value = "";
    txCategorySelect.value = "";
    txFrequency.value = "irregular";
    txType.value = "expense";
});

// ---------- Transaction Table ----------
function renderTransactionTable() {
    transactionTableBody.innerHTML = "";
    transactions.forEach((tx, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td>${escapeHtml(tx.description)}</td>
            <td>${tx.type}</td>
            <td>${tx.amount.toFixed(2)}</td>
            <td>${escapeHtml(tx.category)}</td>
            <td><button data-i="${idx}">Delete</button></td>
        `;
        tr.querySelector("button").onclick = () => {
            if (confirm("Delete this transaction?")) {
                transactions.splice(idx, 1);
                saveTransactions();
                renderTransactionTable();
                renderProjectionTable();
            }
        };
        transactionTableBody.appendChild(tr);
    });
}

// ---------- Recurrence Logic (FIXED) ----------
function occursOn(tx, iso) {
    if (!tx.date || !iso) return false;

    const start = new Date(tx.date);
    const current = new Date(iso);

    if (current < start) return false;

    if (tx.frequency === "irregular") {
        return tx.date === iso;
    }

    if (tx.frequency === "monthly") {
        const day = start.getDate();
        const lastDay = new Date(
            current.getFullYear(),
            current.getMonth() + 1,
            0
        ).getDate();
        return current.getDate() === Math.min(day, lastDay);
    }

    if (tx.frequency === "4-weekly") {
        const diffDays = Math.floor(
            (current - start) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= 0 && diffDays % 28 === 0;
    }

    return false;
}

// ---------- Projection (FIXED) ----------
function renderProjectionTable() {
    projectionTbody.innerHTML = "";
    if (!startDate) return;

    let balance = openingBalance || 0;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 24);

    let d = new Date(start);
d.setHours(12, 0, 0, 0); // DST-safe

for (; d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toISO(d);
        let income = 0;
        let expense = 0;
        let descs = [];

        transactions.forEach((tx) => {
            if (occursOn(tx, iso)) {
                if (tx.type === "income") income += tx.amount;
                else expense += tx.amount;

                const label =
                    tx.frequency === "irregular"
                        ? `<span class="irregular">${escapeHtml(
                              tx.description
                          )}</span>`
                        : escapeHtml(tx.description);

                descs.push(
                    tx.category
                        ? `${label} (${escapeHtml(tx.category)})`
                        : label
                );
            }
        });

        balance += income - expense;

        const tr = document.createElement("tr");
        if (balance < 0) tr.classList.add("negative");

        tr.innerHTML = `
            <td>${formatDate(iso)}</td>
            <td>${descs.join("<br>")}</td>
            <td>${income ? income.toFixed(2) : ""}</td>
            <td>${expense ? expense.toFixed(2) : ""}</td>
            <td>${balance.toFixed(2)}</td>
        `;

        projectionTbody.appendChild(tr);
    }
}

// ---------- Sticky Find ----------
projectionFindNextBtn.addEventListener("click", () => {
    const q = projectionFindInput.value.toLowerCase().trim();
    if (!q) return;

    const rows = [...projectionTbody.querySelectorAll("tr")];
    for (let i = 1; i <= rows.length; i++) {
        const idx = (lastFindIndex + i) % rows.length;
        if (rows[idx].textContent.toLowerCase().includes(q)) {
            rows.forEach((r) =>
                r.classList.remove("projection-match-highlight")
            );
            rows[idx].classList.add("projection-match-highlight");
            rows[idx].scrollIntoView({ behavior: "smooth", block: "center" });
            lastFindIndex = idx;
            return;
        }
    }
});

projectionFindInput.addEventListener("input", () => (lastFindIndex = -1));

document.addEventListener("DOMContentLoaded", () => {

    // Top button (FIXED)
    const backToTopBtn = document.getElementById("back-to-top");
    if (backToTopBtn) {
        backToTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    updateCategoryDropdown();
    renderTransactionTable();
    renderProjectionTable();
});
