// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.dataset.tab;
        tabContents.forEach(tc => {
            tc.classList.toggle('active', tc.id === target);
        });
    });
});

// Transactions
const transactionForm = document.getElementById('transaction-form');
const transactionTableBody = document.querySelector('#transaction-table tbody');

transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('date').value;
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value).toFixed(2);

    const txClass = document.getElementById('transaction-class').value;
    const [type, recurrence] = txClass.split('-'); // e.g., ["income", "monthly"]

    const row = document.createElement('tr');
    row.dataset.recurrence = recurrence;
    row.innerHTML = `
        <td>${date}</td>
        <td>${description}</td>
        <td>${type}</td>
        <td>${amount}</td>
        <td>${recurrence}</td>
    `;
    transactionTableBody.appendChild(row);
    transactionForm.reset();
});

// Categories
const categoryForm = document.getElementById('category-form');
const categoryList = document.getElementById('category-list');

categoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('category-name').value;
    const li = document.createElement('li');
    li.textContent = name;
    categoryList.appendChild(li);
    categoryForm.reset();
});

// Forecast
document.getElementById('generate-forecast').addEventListener('click', () => {
    const startDateInput = document.getElementById('projection-start').value;
    const openingBalance = parseFloat(document.getElementById('opening-balance').value) || 0;

    if (!startDateInput) {
        alert('Please select a projection start date.');
        return;
    }

    const startDate = new Date(startDateInput);
    const forecast = [];

    // Collect transactions
    const transactions = [];
    document.querySelectorAll('#transaction-table tbody tr').forEach(row => {
        const [date, desc, type, amount] = Array.from(row.children).slice(0,4).map(td => td.textContent);
        const recurrence = row.dataset.recurrence || 'irregular';
        transactions.push({ date: new Date(date), desc, type, amount: parseFloat(amount), recurrence });
    });

    // Generate forecast for 24 months
    let balance = openingBalance;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 24);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        transactions.forEach(tx => {
            let addTx = false;
            if (tx.recurrence === 'monthly' && d.getDate() === tx.date.getDate()) addTx = true;
            else if (tx.recurrence === 'four-weekly') {
                const diffDays = Math.floor((d - tx.date)/(1000*60*60*24));
                if (diffDays >= 0 && diffDays % 28 === 0) addTx = true;
            } else if (tx.recurrence === 'irregular' && d.toDateString() === tx.date.toDateString()) addTx = true;

            if (addTx) {
                balance += tx.type === 'income' ? tx.amount : -tx.amount;
                forecast.push({
                    date: d.toISOString().split('T')[0],
                    desc: tx.desc,
                    type: tx.type,
                    amount: tx.amount,
                    balance: balance.toFixed(2)
                });
            }
        });
    }

    // Render forecast
    let table = '<table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Balance</th></tr></thead><tbody>';
    forecast.forEach(fx => {
        table += `<tr><td>${fx.date}</td><td>${fx.desc}</td><td>${fx.type}</td><td>${fx.amount}</td><td>${fx.balance}</td></tr>`;
    });
    table += '</tbody></table>';

    let forecastSection = document.getElementById('forecast-section');
    if (!forecastSection) {
        forecastSection = document.createElement('div');
        forecastSection.id = 'forecast-section';
        document.querySelector('main').appendChild(forecastSection);
    }
    forecastSection.innerHTML = '<h2>24-Month Forecast</h2>' + table;
});
