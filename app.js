document.addEventListener("DOMContentLoaded", function() {

    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

    // --- Elements ---
    const startDateEl = document.getElementById("startDate");
    const openingBalanceEl = document.getElementById("openingBalance");
    const saveConfigBtn = document.getElementById("saveConfigBtn");

    const descriptionEl = document.getElementById("description");
    const typeEl = document.getElementById("type");
    const amountEl = document.getElementById("amount");
    const categoryEl = document.getElementById("category");
    const dateEl = document.getElementById("date");
    const addBtn = document.getElementById("addBtn");

    const transactionsTbody = document.getElementById("transaction-list");
    const dailyTbody = document.querySelector("#dailyProjectionTable tbody");

    const scrollToProjectionBtn = document.getElementById("scrollToProjectionBtn");
    const backToTopBtn = document.getElementById("backToTopBtn");
    const dailyProjectionSection = document.getElementById("dailyProjection");

    const findBtn = document.getElementById("findDateBtn");
    const findInput = document.getElementById("findDateInput");

    // Load saved config
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // --- Helper Functions ---
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMYYYY(dateStr) {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
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

    // --- Render Transactions ---
    function renderTransactions() {
        transactionsTbody.innerHTML = "";
        transactions.sort((a,b) => new Date(a.date) - new Date(b.date));
        calculateBalances();
        saveTransactions();

        transactions.forEach((tx,index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDateDDMMYYYY(tx.date)}</td>
                <td>${tx.description}</td>
                <td>${tx.category || ''}</td>
                <td>${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${tx.balance.toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            transactionsTbody.appendChild(row);
        });

        // Delete handler
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const idx = parseInt(this.dataset.index);
                transactions.splice(idx,1);
                renderTransactions();
                renderDailyProjection();
            });
        });
    }

    // --- Add Transaction ---
    function addTransaction() {
        const tx = {
            description: descriptionEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value),
            category: categoryEl.value.trim(),
            frequency: document.getElementById("frequency").value,
            date: dateEl.value
        };
        if (!tx.description || !tx.date || isNaN(tx.amount)) {
            alert("Please fill in Description, Amount, and Date.");
            return;
        }
        transactions.push(tx);

        descriptionEl.value = "";
        typeEl.value = "income";
        amountEl.value = "";
        categoryEl.value = "";
        dateEl.value = "";

        renderTransactions();
        renderDailyProjection();
    }

    addBtn.addEventListener("click", addTransaction);

    saveConfigBtn.addEventListener("click", function() {
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderDailyProjection();
    });

    // --- Daily 24-Month Projection with repeating transactions ---
    function renderDailyProjection() {
        dailyTbody.innerHTML = "";

        const startDateStr = startDateEl.value;
        if (!startDateStr) return;

        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth()+24);

        let balance = parseFloat(openingBalanceEl.value) || 0;
        let current = new Date(startDate);

        while(current <= endDate) {
            transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                const freq = tx.frequency;

                let addThis = false;

                if(freq === "irregular") {
                    if(txDate.toDateString() === current.toDateString()) addThis = true;
                } else if(freq === "monthly") {
                    if(txDate.getDate() === current.getDate()) addThis = true;
                } else if(freq === "4weekly") {
                    const diffDays = Math.floor((current - txDate)/(1000*60*60*24));
                    if(diffDays >=0 && diffDays % 28 === 0) addThis = true;
                }

                if(addThis) {
                    if(tx.type==="income") balance += tx.amount;
                    else balance -= tx.amount;

                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td>${formatDateDDMMYYYY(current)}</td>
                        <td>${tx.description}</td>
                        <td>${tx.type}</td>
                        <td>${tx.amount.toFixed(2)}</td>
                        <td>${balance.toFixed(2)}</td>
                    `;
                    dailyTbody.appendChild(row);
                }
            });
            current.setDate(current.getDate()+1);
        }
    }

    // --- Find Date ---
    findBtn.addEventListener("click", function() {
        const val = findInput.value;
        if(!val) { alert("Please select a date."); return; }

        const dateStr = formatDateDDMMYYYY(val);
        let found = false;
        document.querySelectorAll("#dailyProjectionTable tbody tr").forEach(tr=>{
            tr.classList.remove("highlight-row");
            if(tr.children[0].textContent === dateStr) {
                tr.classList.add("highlight-row");
                tr.scrollIntoView({behavior:"smooth", block:"center"});
                found = true;
            }
        });
        if(!found) alert("No transactions found on this date.");
    });

    // --- Jump Buttons ---
    if(scrollToProjectionBtn && backToTopBtn && dailyProjectionSection) {
        scrollToProjectionBtn.addEventListener("click", ()=>{
            dailyProjectionSection.scrollIntoView({behavior:"smooth", block:"start"});
        });

        backToTopBtn.addEventListener("click", ()=>{
            window.scrollTo({top:0, behavior:"smooth"});
        });
    }

    // --- Initial Render ---
    renderTransactions();
    renderDailyProjection();

});
