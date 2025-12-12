// ================================
// app.js - Home Budget Tracker
// ================================

// ---------- Data / Persistence ----------
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// ---------- DOM Refs ----------
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

// Projection find inputs
const projectionFindInput = document.getElementById("projection-find-input");
const projectionFindBtn = document.getElementById("projection-find-btn");
const projectionFindNextBtn = document.getElementById("projection-find-next-btn");

// ---------- Utilities ----------
function toISO(dateLike){
    if(!dateLike) return "";
    if(dateLike instanceof Date && !isNaN(dateLike)) return dateLike.toISOString().split("T")[0];
    const s = String(dateLike).trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/;
    if(isoMatch.test(s)){ const d = new Date(s); if(!isNaN(d)) return d.toISOString().split("T")[0]; }
    const dmMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const m = s.match(dmMatch);
    if(m){ const day=parseInt(m[1],10), mon=parseInt(m[2],10)-1, yr=parseInt(m[3],10); const d=new Date(yr,mon,day); if(!isNaN(d)) return d.toISOString().split("T")[0]; }
    const d = new Date(s);
    if(!isNaN(d)) return d.toISOString().split("T")[0];
    return "";
}

function formatDate(iso){
    if(!iso) return "";
    const d=new Date(iso);
    if(isNaN(d)) return iso;
    return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
}

function escapeHtml(str){
    if(!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ---------- Category Handling ----------
function updateCategoryDropdown(){
    txCategorySelect.innerHTML='<option value="" disabled>Select category</option>';
    categories.forEach(cat=>{
        const opt=document.createElement("option");
        opt.value=cat;
        opt.textContent=cat;
        txCategorySelect.appendChild(opt);
    });
}
function addCategory(){
    const c=(newCategoryInput.value||"").trim();
    if(!c) return;
    if(!categories.includes(c)) categories.push(c);
    localStorage.setItem('categories',JSON.stringify(categories));
    newCategoryInput.value="";
    updateCategoryDropdown();
    txCategorySelect.value=c;
}
addCategoryButton.addEventListener("click",addCategory);

// ---------- Config ----------
saveConfigButton.addEventListener("click",()=>{
    startDate = toISO(startDateInput.value);
    openingBalance = parseFloat(openingBalanceInput.value)||0;
    localStorage.setItem('startDate',startDate);
    localStorage.setItem('openingBalance',openingBalance);
    renderProjectionTable();
});

startDateInput.value = startDate;
openingBalanceInput.value = isNaN(openingBalance) ? "" : openingBalance;

// ---------- Transactions ----------
function saveTransactions(){ localStorage.setItem('transactions',JSON.stringify(transactions)); }

function addTransactionObj(obj){
    const tx={
        description: String(obj.description||"").trim(),
        amount: parseFloat(obj.amount)||0,
        type: obj.type||'expense',
        frequency: obj.frequency||'irregular',
        category: obj.category||"",
        date: toISO(obj.date)||""
    };
    if(!tx.description){ alert("Enter description"); return; }
    if((tx.frequency==='monthly'||tx.frequency==='4-weekly') && !tx.date){ alert("Choose start date"); return; }
    transactions.push(tx);
    transactions.sort((a,b)=>{ const da=a.date?new Date(a.date):new Date(0); const db=b.date?new Date(b.date):new Date(0); return da-db; });
    saveTransactions();
    renderTransactionTable();
    renderProjectionTable();
}

addTxButton.addEventListener("click",()=>{
    const tx={date:txDate.value,description:txDesc.value,type:txType.value,amount:txAmount.value,frequency:txFrequency.value,category:txCategorySelect.value||""};
    addTransactionObj(tx);
    txDesc.value=""; txAmount.value=""; txDate.value=""; txCategorySelect.value=""; txFrequency.value="irregular"; txType.value="expense";
});

function deleteTransaction(index){ if(index<0||index>=transactions.length) return; transactions.splice(index,1); saveTransactions(); renderTransactionTable(); }

function renderTransactionTable(){
    transactionTableBody.innerHTML="";
    let runningBalance = openingBalance||0;
    const sorted=[...transactions].sort((a,b)=>{ const da=a.date?new Date(a.date):new Date(0); const db=b.date?new Date(b.date):new Date(0); return da-db; });
    sorted.forEach((tx,sortedIdx)=>{
        runningBalance += tx.type==='income'?tx.amount:-tx.amount;
        const tr=document.createElement("tr");
        const descHtml=tx.frequency==='irregular'?`<span class="irregular">${escapeHtml(tx.description)}</span>`:escapeHtml(tx.description);
        tr.innerHTML=`<td>${tx.date?formatDate(tx.date):""}</td>
            <td>${descHtml}</td>
            <td>${escapeHtml(tx.type)}</td>
            <td>${tx.amount.toFixed(2)}</td>
            <td>${escapeHtml(tx.category||"")}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td><button class="delete-btn" data-sorted-index="${sortedIdx}">Delete</button></td>`;
        transactionTableBody.appendChild(tr);
        tr.querySelector(".delete-btn").addEventListener("click",(e)=>{
            const sIdx=parseInt(e.target.getAttribute("data-sorted-index"),10);
            const txToDelete=sorted[sIdx];
            const origIdx=transactions.findIndex(t=>t.description===txToDelete.description && t.amount===txToDelete.amount && t.date===txToDelete.date && t.type===txToDelete.type && t.frequency===txToDelete.frequency && t.category===txToDelete.category);
            if(origIdx===-1){ if(confirm("Delete transaction?")){ const mappedIdx=transactions.indexOf(txToDelete); if(mappedIdx>=0) deleteTransaction(mappedIdx); } return; }
            if(confirm("Delete transaction?")) deleteTransaction(origIdx);
        });
    });
}

// ---------- Projection ----------
function txOccursOn(tx,dateIso){ if(!tx||!dateIso) return false; if(tx.frequency==='irregular') return tx.date===dateIso; if(!tx.date) return false; const start=new Date(tx.date); const d=new Date(dateIso); if(d<start) return false; if(tx.frequency==='monthly'){ const startDay=start.getDate(); const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); const matchDay=Math.min(startDay,lastDay); return d.getDate()===matchDay; } if(tx.frequency==='4-weekly'){ const diffMs=d-start; const diffDays=Math.floor(diffMs/(1000*60*60*24)); return diffDays>=0&&diffDays%28===0; } return false; }

function renderProjectionTable(){
    projectionTbody.innerHTML="";
    if(!startDate){ const tr=document.createElement("tr"); tr.innerHTML=`<td colspan="5" class="small">Set Start Date and Save to generate projection.</td>`; projectionTbody.appendChild(tr); return; }
    const start=new Date(startDate); const end=new Date(start); end.setMonth(end.getMonth()+24); end.setDate(end.getDate()-1);
    let runningBalance=openingBalance||0;
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
        const iso=toISO(d);
        const todays=transactions.filter(t=>txOccursOn(t,iso));
        let income=0,expense=0; const descs=[];
        todays.forEach(t=>{ if(t.type==='income') income+=t.amount; else expense+=t.amount; const catStr=t.category?` (${escapeHtml(t.category)})`:""; const label=t.frequency==='irregular'?`<span class="irregular">${escapeHtml(t.description)}${catStr}</span>`:`${escapeHtml(t.description)}${catStr}`; descs.push(label); });
        runningBalance += income-expense;
        const tr=document.createElement("tr");
        tr.setAttribute("data-date",iso);
        if(runningBalance<0) tr.classList.add("negative");
        tr.innerHTML=`<td>${formatDate(iso)}</td><td>${descs.join("<br>")}</td><td>${income>0?income.toFixed(2):""}</td><td>${expense>0?expense.toFixed(2):""}</td><td>${runningBalance.toFixed(2)}</td>`;
        projectionTbody.appendChild(tr);
    }
}

// ---------- Projection Find / Find Next ----------
let lastProjectionFindIndex=-1;

function projectionFindNext(){
    const q=(projectionFindInput.value||"").trim().toLowerCase();
    if(!q){ alert("Enter search text"); return; }
    const rows=Array.from(projectionTbody.querySelectorAll("tr"));
    if(rows.length===0) return alert("No projection rows");
    let start=lastProjectionFindIndex+1;
    if(start>=rows.length) start=0;
    for(let i=0;i<rows.length;i++){
        const idx=(start+i)%rows.length;
        const row=rows[idx];
        const txt=row.textContent.toLowerCase();
        if(txt.includes(q)){
            rows.forEach(r=>r.classList.remove("projection-match-highlight"));
            row.classList.add("projection-match-highlight");
            row.scrollIntoView({behavior:"smooth",block:"center"});
            lastProjectionFindIndex=idx;
            return;
        }
    }
    alert("No more matches");
    lastProjectionFindIndex=-1;
}

projectionFindBtn.addEventListener("click",()=>{ lastProjectionFindIndex=-1; projectionFindNext(); });
projectionFindNextBtn.addEventListener("click",projectionFindNext);
projectionFindInput.addEventListener("input",()=>{
    lastProjectionFindIndex=-1;
    projectionTbody.querySelectorAll("tr").forEach(r=>r.classList.remove("projection-match-highlight"));
});

// ---------- Back to Top ----------
document.getElementById("back-to-top").addEventListener("click",()=>{ window.scrollTo({top:0,behavior:"smooth"}); });

// ---------- Init ----------
function init(){ updateCategoryDropdown(); renderTransactionTable(); renderProjectionTable(); }
init();
