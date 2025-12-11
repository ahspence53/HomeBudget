document.addEventListener("DOMContentLoaded", function() {

    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

    const startDateEl = document.getElementById("startDate");
    const openingBalanceEl = document.getElementById("openingBalance");
    const saveConfigBtn = document.getElementById("saveConfigBtn");

    const descriptionEl = document.getElementById("description");
    const typeEl = document.getElementById("type");
    const amountEl = document.getElementById("amount");
    const frequencyEl = document.getElementById("frequency");
    const dateEl = document.getElementById("date");
    const addBtn = document.getElementById("addBtn");

    const findDateInput = document.getElementById("findDateInput");
    const findDateBtn = document.getElementById("findDateBtn");

    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMMYYYY(dateStr) {
        const options = { day:'2-digit', month:'short', year:'numeric' };
        return new Date(dateStr).toLocaleDateString('en-GB', options).replace(/ /g,'-');
    }

    function calculateBalances() {
        let balance = parseFloat(openingBalanceEl.value) || 0;
        transactions.forEach(tx => {
            if(tx.type==='income') balance += tx.amount;
            else balance -= tx.amount;
            tx.balance = balance;
        });
    }

    function renderTransactions() {
        const tbody = document.querySelector("#transactionsTable tbody");
        tbody.innerHTML="";
        transactions.sort((a,b)=> new Date(a.date)-new Date(b.date));
        calculateBalances();
        saveTransactions();

        transactions.forEach((tx,index)=>{
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDateDDMMMYYYY(tx.date)}</td>
                <td class="${tx.frequency==='irregular'?'desc-strong':''}">${tx.description}</td>
                <td class="${tx.type}">${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${tx.balance.toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            tbody.appendChild(row);
        });

        document.querySelectorAll(".delete-btn").forEach(btn=>{
            btn.addEventListener("click", function(){
                const idx = parseInt(this.dataset.index);
                if(confirm(`Delete "${transactions[idx].description}" on ${formatDateDDMMMYYYY(transactions[idx].date)} (£${transactions[idx].amount.toFixed(2)})?`)){
                    transactions.splice(idx,1);
                    renderTransactions();
                    renderDailyProjection();
                }
            });
        });
    }

    function addTransaction() {
        const tx = {
            description: descriptionEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value),
            frequency: frequencyEl.value,
            date: dateEl.value
        };
        if(!tx.description || isNaN(tx.amount) || !tx.date){
            alert("Please fill in Description, Amount, and Date.");
            return;
        }
        transactions.push(tx);
        descriptionEl.value=""; amountEl.value=""; dateEl.value="";
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

    // ---------- Daily Projection with Repetition ----------
    function renderDailyProjection(){
        const tbody = document.querySelector("#dailyProjectionTable tbody");
        tbody.innerHTML="";
        const startDateStr = startDateEl.value;
        if(!startDateStr) return;
        let balance = parseFloat(openingBalanceEl.value)||0;
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth()+24);

        const projectionDates = [];
        let currentDate = new Date(startDate);
        while(currentDate <= endDate){
            projectionDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate()+1);
        }

        projectionDates.forEach(date=>{
            const txToday = [];

            transactions.forEach(tx=>{
                const txDate = new Date(tx.date);
                if(tx.frequency==='irregular'){
                    if(txDate.toDateString() === date.toDateString()) txToday.push(tx);
                } else if(tx.frequency==='monthly'){
                    if(date >= txDate && txDate.getDate() === date.getDate()) txToday.push(tx);
                } else if(tx.frequency==='4weekly'){
                    const diffDays = Math.floor((date - txDate)/(1000*60*60*24));
                    if(diffDays>=0 && diffDays % 28 === 0) txToday.push(tx);
                }
            });

            if(txToday.length>0){
                txToday.forEach(tx=>{
                    if(tx.type==='income') balance += tx.amount;
                    else balance -= tx.amount;
                    const row = document.createElement("tr");
                    row.innerHTML=`
                        <td class="freeze-col">${formatDateDDMMMYYYY(date.toISOString())}</td>
                        <td>${tx.description}</td>
                        <td>${tx.type}</td>
                        <td>${tx.amount.toFixed(2)}</td>
                        <td>${balance.toFixed(2)}</td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                const row = document.createElement("tr");
                row.innerHTML=`
                    <td class="freeze-col">${formatDateDDMMMYYYY(date.toISOString())}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>${balance.toFixed(2)}</td>
                `;
                tbody.appendChild(row);
            }
        });
    }

    // ---------- Find Date ----------
    findDateBtn.addEventListener("click", function(){
        const targetDateStr = findDateInput.value;
        if(!targetDateStr) return alert("Please select a valid date.");
        const targetDate = new Date(targetDateStr).toDateString();

        const rows = document.querySelectorAll("#dailyProjectionTable tbody tr");
        let found=false;
        rows.forEach(r=>r.classList.remove("highlight-row"));
        rows.forEach(row=>{
            const rowDate = new Date(row.cells[0].textContent).toDateString();
            if(rowDate === targetDate){
                row.scrollIntoView({behavior:"smooth", block:"center"});
                row.classList.add("highlight-row");
                found=true;
            }
        });
        if(!found) alert("Date not found in projection.");
    });

    renderTransactions();
    renderDailyProjection();

});
