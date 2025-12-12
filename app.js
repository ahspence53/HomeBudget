/* Enhanced Home Budget Tracker app.js
   - Aggregates transactions per day
   - Floating sticky Find with Prev/Next + match counter
   - All-matches highlight + current match highlight
   - Flexible date search (dd-MMM-yyyy, dd/mm/yyyy, dd-mm-yyyy)
   - Mini running-balance chart (canvas)
   - Export projection CSV
   - Keyboard shortcuts: Ctrl+F focuses Find; Enter in Add form adds tx
*/

// ---------- --- Data / Storage --- ----------
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let startDate = localStorage.getItem('startDate') || "";
let openingBalance = parseFloat(localStorage.getItem('openingBalance')) || 0;

// ---------- --- DOM --- ----------
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
const exportCsvBtn = document.getElementById("export-csv");

// Find toolbar
const projectionFindInput = document.getElementById("projection-find-input");
const projectionFindNextBtn = document.getElementById("projection-find-next");
const projectionFindPrevBtn = document.getElementById("projection-find-prev");
const findCounter = document.getElementById("find-counter");

// projection data
let projectionRows = [];        // DOM tr elements in order
let projectionIndexMap = [];    // array of objects {date, income, expense, balance, descHtml}
let matchIndexes = [];         // indexes of matches in projectionRows
let matchPos = -1;             // index within matchIndexes

// controls
const toggleIrregularBtn = document.getElementById("toggle-irregular");
let showIrregular = true;
const showOnlyNegativeCheckbox = document.getElementById("showOnlyNegative");
const highlightNegativesCheckbox = document.getElementById("highlightNegatives");

// totals controls
const totalFromInput = document.getElementById("total-from-date");
const totalToInput = document.getElementById("total-to-date");
const totalDescInput = document.getElementById("total-desc");
const totalCatInput = document.getElementById("total-cat");
const calculateTotalBtn = document.getElementById("calculate-total-btn");

// chart
const chartCanvas = document.getElementById("balance-chart");
const chartCtx = chartCanvas.getContext("2d");

// ---------- --- Utilities --- ----------
function toISO(d){ if(!d) return ""; const date=new Date(d); if(isNaN(date)) return ""; return date.toISOString().split("T")[0]; }
function formatDate(iso){ if(!iso) return ""; const d=new Date(iso); if(isNaN(d)) return iso; return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function escapeHtml(str){return str?String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):"";}

// try parse flexible date to ISO: dd/mm/yyyy or dd-mm-yyyy or dd mmm yyyy etc.
function parseFlexibleDateToISO(q){
  if(!q) return "";
  q=q.trim();
  // look for dd/mm/yyyy or dd-mm-yyyy
  const m1 = q.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m1){
    let dd = m1[1].padStart(2,'0'), mm = m1[2].padStart(2,'0'), yyyy = m1[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // try dd mmm yyyy (e.g. 28 Mar 2027)
  const m2 = q.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if(m2){
    const day = m2[1].padStart(2,'0');
    const mon = m2[2].toLowerCase().slice(0,3);
    const idx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(mon);
    if(idx>=0) return `${m2[3]}-${String(idx+1).padStart(2,'0')}-${day}`;
  }
  // try Date parse fallback
  const d = new Date(q);
  if(!isNaN(d)) return toISO(d);
  return "";
}

// ---------- --- Categories --- ----------
function updateCategoryDropdown(){
  txCategorySelect.innerHTML = '<option value="" disabled>Select category</option>';
  categories.forEach(c=>{
    const opt = document.createElement("option"); opt.value=c; opt.textContent=c; txCategorySelect.appendChild(opt);
  });
}
function addCategory(){
  const c = (newCategoryInput.value||"").trim();
  if(!c) return;
  if(!categories.includes(c)){ categories.push(c); localStorage.setItem('categories',JSON.stringify(categories)); }
  newCategoryInput.value="";
  updateCategoryDropdown();
  txCategorySelect.value=c;
}
addCategoryButton.addEventListener("click", addCategory);

// ---------- --- Config --- ----------
saveConfigButton.addEventListener("click", ()=>{
  startDate = toISO(startDateInput.value);
  openingBalance = parseFloat(openingBalanceInput.value)||0;
  localStorage.setItem('startDate', startDate);
  localStorage.setItem('openingBalance', openingBalance);
  renderProjectionTable();
});
startDateInput.value = startDate;
openingBalanceInput.value = isNaN(openingBalance) ? "" : openingBalance;

// ---------- --- Transactions (CRUD) --- ----------
function saveTransactions(){ localStorage.setItem('transactions', JSON.stringify(transactions)); }
function addTransactionObj(obj){
  const tx = {
    description: (obj.description||"").trim(),
    amount: parseFloat(obj.amount)||0,
    type: obj.type||'expense',
    frequency: obj.frequency||'irregular',
    category: obj.category||""
  };
  tx.date = toISO(obj.date) || "";
  if(!tx.description){ alert("Enter description"); return; }
  if((tx.frequency==="monthly"||tx.frequency==="4-weekly") && !tx.date){ alert("Choose start date"); return; }
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
  // reset inputs
  txDesc.value=""; txAmount.value=""; txDate.value=""; txCategorySelect.value=""; txFrequency.value="irregular"; txType.value="expense";
});

// allow Enter to add when focus on description or amount
[txDesc, txAmount].forEach(el=>{
  el.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){ e.preventDefault(); addTxButton.click(); }
  });
});

// render transaction table
function renderTransactionTable(){
  transactionTableBody.innerHTML="";
  const sorted=[...transactions].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  sorted.forEach((tx, idx)=>{
    if(!showIrregular && tx.frequency==='irregular') return;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${tx.date?formatDate(tx.date):""}</td>
                    <td>${escapeHtml(tx.description)}</td>
                    <td>${escapeHtml(tx.type)}</td>
                    <td>${tx.amount.toFixed(2)}</td>
                    <td>${escapeHtml(tx.category||"")}</td>
                    <td>
                      <button class="edit-btn" data-index="${idx}">Edit</button>
                      <button class="delete-btn" data-index="${idx}">Delete</button>
                    </td>`;
    transactionTableBody.appendChild(tr);

    tr.querySelector(".delete-btn").addEventListener("click", ()=>{
      if(confirm("Delete this transaction?")){
        transactions.splice(idx,1);
        saveTransactions();
        renderTransactionTable();
        renderProjectionTable();
      }
    });
    tr.querySelector(".edit-btn").addEventListener("click", ()=>{
      // load into form for editing; remove original entry
      txDesc.value = tx.description; txAmount.value = tx.amount; txType.value = tx.type;
      txFrequency.value = tx.frequency; txDate.value = tx.date; txCategorySelect.value = tx.category;
      transactions.splice(idx,1);
      saveTransactions();
      renderTransactionTable();
      renderProjectionTable();
    });
  });
}
toggleIrregularBtn.addEventListener("click", ()=>{ showIrregular = !showIrregular; renderTransactionTable(); });

// ---------- --- Recurrence helper --- ----------
function txOccursOn(tx, dateIso){
  if(!tx || !dateIso) return false;
  if(tx.frequency === 'irregular') return tx.date === dateIso;
  if(!tx.date) return false;
  const start = new Date(tx.date), d = new Date(dateIso);
  if(d < start) return false;
  if(tx.frequency === 'monthly'){
    const day = start.getDate();
    const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    return d.getDate() === Math.min(day, lastDay);
  }
  if(tx.frequency === '4-weekly'){
    const diffDays = Math.floor((d - start)/(1000*60*60*24));
    return diffDays >= 0 && diffDays % 28 === 0;
  }
  return false;
}

// ---------- --- Projection render & chart --- ----------
function renderProjectionTable(){
  projectionTbody.innerHTML = "";
  projectionRows = []; projectionIndexMap = [];

  if(!startDate){
    projectionTbody.innerHTML = `<tr><td colspan="5" class="small">Please set Start Date and press Save.</td></tr>`;
    drawChart([], []);
    updateFindCounter();
    return;
  }

  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);
  end.setDate(end.getDate()-1);

  // Build date map (one entry per date) - include dates even if no transactions if you want every day: current design only shows dates with transactions or negatives
  let runningBalance = openingBalance || 0;
  const dateMap = {}; // iso -> array of txs
  for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
    const iso = toISO(d);
    const todays = transactions.filter(t => txOccursOn(t, iso));
    // include even if empty: we still want a row if negative might show - we will check later
    dateMap[iso] = todays; // array (may be empty)
  }

  // Iterate in order and build rows (aggregate per day)
  const labels = []; const balances = [];
  Object.keys(dateMap).sort((a,b)=>new Date(a)-new Date(b)).forEach(iso=>{
    const todays = dateMap[iso];
    // aggregate by description+type+category to avoid duplicates
    const map = new Map();
    todays.forEach(t=>{
      const key = `${t.description}|${t.type}|${t.category||""}`;
      if(map.has(key)) map.get(key).amount += t.amount;
      else map.set(key, {...t});
    });
    const agg = Array.from(map.values());

    let income = 0, expense = 0;
    const descs = [];
    agg.forEach(t=>{
      if(t.type==='income') income += t.amount; else expense += t.amount;
      const pretty = `${escapeHtml(t.description)}${t.category?` (${escapeHtml(t.category)})`:''}`;
      if(t.frequency === 'irregular') descs.push(`<span class="irregular">${pretty}</span>`); else descs.push(pretty);
    });

    runningBalance += (income - expense);

    // If showOnlyNegative is checked and runningBalance >= 0 and there are no txs, skip
    if(showOnlyNegativeCheckbox.checked && runningBalance >= 0 && agg.length === 0) return;

    // Build row
    const tr = document.createElement("tr");
    tr.setAttribute("data-date", iso);
    tr.innerHTML = `<td>${formatDate(iso)}</td>
                    <td>${descs.join("<br>")}</td>
                    <td>${income>0?income.toFixed(2):""}</td>
                    <td>${expense>0?expense.toFixed(2):""}</td>
                    <td>${runningBalance.toFixed(2)}</td>`;

    if(highlightNegativesCheckbox.checked && runningBalance < 0) tr.classList.add("neg-row");
    projectionRows.push(tr);
    projectionIndexMap.push({date:iso, income, expense, balance: runningBalance, descHtml: descs.join(" | ")});
    projectionTbody.appendChild(tr);

    labels.push(formatDate(iso));
    balances.push(runningBalance);
  });

  drawChart(labels, balances);
  // After rendering, if there was an active match query, re-run the highlight to preserve sticky matches
  if(lastFindQuery && lastFindQuery.trim() !== "") {
    highlightAllMatches(lastFindQuery, true);
  } else {
    updateFindCounter();
  }
}

// ---------- --- Chart (simple canvas line) --- ----------
function drawChart(labels, balances){
  // clear
  const w = chartCanvas.width = Math.min(900, Math.max(480, document.querySelector("#projection-section").clientWidth - 40));
  const h = chartCanvas.height = 200;
  chartCtx.clearRect(0,0,w,h);

  if(balances.length===0) return;

  // compute min/max with padding
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const pad = Math.max(10, (max-min)*0.1);
  const yMin = min - pad;
  const yMax = max + pad;
  const range = yMax - yMin || 1;

  // helper to map value
  const px = (i) => Math.round(20 + i * ((w-40)/(balances.length-1 || 1)));
  const py = (v) => Math.round(h - 20 - ((v - yMin) / range) * (h-40));

  // gridlines
  chartCtx.strokeStyle = "#e6eef8"; chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  for(let g=0; g<=4; g++){
    const gy = 20 + g * ((h-40)/4);
    chartCtx.moveTo(0, gy); chartCtx.lineTo(w, gy);
  }
  chartCtx.stroke();

  // draw line
  chartCtx.beginPath();
  chartCtx.strokeStyle = "#2a7bff"; chartCtx.lineWidth = 2;
  balances.forEach((b,i)=>{
    if(i===0) chartCtx.moveTo(px(i), py(b)); else chartCtx.lineTo(px(i), py(b));
  });
  chartCtx.stroke();

  // fill under curve (subtle)
  chartCtx.lineTo(px(balances.length-1), h-20);
  chartCtx.lineTo(px(0), h-20);
  chartCtx.closePath();
  chartCtx.fillStyle = "rgba(42,123,255,0.08)";
  chartCtx.fill();

  // draw points
  chartCtx.fillStyle = "#2a7bff";
  balances.forEach((b,i)=>{ chartCtx.beginPath(); chartCtx.arc(px(i), py(b), 2.5, 0, Math.PI*2); chartCtx.fill(); });
}

// ---------- --- Find: highlight all matches + Prev/Next --- ----------
let lastFindQuery = ""; // persisted query string

function normalizeQuery(q){ return (q||"").trim().toLowerCase(); }

function highlightAllMatches(query, preservePosition){
  query = normalizeQuery(query);
  // clear previous highlights
  projectionRows.forEach(r=>r.classList.remove("projection-match-highlight","projection-current-highlight"));

  matchIndexes = []; matchPos = -1;
  if(!query) { updateFindCounter(); return; }

  // flexible date iso
  const isoQ = parseFlexibleDateToISO(query);

  projectionRows.forEach((row, idx)=>{
    const dateText = (row.cells[0]?.textContent||"").toLowerCase();
    const descText = (row.cells[1]?.textContent||"").toLowerCase();
    const isoAttr = row.getAttribute('data-date');
    if( (isoQ && isoAttr === isoQ) || dateText.includes(query) || descText.includes(query) ){
      matchIndexes.push(idx);
      row.classList.add("projection-match-highlight");
    }
  });

  updateFindCounter();
  if(preservePosition && matchIndexes.length>0){
    // if preservePosition is true, we try to keep matchPos pointing to same match index (if possible)
    // else reset to 0
    if(matchPos < 0 || matchPos >= matchIndexes.length) matchPos = 0;
    const idx = matchIndexes[matchPos];
    projectionRows[idx].classList.add("projection-current-highlight");
    projectionRows[idx].scrollIntoView({behavior:"smooth", block:"center"});
  } else {
    matchPos = -1;
  }
}

function updateFindCounter(){
  findCounter.textContent = `${matchIndexes.length? (matchPos>=0 ? matchPos+1 : 0) : 0}/${matchIndexes.length}`;
}

// Next match
projectionFindNextBtn.addEventListener("click", ()=>{
  const q = normalizeQuery(projectionFindInput.value);
  if(q !== lastFindQuery){
    lastFindQuery = q;
    highlightAllMatches(q, false);
  }
  if(matchIndexes.length === 0){ alert("No matches"); return; }
  matchPos = (matchPos + 1) % matchIndexes.length;
  // refresh current highlight
  projectionRows.forEach(r=>r.classList.remove("projection-current-highlight"));
  const idx = matchIndexes[matchPos];
  projectionRows[idx].classList.add("projection-current-highlight");
  projectionRows[idx].scrollIntoView({behavior:"smooth", block:"center"});
  updateFindCounter();
});

// Prev match
projectionFindPrevBtn.addEventListener("click", ()=>{
  const q = normalizeQuery(projectionFindInput.value);
  if(q !== lastFindQuery){
    lastFindQuery = q;
    highlightAllMatches(q, false);
  }
  if(matchIndexes.length === 0){ alert("No matches"); return; }
  matchPos = (matchPos - 1 + matchIndexes.length) % matchIndexes.length;
  projectionRows.forEach(r=>r.classList.remove("projection-current-highlight"));
  const idx = matchIndexes[matchPos];
  projectionRows[idx].classList.add("projection-current-highlight");
  projectionRows[idx].scrollIntoView({behavior:"smooth", block:"center"});
  updateFindCounter();
});

projectionFindInput.addEventListener("input", ()=>{
  const q = normalizeQuery(projectionFindInput.value);
  lastFindQuery = q;
  // reset match indexes as user types
  matchIndexes = []; matchPos = -1;
  highlightAllMatches(q, false);
});

// ---------- --- Export CSV --- ----------
function exportProjectionCSV(){
  if(projectionIndexMap.length === 0){ alert("No projection data to export"); return; }
  const rows = [["Date","Descriptions","Income","Expense","Daily Balance"]];
  projectionIndexMap.forEach(r=>{
    rows.push([r.date, r.descHtml.replace(/<br>/g," | ").replace(/<[^>]+>/g,""), r.income.toFixed(2), r.expense.toFixed(2), r.balance.toFixed(2)]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `projection-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
exportCsvBtn.addEventListener("click", exportProjectionCSV);

// ---------- --- Totals --- ----------
calculateTotalBtn.addEventListener("click", ()=>{
  const from = toISO(totalFromInput.value), to = toISO(totalToInput.value);
  const df = (totalDescInput.value||"").toLowerCase(), cf = (totalCatInput.value||"").toLowerCase();
  if(!from || !to){ alert("Select From and To dates"); return; }
  if(new Date(from) > new Date(to)){ alert("From must be before To"); return; }
  let ti=0, te=0;
  for(let d=new Date(from); d<=new Date(to); d.setDate(d.getDate()+1)){
    const iso = toISO(d);
    transactions.filter(t => txOccursOn(t, iso)).forEach(t => {
      if(df && !t.description.toLowerCase().includes(df)) return;
      if(cf && !t.category.toLowerCase().includes(cf)) return;
      if(t.type === 'income') ti += t.amount; else te += t.amount;
    });
  }
  alert(`Total Income: £${ti.toFixed(2)}\nTotal Expense: £${te.toFixed(2)}`);
});

// ---------- --- Keyboard shortcuts --- ----------
document.addEventListener("keydown", (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='f'){ e.preventDefault(); projectionFindInput.focus(); projectionFindInput.select(); }
});

// ---------- --- Init --- ----------
function init(){
  updateCategoryDropdown();
  renderTransactionTable();
  renderProjectionTable();
}
init();
