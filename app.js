
// IndexedDB wrapper (simple)
const DB_NAME = 'budget_db_v1';
const STORE_TX = 'transactions';
const STORE_META = 'meta';
const STORE_CATS = 'categories';
let db = null;

function openDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if(!idb.objectStoreNames.contains(STORE_TX)) idb.createObjectStore(STORE_TX, {keyPath:'id'});
      if(!idb.objectStoreNames.contains(STORE_META)) idb.createObjectStore(STORE_META, {keyPath:'k'});
      if(!idb.objectStoreNames.contains(STORE_CATS)) idb.createObjectStore(STORE_CATS, {keyPath:'name'});
    };
    req.onsuccess = (e)=>{ db = e.target.result; res(db); };
    req.onerror = (e)=> rej(e.target.error);
  });
}

function idbPut(store, val){
  return new Promise((res, rej)=>{
    const tx = db.transaction(store, 'readwrite').objectStore(store).put(val);
    tx.onsuccess = ()=>res(true);
    tx.onerror = (e)=>rej(e.target.error);
  });
}
function idbGetAll(store){
  return new Promise((res, rej)=>{
    const tx = db.transaction(store, 'readonly').objectStore(store).getAll();
    tx.onsuccess = ()=>res(tx.result);
    tx.onerror = (e)=>rej(e.target.error);
  });
}
function idbGet(store, key){
  return new Promise((res, rej)=>{
    const tx = db.transaction(store, 'readonly').objectStore(store).get(key);
    tx.onsuccess = ()=>res(tx.result);
    tx.onerror = (e)=>rej(e.target.error);
  });
}
function idbDelete(store, key){
  return new Promise((res, rej)=>{
    const tx = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    tx.onsuccess = ()=>res(true);
    tx.onerror = (e)=>rej(e.target.error);
  });
}
function idbClear(store){
  return new Promise((res, rej)=>{
    const tx = db.transaction(store, 'readwrite').objectStore(store).clear();
    tx.onsuccess = ()=>res(true);
    tx.onerror = (e)=>rej(e.target.error);
  });
}

// Web Crypto helpers (PBKDF2 + AES-GCM)
async function deriveKeyFromPassword(password, saltBuffer){
  const pw = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2', salt: saltBuffer, iterations:200000, hash:'SHA-256'}, baseKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  return key;
}
function bufToB64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64ToBuf(b64){ const s=atob(b64); const arr=new Uint8Array(s.length); for(let i=0;i<s.length;i++) arr[i]=s.charCodeAt(i); return arr.buffer; }

async function encryptData(key, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, pt);
  return { cipher: bufToB64(cipher), iv: bufToB64(iv.buffer) };
}
async function decryptData(key, cipherB64, ivB64){
  const cipherBuf = b64ToBuf(cipherB64);
  const iv = new Uint8Array(b64ToBuf(ivB64));
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, cipherBuf);
  return JSON.parse(new TextDecoder().decode(plain));
}

// App state
let unlocked = false;
let masterKey = null; // CryptoKey for encryption when unlocked
let meta = { encrypted:false };

// Starter categories
const defaultCategories = ["Salary (Monthly)","Salary (4-weekly)","Benefits/Allowances","Pension","Other income (irregular)","Rent/Mortgage","Gas","Electricity","Water","Council Tax","Broadband","Mobile","Food/Shopping","Fuel/Transport","Insurance","Subscriptions","Entertainment","Miscellaneous"];

// UI elements
const login = document.getElementById('login');
const loginPw = document.getElementById('loginPw');
const loginMsg = document.getElementById('loginMsg');
const loginBtn = document.getElementById('loginBtn');
const useOfflineBtn = document.getElementById('useOfflineBtn');
const appEl = document.getElementById('app');
const statusEl = document.getElementById('status');
const lockBtn = document.getElementById('lockBtn');
const securityBtn = document.getElementById('securityBtn');
const secModal = document.getElementById('secModal');
const secContent = document.getElementById('secContent');
const closeSec = document.getElementById('closeSec');
const addTxBtn = document.getElementById('addTx');
const dateEl = document.getElementById('date');
const amountEl = document.getElementById('amount');
const typeEl = document.getElementById('type');
const categoryEl = document.getElementById('category');
const descEl = document.getElementById('desc');
const recEl = document.getElementById('recurrence');
const txList = document.getElementById('txList');
const summaryEl = document.getElementById('summary');
const monthFilter = document.getElementById('monthFilter');
const categoryFilter = document.getElementById('categoryFilter');
const viewMode = document.getElementById('viewMode');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const importCsv = document.getElementById('importCsv');
const backupBtn = document.getElementById('backupBtn');
const installBtn = document.getElementById('installBtn');
const categoryManager = document.getElementById('categoryManager');
const newCategory = document.getElementById('newCategory');
const addCategoryBtn = document.getElementById('addCategory');

// initialize DB and UI
(async function init(){
  await openDB();
  // ensure categories exist
  const cats = await idbGetAll(STORE_CATS);
  if(!cats || cats.length===0){
    for(const c of defaultCategories) await idbPut(STORE_CATS, {name:c});
  }
  // load meta
  const m = await idbGet(STORE_META, 'meta');
  if(m) meta = m.val;
  // date default
  dateEl.value = new Date().toISOString().slice(0,10);
})();

// ----- Login flow -----
// For convenience we allow an initial app-password seeded in localStorage under 'app_login_hash' (serverless).
// If none exists, accept any password (first run) and save a hashed verifier.
async function hashPassword(pw, saltHex){
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const pwUtf = new TextEncoder().encode(pw);
  const base = await crypto.subtle.importKey('raw', pwUtf, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'}, base, 256);
  return { hash: bufToHex(bits), salt: bufToHex(salt.buffer) };
}
function bufToHex(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function hexToBuf(hex){ const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(h=>parseInt(h,16))); return bytes.buffer; }

async function ensureLoginVerifier(){
  const v = localStorage.getItem('app_login_verifier');
  if(!v){
    // set default from provided password "Abidg3t£&@" — embed as initial verifier
    const initial = "Abidg3t£&@";
    const r = await hashPassword(initial);
    localStorage.setItem('app_login_verifier', JSON.stringify(r));
  }
}
ensureLoginVerifier();

loginBtn.addEventListener('click', async ()=>{
  const pw = loginPw.value || '';
  const verifier = JSON.parse(localStorage.getItem('app_login_verifier') || '{}');
  if(!verifier.hash){
    // first time: set verifier
    const r = await hashPassword(pw);
    localStorage.setItem('app_login_verifier', JSON.stringify(r));
    unlocked = true;
    showApp();
    return;
  }
  const check = await hashPassword(pw, verifier.salt);
  if(check.hash === verifier.hash){
    // if encrypted data exists, derive key for decrypting
    if(meta.encrypted){
      try{
        const saltBuf = b64ToBuf(meta.salt);
        masterKey = await deriveKeyFromPassword(pw, saltBuf);
        // try decrypt blob
        const enc = await idbGet(STORE_META, 'enc');
        if(enc && enc.cipher){
          const plain = await decryptData(masterKey, enc.cipher, enc.iv);
          // store plain into transactions store (replace)
          await idbClear(STORE_TX);
          for(const tx of plain.transactions || []) await idbPut(STORE_TX, tx);
          // categories
          await idbClear(STORE_CATS);
          for(const c of (plain.categories || defaultCategories)) await idbPut(STORE_CATS, {name:c});
          // clear encrypted blob optionally kept
        }
        unlocked = true;
        showApp();
      }catch(e){
        console.error('decrypt fail', e);
        loginMsg.textContent = 'Password correct but decryption failed.';
      }
    } else {
      unlocked = true;
      showApp();
    }
  } else {
    loginMsg.textContent = 'Wrong password';
  }
});

useOfflineBtn.addEventListener('click', ()=> { unlocked = true; showApp(); });

// Lock
lockBtn.addEventListener('click', ()=> { location.reload(); });

// Show app UI
async function showApp(){
  login.style.display = 'none';
  appEl.style.display = 'block';
  populateCategories();
  renderAll();
  statusEl.textContent = meta.encrypted ? 'Encrypted storage' : 'Unencrypted';
}

// ----- Transactions CRUD -----
function uid(){ return 'id'+Date.now()+Math.floor(Math.random()*9999); }

addTxBtn.addEventListener('click', async ()=>{
  const d = dateEl.value;
  const a = Number(amountEl.value) || 0;
  const t = typeEl.value;
  const c = categoryEl.value.trim() || 'Uncategorized';
  const desc = descEl.value.trim();
  const rec = recEl.value || 'none';
  if(!d){ alert('Pick date'); return; }
  const tx = { id: uid(), date:d, amount: a.toFixed(2), type:t, category:c, description:desc, recurrence:rec };
  await idbPut(STORE_TX, tx);
  // ensure category exists
  await idbPut(STORE_CATS, {name:c});
  amountEl.value=''; descEl.value=''; categoryEl.value='';
  renderAll();
});

async function deleteTx(id){
  if(!confirm('Delete transaction?')) return;
  await idbDelete(STORE_TX, id);
  renderAll();
}

async function renderAll(){
  const all = await idbGetAll(STORE_TX);
  // apply filters and viewMode for summary
  const cats = await idbGetAll(STORE_CATS);
  renderCategoryManager(cats.map(c=>c.name));
  renderCategoryFilter(cats.map(c=>c.name));
  renderTxList(all);
  renderSummary(all);
  renderMonthFilter(all);
}

function renderTxList(list){
  // sort desc
  list.sort((a,b)=> new Date(b.date) - new Date(a.date));
  const fm = monthFilter.value || '';
  const catf = categoryFilter.value || '';
  const visible = list.filter(tx=> (!fm || tx.date.startsWith(fm)) && (!catf || tx.category===catf));
  txList.innerHTML = visible.map(tx=>`<div class="tx-row"><div><strong>${tx.date}</strong> ${tx.category} — ${tx.description||''}</div><div><span>${tx.type==='income'?'+':'-'}£${(tx.type==='income'?Number(tx.amount):Number(tx.amount)).toFixed(2)}</span> <button class="btn-ghost" data-id="${tx.id}" onclick="deleteTx('${tx.id}')">Delete</button></div></div>`).join('') || '<div class="note">No transactions</div>';
}

function renderSummary(all){
  const mode = viewMode.value;
  let start=null, end=null;
  const now = new Date();
  if(mode==='month'){
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
  } else if(mode==='4weeks'){
    end = new Date(); start = new Date(); start.setDate(end.getDate()-27);
  }
  let income=0, expense=0;
  for(const tx of all){
    const txd = new Date(tx.date+'T00:00:00');
    const inRange = !start || (txd>=start && txd<=end);
    if(inRange){
      if(tx.type==='income') income += Number(tx.amount);
      else expense += Number(tx.amount);
    }
    // project recurrence - simplified: if tx.recurrence present and in period, counted already
  }
  summaryEl.innerHTML = `<div class="card"><strong>Income</strong><div>£${income.toFixed(2)}</div></div><div class="card"><strong>Expenses</strong><div>£${expense.toFixed(2)}</div></div><div class="card"><strong>Net</strong><div>£${(income-expense).toFixed(2)}</div></div>`;
}

function renderMonthFilter(all){
  const months = Array.from(new Set(all.map(t=> t.date? t.date.slice(0,7):null))).filter(Boolean).sort().reverse();
  monthFilter.innerHTML = '<option value="">(all)</option>' + months.map(m=>`<option value="${m}">${m}</option>`).join('');
}

// Categories UI
async function populateCategories(){
  const cats = await idbGetAll(STORE_CATS);
  renderCategoryManager(cats.map(c=>c.name));
  renderCategoryFilter(cats.map(c=>c.name));
}
function renderCategoryManager(list){
  categoryManager.innerHTML = list.map((c,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0"><div>${c}</div><div><button class="btn-ghost" onclick="renameCategory('${c}')">Edit</button><button class="btn-ghost" onclick="removeCategory('${c}')">Delete</button></div></div>`).join('');
}
function renderCategoryFilter(list){
  categoryFilter.innerHTML = '<option value="">All</option>' + list.map(c=>`<option value="${c}">${c}</option>`).join('');
}
window.renameCategory = async function(oldName){
  const nv = prompt('Rename category', oldName);
  if(!nv) return;
  // update category store and transactions
  await idbDelete(STORE_CATS, oldName);
  await idbPut(STORE_CATS, {name:nv});
  const all = await idbGetAll(STORE_TX);
  for(const tx of all){ if(tx.category===oldName){ tx.category = nv; await idbPut(STORE_TX, tx); } }
  renderAll();
};
window.removeCategory = async function(n){
  if(!confirm('Delete category? Transactions moved to Uncategorized')) return;
  await idbDelete(STORE_CATS, n);
  const all = await idbGetAll(STORE_TX);
  for(const tx of all){ if(tx.category===n){ tx.category='Uncategorized'; await idbPut(STORE_TX, tx); } }
  renderAll();
};
addCategoryBtn.addEventListener('click', async ()=>{
  const nv = newCategory.value.trim(); if(!nv) return;
  await idbPut(STORE_CATS, {name:nv});
  newCategory.value=''; renderAll();
});

// CSV export/import
exportCsvBtn.addEventListener('click', async ()=>{
  const all = await idbGetAll(STORE_TX);
  const lines = ['id,date,type,category,description,amount,recurrence'];
  all.forEach(d=>{
    lines.push([d.id,d.date,d.type,`"${(d.category||'').replace(/"/g,'""')}"`,`"${(d.description||'').replace(/"/g,'""')}"`,d.amount,d.recurrence||'none'].join(','));
  });
  const blob = new Blob([lines.join('\\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='budget-export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

importCsv.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0]; if(!f) return;
  const txt = await f.text();
  try{
    const lines = txt.trim().split(/\\r?\\n/).filter(Boolean);
    const hdr = lines.shift();
    for(const line of lines){
      // naive CSV parse
      const parts = line.split(',');
      const id = parts[0];
      const date = parts[1];
      const type = parts[2];
      const category = parts[3].replace(/^"|"$/g,'');
      const description = parts[4].replace(/^"|"$/g,'');
      const amount = parts[5];
      const recurrence = parts[6] || 'none';
      const tx = { id: id || uid(), date, type, category, description, amount, recurrence };
      await idbPut(STORE_TX, tx);
      await idbPut(STORE_CATS, {name:category});
    }
    alert('Import complete');
    renderAll();
  }catch(e){ alert('Import failed: '+e.message); }
  ev.target.value='';
});

// Backup: download a JSON backup (encrypted if meta.encrypted)
backupBtn.addEventListener('click', async ()=>{
  if(meta.encrypted){
    // provide encrypted blob from meta store
    const enc = await idbGet(STORE_META, 'enc');
    if(enc && enc.cipher){
      const payload = { meta: { encrypted:true, salt: meta.salt, iv: enc.iv }, cipher: enc.cipher };
      const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='budget-backup-encrypted.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      return;
    }
  } else {
    // create plain backup
    const all = await idbGetAll(STORE_TX);
    const cats = await idbGetAll(STORE_CATS);
    const payload = { transactions: all, categories: cats.map(c=>c.name), meta:{encrypted:false} };
    const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='budget-backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
});

// Security modal
securityBtn.addEventListener('click', ()=>{ secModal.style.display='flex'; showSecurity(); });
closeSec.addEventListener('click', ()=>{ secModal.style.display='none'; });

function showSecurity(){
  secContent.innerHTML = '';
  if(meta.encrypted){
    secContent.innerHTML = `
      <p class="note">Data currently stored <strong>encrypted</strong>.</p>
      <div><input id="unlockPw" type="password" placeholder="Enter encryption password to lock/unlock" /> <button id="unlockBtn">Unlock</button></div>
      <div style="margin-top:8px"><button id="disableEnc">Disable encryption (requires password)</button></div>
      <div class="note">If you forget the encryption password you will not be able to decrypt data. Backup first.</div>
    `;
    document.getElementById('unlockBtn').addEventListener('click', async ()=>{
      const p = document.getElementById('unlockPw').value;
      try{
        const saltBuf = b64ToBuf(meta.salt);
        masterKey = await deriveKeyFromPassword(p, saltBuf);
        const enc = await idbGet(STORE_META, 'enc');
        if(enc && enc.cipher){
          const plain = await decryptData(masterKey, enc.cipher, enc.iv);
          // restore plain into stores
          await idbClear(STORE_TX);
          for(const tx of plain.transactions || []) await idbPut(STORE_TX, tx);
          await idbClear(STORE_CATS);
          for(const c of (plain.categories || defaultCategories)) await idbPut(STORE_CATS, {name:c});
          alert('Decrypted into local storage (in-memory)');
          meta.encrypted = false;
          await idbPut(STORE_META, {k:'meta', val:meta});
          renderAll();
          secModal.style.display='none';
        }
      }catch(e){ alert('Decrypt failed'); console.error(e); }
    });
    document.getElementById('disableEnc').addEventListener('click', async ()=>{
      const p = prompt('Enter encryption password to disable:');
      if(!p) return;
      try{
        const saltBuf = b64ToBuf(meta.salt);
        const key = await deriveKeyFromPassword(p, saltBuf);
        const enc = await idbGet(STORE_META, 'enc');
        const plain = await decryptData(key, enc.cipher, enc.iv);
        // write plain to stores
        await idbClear(STORE_TX);
        for(const tx of plain.transactions||[]) await idbPut(STORE_TX, tx);
        await idbClear(STORE_CATS);
        for(const c of plain.categories||defaultCategories) await idbPut(STORE_CATS, {name:c});
        // remove enc blob
        await idbDelete(STORE_META, 'enc');
        meta.encrypted = false;
        await idbPut(STORE_META, {k:'meta', val:meta});
        alert('Encryption disabled. Data now stored unencrypted in IndexedDB.');
        secModal.style.display='none';
        renderAll();
      }catch(e){ alert('Failed to disable encryption'); console.error(e); }
    });
  } else {
    secContent.innerHTML = `
      <p class="note">Data currently stored <strong>unencrypted</strong> in this browser.</p>
      <div><input id="setEncPw" type="password" placeholder="Set encryption password" /> <button id="enableEnc">Enable encryption</button></div>
      <div style="margin-top:8px"><button id="clearEncBlob" class="btn-ghost">Clear encrypted blob (if exists)</button></div>
      <div class="note">When enabling encryption, all current data will be encrypted with your password. Keep a backup.</div>
    `;
    document.getElementById('enableEnc').addEventListener('click', async ()=>{
      const p = document.getElementById('setEncPw').value;
      if(!p) return alert('Enter password');
      // gather data
      const txs = await idbGetAll(STORE_TX);
      const cats = (await idbGetAll(STORE_CATS)).map(c=>c.name);
      const payload = { transactions: txs, categories: cats };
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKeyFromPassword(p, salt);
      const enc = await encryptData(key, payload);
      // store enc blob in meta store
      meta.encrypted = true;
      meta.salt = bufToB64(salt.buffer);
      await idbPut(STORE_META, {k:'enc', cipher: enc.cipher, iv: enc.iv});
      await idbPut(STORE_META, {k:'meta', val:meta});
      // optionally clear plain stores
      await idbClear(STORE_TX);
      await idbClear(STORE_CATS);
      // store default categories
      for(const c of defaultCategories) await idbPut(STORE_CATS, {name:c});
      alert('Encryption enabled. Plain data cleared from IndexedDB. Encrypted blob stored.');
      secModal.style.display='none';
      renderAll();
    });
    document.getElementById('clearEncBlob').addEventListener('click', async ()=>{
      if(confirm('Remove encrypted blob from storage?')){ await idbDelete(STORE_META, 'enc'); alert('Cleared'); showSecurity(); }
    });
  }
}

// PWA install hint
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; });
installBtn.addEventListener('click', ()=> {
  const isi = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if(isi){ alert('On iOS: use Safari -> Share -> Add to Home Screen'); return; }
  if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt.userChoice.then(choice=>{ if(choice.outcome==='accepted') alert('Installed'); deferredPrompt=null; }); }
});

// initial unlock hint: if encrypted meta exists, advise user to enter encryption pw
(async function initHint(){
  const m = await idbGet(STORE_META, 'meta');
  if(m) meta = m.val;
  if(meta.encrypted){ loginMsg.textContent = 'This device contains encrypted data. Enter encryption password.'; }
})();

