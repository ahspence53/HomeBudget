// ---------- Data ----------
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

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

// Projection Find
const projectionFindInput = document.getElementById("projection-find-input");
const projectionFindNextBtn = document.getElementById("projection-find-next");
let lastProjectionFindIndex = -1;
let lastProjectionFindQuery = "";

// Projection Totals
const totalFromInput = document.getElementById("total-from-date");
const totalToInput = document.getElementById("total-to-date");
const totalDescInput = document.getElementById("total-desc");
const totalCatInput = document.getElementById("total-cat");
const calculateTotalBtn = document.getElementById("calculate-total-btn");

// Toggle Irregular
const toggleIrregularBtn = document.getElementById("toggle-irregular");
let showIrregular = true;

// Projection options
const showOnlyNegativeCheckbox = document.getElementById("showOnlyNegative");
const highlightNegativesCheckbox = document.getElementById("highlightNegatives");

// ---------- Utils ----------
function toISO(d){ if(!d) return ""; const date=new Date(d); if(isNaN(date)) return ""; return date.toISOString().split("T")[0]; }
function formatDate(iso){ if(!iso) return ""; const d=new Date(iso); if(isNaN(d)) return iso; return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function escapeHtml(str){return str?String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):"";}

// ---------- Categories ----------
function updateCategoryDropdown(){
    txCategorySelect.innerHTML='<option value="" disabled>Select category</option>';
    categories.forEach(c=>{
        const opt=document.createElement("option"); opt.value=c; opt.textContent=c; txCategorySelect.appendChild(opt);
    });
}
function addCategory(){
    const c = (newCategoryInput.value||"").trim();
    if(!c) return;
    if(!categories.includes(c)){categories.push(c); localStorage.setItem('categories',JSON.stringify(categories));}
    newCategoryInput.value="";
    updateCategoryDropdown();
    txCategorySelect.value = c;
}
addCategoryButton.addEventListener("click", addCategory);

// ---------- Config ----------
saveConfigButton.addEventListener("click",()=>{
    startDate = toISO(startDateInput.value);
    openingBalance = parseFloat(openingBalanceInput.value)||0;
    localStorage.setItem('startDate', startDate);
    localStorage.setItem('openingBalance', openingBalance);
    renderProjectionTable();
});
startDateInput.value = startDate;
openingBalanceInput.value = isNaN(openingBalance) ? "" : openingBalance;

// ---------- Transactions ----------
function saveTransactions(){localStorage.setItem('transactions', JSON.stringify(transactions));}
function addTransactionObj(obj){
    const tx={description:(obj.description||"").trim(), amount:parseFloat(obj.amount)||0, type:obj.type||'expense', frequency:obj.frequency||'irregular', category:obj.category||""};
    tx.date = toISO(obj.date) || "";
    if(!tx.description){alert("Enter description"); return;}
    if((tx.frequency==="monthly"||tx.frequency==="4-weekly")&&!tx.date){alert("Choose start date"); return;}
    transactions.push(tx);
    transactions.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}
addTxButton.addEventListener("click", ()=>{
    addTransactionObj({
        date: txDate.value, description: txDesc.value, type: txType.value,
        amount: txAmount.value, frequency: txFrequency.value, category: txCategorySelect.value||""
    });
    txDesc.value=""; txAmount.value=""; txDate.value=""; txCategorySelect.value=""; txFrequency.value="irregular"; txType.value="expense";
});

// ---------- Delete / Edit ----------
function deleteTransaction(idx){if(idx<0||idx>=transactions.length) return; transactions.splice(idx,1); saveTransactions(); renderTransactionTable(); renderProjectionTable();}
function renderTransactionTable(){
    transactionTableBody.innerHTML="";
    const sorted=[...transactions].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    sorted.forEach((tx, sortedIdx)=>{
        if(!showIrregular && tx.frequency==='irregular') return;
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${tx.date?formatDate(tx.date):""}</td>
            <td>${escapeHtml(tx.description)}</td>
            <td>${escapeHtml(tx.type)}</td>
            <td>${tx.amount.toFixed(2)}</td>
            <td>${escapeHtml(tx.category||"")}</td>
            <td>
                <button class="edit-btn" data-sorted-index="${sortedIdx}">Edit</button>
                <button class="delete-btn" data-sorted-index="${sortedIdx}">Delete</button>
            </td>`;
        transactionTableBody.appendChild(tr);

        tr.querySelector(".delete-btn").addEventListener("click", e=>{
            const sIdx=parseInt(e.target.getAttribute("data-sorted-index"),10);
            const txToDelete=sorted[sIdx];
            const origIdx=transactions.findIndex(t=>t.description===txToDelete.description && t.amount===txToDelete.amount && t.date===txToDelete.date && t.type===txToDelete.type && t.frequency===txToDelete.frequency && t.category===txToDelete.category);
            if(origIdx!==-1 && confirm("Delete this transaction?")) deleteTransaction(origIdx);
        });

        tr.querySelector(".edit-btn").addEventListener("click", e=>{
            const sIdx=parseInt(e.target.getAttribute("data-sorted-index"),10);
            const tx=sorted[sIdx];
            txDesc.value=tx.description; txAmount.value=tx.amount; txType.value=tx.type;
            txFrequency.value=tx.frequency; txDate.value=tx.date; txCategorySelect.value=tx.category;
            const origIdx=transactions.findIndex(t=>t.description===tx.description && t.amount===tx.amount && t.date===tx.date && t.type===tx.type && t.frequency===tx.frequency && t.category===tx.category);
            if(origIdx!==-1) transactions.splice(origIdx,1);
            saveTransactions();
            renderTransactionTable();
        });
    });
}
toggleIrregularBtn.addEventListener("click", ()=>{
    showIrregular=!showIrregular;
    renderTransactionTable();
});

// ---------- Recurrence ----------
function txOccursOn(tx, dateIso){
    if(!tx||!dateIso) return false;
    if(tx.frequency==='irregular') return tx.date===dateIso;
    if(!tx.date) return false;
    const start=new Date(tx.date), d=new Date(dateIso);
    if(d<start) return false;
    if(tx.frequency==='monthly'){
        const day=start.getDate();
        const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
        return d.getDate()===Math.min(day,lastDay);
    }
    if(tx.frequency==='4-weekly'){
        const diffDays=Math.floor((d-start)/(1000*60*60*24));
        return diffDays>=0 && diffDays%28===0;
    }
    return false;
}

// ---------- Projection ----------
function renderProjectionTable(){
    projectionTbody.innerHTML="";
    if(!startDate){projectionTbody.innerHTML=`<tr><td colspan="5" class="small">Please set Start Date and press Save.</td></tr>`; return;}
    const start=new Date(startDate); const end=new Date(start); end.setMonth(end.getMonth()+24); end.setDate(end.getDate()-1);
    let runningBalance=openingBalance||0;

    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
        const iso=toISO(d);
        let todays = transactions.filter(t=>txOccursOn(t,iso));

        // Deduplicate same transaction per day
        const uniqueDaily = new Set();
        todays = todays.filter(t=>{
            const key = `${t.description}|${t.type}|${t.amount}|${t.category}`;
            if(uniqueDaily.has(key)) return false;
            uniqueDaily.add(key);
            return true;
        });

        let income=0, expense=0, descs=[];
        todays.forEach(t=>{
            if(t.type==='income') income+=t.amount; else expense+=t.amount;
            const pretty = `${escapeHtml(t.description)}${t.category?` (${escapeHtml(t.category)})`:''}`;
            if(t.frequency==='irregular') descs.push(`<span class="irregular">${pretty}</span>`);
            else descs.push(pretty);
        });

        runningBalance += (income - expense);

        if(showOnlyNegativeCheckbox && showOnlyNegativeCheckbox.checked && runningBalance>=0) continue;

        const tr=document.createElement("tr");
        tr.setAttribute("data-date",iso);
        if(highlightNegativesCheckbox && highlightNegativesCheckbox.checked && runningBalance<0) tr.classList.add("neg-row");

        const dateCell = `<td>${formatDate(iso)}</td>`;
        const descCell = `<td>${descs.join("<br>")}</td>`;
        const incomeCell = `<td>${income>0?income.toFixed(2):""}</td>`;
        const expenseCell = `<td>${expense>0?expense.toFixed(2):""}</td>`;
        const balClass = runningBalance<0 ? ' class="neg-cell"' : "";
        const balCell = `<td${balClass}>${runningBalance.toFixed(2)}</td>`;

        tr.innerHTML = dateCell + descCell + incomeCell + expenseCell + balCell;
        projectionTbody.appendChild(tr);
    }
}

// ---------- Projection Find ----------
function rowMatchesQuery(row, query){
    if(!query) return false;
    const q=query.toLowerCase().trim();
    const asIso = tryParseToISO(q);
    if(asIso){
        if(row.getAttribute("data-date")===asIso) return true;
        if(formatDate(asIso).toLowerCase().includes(q)) return true;
    }
    if(row.textContent.toLowerCase().includes(q)) return true;
    return false;
}

function findNext(){
    const q = (projectionFindInput.value||"").trim();
    if(q && q !== lastProjectionFindQuery) lastProjectionFindIndex=-1; // reset if new query
    const query = q || lastProjectionFindQuery;
    if(!query){ alert("Enter search text"); return; }

    const rows = Array.from(projectionTbody.querySelectorAll("tr"));
    if(rows.length===0){ alert("No projection rows"); return; }

    let start = (lastProjectionFindIndex + 1) % rows.length;
    for(let i=0;i<rows.length;i++){
        const idx = (start + i) % rows.length;
        if(rowMatchesQuery(rows[idx], query)){
            rows.forEach(r=>r.classList.remove("projection-match-highlight"));
            rows[idx].classList.add("projection-match-highlight");
            rows[idx].scrollIntoView({behavior:"smooth",block:"center"});
            lastProjectionFindIndex = idx;
            lastProjectionFindQuery = query;
            return;
        }
    }
    alert("No matches found");
    lastProjectionFindIndex=-1;
    lastProjectionFindQuery="";
}
projectionFindNextBtn.addEventListener("click", findNext);
projectionFindInput.addEventListener("input", ()=> { lastProjectionFindIndex=-1; });

// ---------- Projection Totals ----------
calculateTotalBtn.addEventListener("click", ()=>{
    const from=toISO(totalFromInput.value); const to=toISO(totalToInput.value);
    const descFilter=(totalDescInput.value||"").toLowerCase(); const catFilter=(totalCatInput.value||"").toLowerCase();
    if(!from||!to){alert("Select From and To dates"); return;}
    if(new Date(from)>new Date(to)){alert("From must be before To"); return;}
    let totalIncome=0, totalExpense=0;
    for(let d=new Date(from); d<=new Date(to); d.setDate(d.getDate()+1)){
        const iso=toISO(d); const todays=transactions.filter(t=>txOccursOn(t,iso));
        todays.forEach(t=>{
            if(descFilter && !t.description.toLowerCase().includes(descFilter)) return;
            if(catFilter && !t.category.toLowerCase().includes(catFilter)) return;
            if(t.type==='income') totalIncome+=t.amount; else totalExpense+=t.amount;
        });
    }
    alert(`Total Income: £${totalIncome.toFixed(2)}\nTotal Expense: £${totalExpense.toFixed(2)}`);
});

// ---------- Back-to-top ----------
document.getElementById("back-to-top").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

// ---------- Init ----------
function init(){updateCategoryDropdown(); renderTransactionTable(); renderProjectionTable();}
init();
