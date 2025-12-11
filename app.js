document.addEventListener("DOMContentLoaded", function() {

    // load saved transactions (array of {date,description,category,type,amount})
    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

    // elements
    const startDateEl = document.getElementById("startDate");
    const openingBalanceEl = document.getElementById("openingBalance");
    const saveConfigBtn = document.getElementById("saveConfigBtn");

    const descriptionEl = document.getElementById("description");
    const typeEl = document.getElementById("type");
    const amountEl = document.getElementById("amount");
    const categoryEl = document.getElementById("category");
    const dateEl = document.getElementById("date");
    const addBtn = document.getElementById("addBtn");

    const findDateInput = document.getElementById("findDateInput");
    const findDateBtn = document.getElementById("findDateBtn");

    // restore config
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // helpers
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMMYYYY(dateStr) {
        const options = { day:'2-digit', month:'short', year:'numeric' };
        return new Date(dateStr).toLocaleDateString('en-GB', options).replace(/ /g,'-');
    }

    // compute balances for transactions list (cumulative in entry order by date)
    function calculateBalances() {
        let bal = parseFloat(openingBalanceEl.value) || 0;
        transactions.sort((a,b)=> new Date(a.date) - new Date(b.date));
        transactions.forEach(tx => {
            if (tx.type === 'income') bal += tx.amount;
            else bal -= tx.amount;
            tx.balance = bal;
        });
    }

    // render main transactions table (shows category)
    function renderTransactions() {
        const tbody = document.querySelector("#transactionsTable tbody");
        tbody.innerHTML = "";
        calculateBalances();
        saveTransactions();

        transactions.forEach((tx, idx) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formatDateDDMMMYYYY(tx.date)}</td>
                <td class="${tx.frequency==='irregular'?'desc-strong':''}">${tx.description}</td>
                <td>${tx.category || ""}</td>
                <td class="${tx.type}">${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${(tx.balance||0).toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${idx}">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll(".delete-btn").forEach(btn=>{
            btn.addEventListener("click", function(){
                const idx = parseInt(this.dataset.index,10);
                if (confirm(`Delete "${transactions[idx].description}" on ${formatDateDDMMMYYYY(transactions[idx].date)}?`)) {
                    transactions.splice(idx,1);
                    saveTransactions();
                    renderTransactions();
                    renderDailyProjection();
                }
            });
        });
    }

    // add transaction (category included)
    function addTransaction() {
        const tx = {
            date: dateEl.value,
            description: descriptionEl.value.trim(),
            category: categoryEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value)
        };
        if (!tx.description || isNaN(tx.amount) || !tx.date) {
            alert("Please fill Description, Amount and Date.");
            return;
        }
        transactions.push(tx);
        saveTransactions();
        // clear inputs
        descriptionEl.value=""; categoryEl.value=""; amountEl.value=""; dateEl.value="";
        renderTransactions();
        renderDailyProjection();
    }

    addBtn.addEventListener("click", function(e){
        e.preventDefault();
        addTransaction();
    });

    saveConfigBtn.addEventListener("click", function(){
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderDailyProjection();
    });

    // helper: compute an occurrence date for tx monthly with "push to last valid day" if needed
    function monthlyOccurrence(txDate, monthOffset) {
        const orig = new Date(txDate);
        const year = orig.getFullYear();
        const month = orig.getMonth() + monthOffset;
        const y = year + Math.floor(month / 12);
        const m = ((month % 12) + 12) % 12;
        const day = orig.getDate();
        const lastDay = new Date(y, m+1, 0).getDate(); // last day of month m
        const d = Math.min(day, lastDay);
        return new Date(y, m, d);
    }

    // ---------- Daily projection (24 months) ----------
    function renderDailyProjection() {
        const tbody = document.querySelector("#dailyProjectionTable tbody");
        tbody.innerHTML = "";

        const startDateStr = startDateEl.value;
        if (!startDateStr) return;

        const start = new Date(startDateStr);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 24);

        // Build a map dateIso -> array of transaction occurrences on that date
        const occMap = Object.create(null); // { 'YYYY-MM-DD': [ {tx}, ... ] }

        // For each transaction, project 24 monthly occurrences (offset 0..23) and add into occMap if in range
        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            for (let offset = 0; offset < 24; offset++) {
                const occ = monthlyOccurrence(tx.date, offset);
                // only include occurrences >= start and <= end
                if (occ >= start && occ <= end) {
                    const iso = occ.toISOString().slice(0,10);
                    if (!occMap[iso]) occMap[iso] = [];
                    // store a shallow copy with fields needed (preserve original tx's category if needed)
                    occMap[iso].push({
                        dateIso: iso,
                        description: tx.description,
                        type: tx.type,
                        amount: tx.amount,
                        category: tx.category || ""
                    });
                }
            }
        });

        // iterate every day in window, render occurrences or blank
        let balance = parseFloat(openingBalanceEl.value) || 0;
        let cur = new Date(start);
        while (cur <= end) {
            const iso = cur.toISOString().slice(0,10);
            const list = occMap[iso] || [];

            if (list.length > 0) {
                // each occurrence is a separate row (one row per transaction)
                list.forEach(item => {
                    if (item.type === 'income') balance += item.amount;
                    else balance -= item.amount;
                    const tr = document.createElement("tr");
                    tr.dataset.date = iso;
                    tr.innerHTML = `
                        <td class="freeze-col">${formatDateDDMMMYYYY(cur.toISOString())}</td>
                        <td>${item.description}</td>
                        <td>${item.type}</td>
                        <td>${item.amount.toFixed(2)}</td>
                        <td>${balance.toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                // blank row for the date (carry forward balance)
                const tr = document.createElement("tr");
                tr.dataset.date = iso;
                tr.innerHTML = `
                    <td class="freeze-col">${formatDateDDMMMYYYY(cur.toISOString())}</td>
                    <td></td><td></td><td></td>
                    <td>${balance.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            }

            cur.setDate(cur.getDate() + 1);
        }
    }

    // ---------- Find Date (dd-mm-yyyy) ----------
    findDateBtn.addEventListener("click", function(){
        const raw = findDateInput.value && findDateInput.value.trim();
        if (!raw || !/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
            return alert("Please enter a valid date in dd-mm-yyyy format.");
        }
        const [dd, mm, yyyy] = raw.split("-");
        const iso = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD

        const rows = document.querySelectorAll("#dailyProjectionTable tbody tr");
        let found = false;
        rows.forEach(r => r.classList.remove("highlight-row"));

        for (let i=0; i<rows.length; i++){
            const row = rows[i];
            if (row.dataset.date === iso) {
                row.scrollIntoView({behavior:"smooth", block:"center"});
                row.classList.add("highlight-row");
                found = true;
                break;
            }
        }
        if (!found) alert("Date not found in projection.");
    });

    // initial render
    renderTransactions();
    renderDailyProjection();

});
