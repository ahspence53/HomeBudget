document.addEventListener("DOMContentLoaded", function() {

    // ---------- Initial Setup ----------
    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

    const startDateEl = document.getElementById("startDate");
    const openingBalanceEl = document.getElementById("openingBalance");
    const saveConfigBtn = document.getElementById("saveConfigBtn");

    const descriptionEl = document.getElementById("description");
    const typeEl = document.getElementById("type");
    const amountEl = document.getElementById("amount");
    const categoryEl = document.getElementById("category");
    const frequencyEl = document.getElementById("frequency");
    const dateEl = document.getElementById("date");
    const addBtn = document.getElementById("addBtn");

    // Daily Projection table & find controls
    const dailyTableBody = document.querySelector("#dailyProjectionTable tbody");
    const findInput = document.getElementById("findDateInput");
    const findBtn = document.getElementById("findDateBtn");
    const backToTopBtn = document.getElementById("backToTopBtn");

    // Load start date and opening balance
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // ---------- Helpers ----------
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMYYYY(dateStr) {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }

    function calculateBalances() {
        let balance = parseFloat(openingBalanceEl.value) || 0;
        transactions.forEach(tx => {
            if (tx.type === "income") balance += tx.amount;
            else balance -= tx.amount;
            tx.balance = balance;
        });
    }

    // ---------- Render Transactions ----------
    function renderTransactions() {
        const tbody = document.querySelector("#transactionsTable tbody");
        tbody.innerHTML = "";

        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        calculateBalances();
        saveTransactions();

        transactions.forEach((tx, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDateDDMMYYYY(tx.date)}</td>
                <td>${tx.description}</td>
                <td>${tx.category || ''}</td>
                <td class="${tx.type}">${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${tx.balance.toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            tbody.appendChild(row);
        });

        // Delete
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const idx = parseInt(this.dataset.index);
                if (confirm(`Delete transaction "${transactions[idx].description}" on ${formatDateDDMMYYYY(transactions[idx].date)} (£${transactions[idx].amount.toFixed(2)})?`)) {
                    transactions.splice(idx, 1);
                    renderTransactions();
                    renderDailyProjection();
                }
            });
        });
    }

    // ---------- Add Transaction ----------
    function addTransaction() {
        const tx = {
            description: descriptionEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value),
            category: categoryEl.value.trim(),
            frequency: frequencyEl.value,
            date: dateEl.value
        };

        if (!tx.description || isNaN(tx.amount) || !tx.date) {
            alert("Please fill in Description, Amount, and Date.");
            return;
        }

        transactions.push(tx);

        descriptionEl.value = "";
        amountEl.value = "";
        categoryEl.value = "";
        dateEl.value = "";

        renderTransactions();
        renderDailyProjection();
    }

    addBtn.addEventListener("click", function(e){
        e.preventDefault();
        addTransaction();
    });

    // ---------- Save Config ----------
    saveConfigBtn.addEventListener("click", function() {
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderDailyProjection();
    });

    // ---------- Daily 24-Month Projection ----------
    function renderDailyProjection() {
        dailyTableBody.innerHTML = "";
        const startStr = startDateEl.value;
        if (!startStr) return;
        const startDate = new Date(startStr);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 24);

        // Create a list of all days
        let dateCursor = new Date(startDate);
        let balance = parseFloat(openingBalanceEl.value) || 0;

        while (dateCursor <= endDate) {
            const dateStr = formatDateDDMMYYYY(dateCursor);

            // Filter transactions applicable for this day
            transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                let include = false;
                if(tx.frequency === "monthly" && txDate.getDate() === dateCursor.getDate() && txDate <= dateCursor) include = true;
                if(tx.frequency === "4weekly" && txDate <= dateCursor){
                    const diff = Math.floor((dateCursor - txDate)/(1000*60*60*24));
                    if(diff % 28 === 0) include = true;
                }
                if(tx.frequency === "irregular" && txDate.toDateString() === dateCursor.toDateString()) include = true;

                if(include){
                    balance += tx.type === "income" ? tx.amount : -tx.amount;
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${dateStr}</td>
                        <td>${tx.description}</td>
                        <td>${tx.type}</td>
                        <td>${tx.amount.toFixed(2)}</td>
                        <td>${balance.toFixed(2)}</td>
                    `;
                    dailyTableBody.appendChild(row);
                }
            });

            dateCursor.setDate(dateCursor.getDate() + 1);
        }
    }

    // ---------- Find Date ----------
    findBtn.addEventListener("click", function() {
        const val = findInput.value;
        if(!val){ alert("Please select a date."); return; }

        const selected = new Date(val);
        const dd = String(selected.getDate()).padStart(2,'0');
        const mm = String(selected.getMonth()+1).padStart(2,'0');
        const yyyy = selected.getFullYear();
        const dateStr = `${dd}-${mm}-${yyyy}`;

        let found = false;

        document.querySelectorAll("#dailyProjectionTable tbody tr").forEach(tr=>{
            tr.classList.remove("highlight-row");
        });

        const rows = document.querySelectorAll("#dailyProjectionTable tbody tr");
        for(const tr of rows){
            if(tr.children[0].textContent === dateStr){
                tr.classList.add("highlight-row");
                tr.scrollIntoView({behavior:"smooth", block:"center"});
                found = true;
                break;
            }
        }

        if(!found) alert("No transactions found on this date.");
    });

    // ---------- Back to Top ----------
    backToTopBtn.addEventListener("click", function(){
        window.scrollTo({top:0, behavior:"smooth"});
    });

    // ---------- Initial Render ----------
    renderTransactions();
    renderDailyProjection();

});
