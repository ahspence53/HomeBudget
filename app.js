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

    // Jump buttons
    const jumpToProjectionBtn = document.getElementById("jumpToProjectionBtn");
    const jumpToChartBtn = document.getElementById("jumpToChartBtn");
    const backToTopBtn1 = document.getElementById("backToTopBtn1");
    const backToTopBtn2 = document.getElementById("backToTopBtn2");

    // Load start date and opening balance
    startDateEl.value = localStorage.getItem("startDate") || "";
    openingBalanceEl.value = localStorage.getItem("openingBalance") || "";

    // ---------- Helpers ----------
    function saveTransactions() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    }

    function formatDateDDMMMYYYY(dateStr) {
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(dateStr).toLocaleDateString('en-GB', options).replace(/ /g, '-');
    }

    function calculateBalances() {
        let balance = parseFloat(openingBalanceEl.value) || 0;
        transactions.forEach(tx => {
            if (tx.type === "income") balance += tx.amount;
            else balance -= tx.amount;
            tx.balance = balance;
        });
    }

    // ---------- Transactions ----------
    function renderTransactions() {
        const tbody = document.querySelector("#transactionsTable tbody");
        tbody.innerHTML = "";

        transactions.sort((a,b) => new Date(a.date) - new Date(b.date));

        calculateBalances();
        saveTransactions();

        transactions.forEach((tx, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatDateDDMMMYYYY(tx.date)}</td>
                <td class="${tx.frequency==='irregular'?'desc-strong':''}">${tx.description}</td>
                <td>${tx.category}</td>
                <td class="${tx.type}">${tx.type}</td>
                <td>${tx.amount.toFixed(2)}</td>
                <td>${tx.balance.toFixed(2)}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            tbody.appendChild(row);
        });

        document.querySelectorAll(".delete-btn").forEach(btn=>{
            btn.addEventListener("click",function(){
                const idx=parseInt(this.dataset.index);
                if(confirm(`Delete transaction "${transactions[idx].description}" (£${transactions[idx].amount.toFixed(2)})?`)){
                    transactions.splice(idx,1);
                    renderTransactions();
                    renderDailyProjection();
                    renderChart();
                }
            });
        });
    }

    function addTransaction() {
        const tx = {
            description: descriptionEl.value.trim(),
            type: typeEl.value,
            amount: parseFloat(amountEl.value),
            category: categoryEl.value.trim(),
            frequency: frequencyEl.value,
            date: dateEl.value
        };
        if(!tx.description||isNaN(tx.amount)||!tx.date){ alert("Fill Description, Amount & Date."); return; }
        transactions.push(tx);
        descriptionEl.value=""; amountEl.value=""; categoryEl.value=""; dateEl.value="";
        renderTransactions();
        renderDailyProjection();
        renderChart();
    }

    saveConfigBtn.addEventListener("click",function(){
        localStorage.setItem("startDate", startDateEl.value);
        localStorage.setItem("openingBalance", openingBalanceEl.value);
        renderTransactions();
        renderDailyProjection();
        renderChart();
    });

    addBtn.addEventListener("click",function(e){ e.preventDefault(); addTransaction(); });

    // ---------- Daily Projection ----------
    function generateDailyProjectionArray(){
        const startStr=startDateEl.value;
        if(!startStr) return [];
        const startDate=new Date(startStr);
        const endDate=new Date(startDate.getFullYear(), startDate.getMonth()+24, startDate.getDate());
        let balance=parseFloat(openingBalanceEl.value)||0;
        const arr=[];
        for(let d=new Date(startDate); d<=endDate; d.setDate(d.getDate()+1)){
            let income=0, expense=0;
            transactions.forEach(tx=>{
                const txDate=new Date(tx.date);
                if(tx.frequency==='irregular' && txDate.getTime()===d.getTime()){
                    if(tx.type==='income') income+=tx.amount; else expense+=tx.amount;
                } else if(tx.frequency==='monthly' && txDate.getDate()===d.getDate() && txDate<=d){
                    if(tx.type==='income') income+=tx.amount; else expense+=tx.amount;
                } else if(tx.frequency==='4weekly' && txDate<=d){
                    const diffDays=Math.floor((d-txDate)/(1000*60*60*24));
                    if(diffDays%28===0){
                        if(tx.type==='income') income+=tx.amount; else expense+=tx.amount;
                    }
                }
            });
            const openingBalance=balance;
            const net=income-expense;
            balance+=net;
            arr.push({
                date: new Date(d),
                openingBalance,
                income,
                expense,
                balance
            });
        }
        return arr;
    }

    function renderDailyProjection(){
        const tbody=document.getElementById("projectionBody");
        tbody.innerHTML="";
        const arr=generateDailyProjectionArray();
        arr.forEach(row=>{
            const tr=document.createElement("tr");
            tr.innerHTML=`
                <td>${formatDateDDMMMYYYY(row.date)}</td>
                <td>${row.openingBalance.toFixed(2)}</td>
                <td>${row.income.toFixed(2)}</td>
                <td>${row.expense.toFixed(2)}</td>
                <td>${row.balance.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ---------- Chart ----------
    let budgetChart;
    function renderChart(){
        const arr=generateDailyProjectionArray();
        const labels=arr.map(r=>formatDateDDMMMYYYY(r.date));
        const balanceData=arr.map(r=>r.balance);
        const ctx=document.getElementById("budgetChart").getContext("2d");
        if(budgetChart) budgetChart.destroy();
        budgetChart=new Chart(ctx,{
            type:'line',
            data:{
                labels:labels,
                datasets:[{
                    label:'Cumulative Balance (£)',
                    data:balanceData,
                    borderColor:'#2a7bff',
                    backgroundColor:'rgba(42,123,255,0.2)',
                    tension:0.2,
                    fill:true
                }]
            },
            options:{
                responsive:true,
                maintainAspectRatio:false,
                plugins:{ legend:{position:'top'}, title:{display:true,text:'Daily Balance Projection'} },
                scales:{ x:{display:false}, y:{title:{display:true,text:'Balance (£)'}} }
            }
        });
    }

    // ---------- CSV Export ----------
    document.getElementById("exportTransactionsCSVBtn").addEventListener("click",function(){
        if(!transactions.length){ alert("No transactions to export."); return; }
        let csv="Date,Description,Category,Type,Amount,Balance\n";
        transactions.forEach(tx=>{
            csv+=`${formatDateDDMMMYYYY(tx.date)},${tx.description},${tx.category},${tx.type},${tx.amount.toFixed(2)},${tx.balance.toFixed(2)}\n`;
        });
        const blob=new Blob([csv],{type:"text/csv"});
        const link=document.createElement("a");
        link.href=URL.createObjectURL(blob);
        link.download="transactions.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    });

    document.getElementById("exportProjectionCSVBtn").addEventListener("click",function(){
        const arr=generateDailyProjectionArray();
        if(!arr.length){ alert("No projection to export."); return; }
        let csv="Date,Opening Balance,Income,Expense,Closing Balance\n";
        arr.forEach(row=>{
            csv+=`${formatDateDDMMMYYYY(row.date)},${row.openingBalance.toFixed(2)},${row.income.toFixed(2)},${row.expense.toFixed(2)},${row.balance.toFixed(2)}\n`;
        });
        const blob=new Blob([csv],{type:"text/csv"});
        const link=document.createElement("a");
        link.href=URL.createObjectURL(blob);
        link.download="daily_projection.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    });

    // ---------- Jump buttons ----------
    jumpToProjectionBtn.addEventListener("click",()=>{ document.getElementById("projectionSection").scrollIntoView({behavior:"smooth"}); });
    jumpToChartBtn.addEventListener("click",()=>{ document.getElementById("chartSection").scrollIntoView({behavior:"smooth"}); });
    backToTopBtn1.addEventListener("click",()=>{ window.scrollTo({top:0,behavior:"smooth"}); });
    backToTopBtn2.addEventListener("click",()=>{ window.scrollTo({top:0,behavior:"smooth"}); });

    // ---------- Initial Render ----------
    renderTransactions();
    renderDailyProjection();
    renderChart();

});
