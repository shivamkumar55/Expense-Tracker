
const TX_KEY = 'ledger.transactions';
const BUDGET_KEY = 'ledger.budget';

const CATEGORY_META = {
  food:          { label:'Food',          icon:'🍔', color:'var(--cat-food)' },
  transport:     { label:'Transport',     icon:'🚕', color:'var(--cat-transport)' },
  bills:         { label:'Bills',         icon:'🧾', color:'var(--cat-bills)' },
  shopping:      { label:'Shopping',      icon:'🛍️', color:'var(--cat-shopping)' },
  entertainment: { label:'Entertainment', icon:'🎬', color:'var(--cat-entertainment)' },
  other:         { label:'Other',         icon:'📦', color:'var(--cat-other)' },
};

let transactions = loadTransactions();
let budget = loadBudget();
let activeType = 'expense';
let activeCategoryFilter = 'all';

const txForm = document.getElementById('txForm');
const txDesc = document.getElementById('txDesc');
const txAmount = document.getElementById('txAmount');
const txCategory = document.getElementById('txCategory');
const typeToggle = document.getElementById('typeToggle');

const txListEl = document.getElementById('txList');
const emptyStateEl = document.getElementById('emptyState');
const categoryFiltersEl = document.getElementById('categoryFilters');

const balanceValue = document.getElementById('balanceValue');
const balanceSub = document.getElementById('balanceSub');
const incomeValue = document.getElementById('incomeValue');
const incomeCount = document.getElementById('incomeCount');
const expenseValue = document.getElementById('expenseValue');
const expenseCount = document.getElementById('expenseCount');

const budgetInput = document.getElementById('budgetInput');
const budgetBarFill = document.getElementById('budgetBarFill');
const budgetSub = document.getElementById('budgetSub');

const donutChart = document.getElementById('donutChart');
const donutTotal = document.getElementById('donutTotal');
const legendList = document.getElementById('legendList');

const monthLabel = document.getElementById('monthLabel');
const toastEl = document.getElementById('toast');

function loadTransactions(){
  try{
    const raw = localStorage.getItem(TX_KEY);
    return raw ? JSON.parse(raw) : seedTransactions();
  }catch(e){
    console.error('Could not read saved transactions', e);
    return [];
  }
}
function saveTransactions(){
  try{ localStorage.setItem(TX_KEY, JSON.stringify(transactions)); }
  catch(e){ console.error('Could not save transactions', e); showToast("Couldn't save — storage might be full"); }
}
function loadBudget(){
  const raw = localStorage.getItem(BUDGET_KEY);
  return raw ? Number(raw) : 0;
}
function saveBudget(){ localStorage.setItem(BUDGET_KEY, String(budget)); }

function seedTransactions(){
  const now = Date.now();
  return [
    { id: cryptoId(), desc:'Monthly salary', amount:45000, category:'other', type:'income', createdAt: now - 86400000*3 },
    { id: cryptoId(), desc:'Groceries', amount:1200, category:'food', type:'expense', createdAt: now - 86400000*2 },
    { id: cryptoId(), desc:'Cab to office', amount:180, category:'transport', type:'expense', createdAt: now - 86400000 },
    { id: cryptoId(), desc:'Electricity bill', amount:950, category:'bills', type:'expense', createdAt: now },
  ];
}
function cryptoId(){
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

const currency = new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 });
function formatMoney(n){ return currency.format(n); }

function render(){
  renderList();
  renderSummary();
  renderDonut();
}

function getFilteredTransactions(){
  return transactions.filter(t => activeCategoryFilter === 'all' || t.category === activeCategoryFilter);
}

function renderList(){
  const filtered = getFilteredTransactions().slice().sort((a,b) => b.createdAt - a.createdAt);
  txListEl.innerHTML = '';

  if(filtered.length === 0){
    emptyStateEl.classList.add('show');
  }else{
    emptyStateEl.classList.remove('show');
    filtered.forEach(t => txListEl.appendChild(buildTxEl(t)));
  }
}

function buildTxEl(t){
  const meta = CATEGORY_META[t.category] || CATEGORY_META.other;
  const li = document.createElement('li');
  li.className = 'tx';
  li.dataset.id = t.id;

  const sign = t.type === 'income' ? '+' : '−';

  li.innerHTML = `
    <div class="tx-icon" style="background:color-mix(in srgb, ${meta.color} 22%, transparent);">${meta.icon}</div>
    <div class="tx-body">
      <p class="tx-desc"></p>
      <p class="tx-meta">${meta.label} · ${formatDate(t.createdAt)}</p>
    </div>
    <span class="tx-amount ${t.type}">${sign} ${formatMoney(t.amount)}</span>
    <button class="tx-del" aria-label="Delete transaction">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  `;
  li.querySelector('.tx-desc').textContent = t.desc;
  li.querySelector('.tx-del').addEventListener('click', () => deleteTx(t.id));
  return li;
}

function formatDate(ts){
  const d = new Date(ts);
  const today = new Date();
  if(d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}

function renderSummary(){
  const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;

  balanceValue.textContent = formatMoney(balance);
  balanceValue.style.color = balance < 0 ? 'var(--expense)' : '';
  incomeValue.textContent = formatMoney(income);
  expenseValue.textContent = formatMoney(expense);
  incomeCount.textContent = `${transactions.filter(t => t.type === 'income').length} entries`;
  expenseCount.textContent = `${transactions.filter(t => t.type === 'expense').length} entries`;

  // budget bar
  if(budget > 0){
    const pct = Math.min(100, Math.round((expense / budget) * 100));
    budgetBarFill.style.width = pct + '%';
    budgetBarFill.classList.toggle('over', expense > budget);
    budgetSub.textContent = expense > budget
      ? `Over budget by ${formatMoney(expense - budget)}`
      : `${formatMoney(budget - expense)} left this month`;
  }else{
    budgetBarFill.style.width = '0%';
    budgetBarFill.classList.remove('over');
    budgetSub.textContent = 'no budget set';
  }
}

function renderDonut(){
  const expenses = transactions.filter(t => t.type === 'expense');
  const totals = {};
  let grandTotal = 0;

  expenses.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    grandTotal += t.amount;
  });

  donutTotal.textContent = formatMoney(grandTotal);

  if(grandTotal === 0){
    donutChart.style.background = 'var(--surface-2)';
    legendList.innerHTML = '<li class="legend-empty">No expenses logged yet</li>';
    return;
  }

  // build conic-gradient stops
  let cursor = 0;
  const stops = [];
  Object.entries(totals)
    .sort((a,b) => b[1] - a[1])
    .forEach(([cat, amount]) => {
      const meta = CATEGORY_META[cat] || CATEGORY_META.other;
      const slice = (amount / grandTotal) * 360;
      stops.push(`${meta.color} ${cursor}deg ${cursor + slice}deg`);
      cursor += slice;
    });

  donutChart.style.background = `conic-gradient(${stops.join(', ')})`;

  // legend
  legendList.innerHTML = '';
  Object.entries(totals)
    .sort((a,b) => b[1] - a[1])
    .forEach(([cat, amount]) => {
      const meta = CATEGORY_META[cat] || CATEGORY_META.other;
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="dot" style="background:${meta.color}"></span>
        <span class="legend-name">${meta.label}</span>
        <span class="legend-value">${formatMoney(amount)}</span>
      `;
      legendList.appendChild(li);
    });
}

function addTransaction(e){
  e.preventDefault();

  const desc = txDesc.value.trim();
  const amount = parseFloat(txAmount.value);

  if(!desc || !amount || amount <= 0){
    showToast('Add a description and a valid amount');
    return;
  }

  transactions.push({
    id: cryptoId(),
    desc,
    amount,
    category: txCategory.value,
    type: activeType,
    createdAt: Date.now()
  });

  saveTransactions();
  render();

  txDesc.value = '';
  txAmount.value = '';
  txDesc.focus();

  showToast(activeType === 'income' ? 'Income added' : 'Expense logged');
}

function deleteTx(id){
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
  showToast('Transaction removed');
}

let toastTimer = null;
function showToast(message){
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

txForm.addEventListener('submit', addTransaction);

typeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.type-btn');
  if(!btn) return;
  typeToggle.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeType = btn.dataset.type;
});

categoryFiltersEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if(!chip) return;
  categoryFiltersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeCategoryFilter = chip.dataset.cat;
  renderList();
});

budgetInput.addEventListener('input', () => {
  budget = Number(budgetInput.value) || 0;
  saveBudget();
  renderSummary();
});

function initMonthLabel(){
  monthLabel.textContent = new Date().toLocaleDateString(undefined, { month:'long', year:'numeric' });
}

if(budget > 0) budgetInput.value = budget;
initMonthLabel();
render();