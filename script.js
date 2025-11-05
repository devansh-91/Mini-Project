/* script.js
   Smart Expense & Budget Tracker - Vanilla JS
   - modular functions
   - localStorage keys: se_tracker_budget, se_tracker_expenses
   - sample data loaded if nothing present
*/

/* ========== Constants & Helpers ========== */
const LS_BUDGET_KEY = 'se_tracker_budget';
const LS_EXPENSES_KEY = 'se_tracker_expenses';

// DOM elements
const budgetInput = document.getElementById('budget');
const saveBudgetBtn = document.getElementById('saveBudgetBtn');
const totalBudgetDisplay = document.getElementById('totalBudgetDisplay');
const totalSpentDisplay = document.getElementById('totalSpentDisplay');
const remainingDisplay = document.getElementById('remainingDisplay');
const percentUsedDisplay = document.getElementById('percentUsedDisplay');
const progressFill = document.getElementById('progressFill');
const progressAmountLabel = document.getElementById('progressAmountLabel');
const insightBox = document.getElementById('insightBox');

const expenseForm = document.getElementById('expenseForm');
const expenseName = document.getElementById('expenseName');
const expenseCategory = document.getElementById('expenseCategory');
const expenseAmount = document.getElementById('expenseAmount');
const expenseDate = document.getElementById('expenseDate');
const expensesTBody = document.getElementById('expensesTBody');

const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const categoryChart = document.getElementById('categoryChart');
const chartLegend = document.getElementById('chartLegend');

const editOverlay = document.getElementById('editOverlay');
const editForm = document.getElementById('editForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editId = document.getElementById('editId');
const editName = document.getElementById('editName');
const editCategory = document.getElementById('editCategory');
const editAmount = document.getElementById('editAmount');
const editDate = document.getElementById('editDate');

const themeToggle = document.getElementById('themeToggle');

// State
let budget = 0;
let expenses = []; // array of {id, name, category, amount, date}

// ========== Utility functions ==========

/** format currency */
function fmt(amount) {
  // using Indian Rupee symbol as example; change if needed
  return '₹' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** generate unique id */
function uid() {
  return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}

/** read from localStorage */
function loadState() {
  const b = localStorage.getItem(LS_BUDGET_KEY);
  const e = localStorage.getItem(LS_EXPENSES_KEY);

  if (b !== null) budget = parseFloat(b) || 0;
  if (e !== null) expenses = JSON.parse(e);
}

/** write to localStorage */
function saveState() {
  localStorage.setItem(LS_BUDGET_KEY, String(budget));
  localStorage.setItem(LS_EXPENSES_KEY, JSON.stringify(expenses));
}

/* ========== Sample data (loaded on first run) ========== */
function seedSampleDataIfEmpty() {
  const e = localStorage.getItem(LS_EXPENSES_KEY);
  const b = localStorage.getItem(LS_BUDGET_KEY);

  if (!e && !b) {
    budget = 30000;
    expenses = [
      { id: uid(), name: 'Breakfast', category: 'Food', amount: 120, date: getISODateOffset(-3) },
      { id: uid(), name: 'Metro', category: 'Transport', amount: 40, date: getISODateOffset(-2) },
      { id: uid(), name: 'Groceries', category: 'Shopping', amount: 800, date: getISODateOffset(-7) },
      { id: uid(), name: 'Electricity Bill', category: 'Bills', amount: 1400, date: getISODateOffset(-10) },
      { id: uid(), name: 'Movie', category: 'Entertainment', amount: 350, date: getISODateOffset(-1) },
    ];
    saveState();
  }
}

/* helper to get ISO date string today +/- days */
function getISODateOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

/* ========== Rendering Functions ========== */

/** render budget & stats */
function renderBudgetSummary() {
  const totalSpent = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const remaining = Math.max(0, budget - totalSpent);
  const percentUsed = budget === 0 ? 0 : Math.round((totalSpent / budget) * 100);

  totalBudgetDisplay.textContent = fmt(budget);
  totalSpentDisplay.textContent = fmt(totalSpent);
  remainingDisplay.textContent = fmt(remaining);
  percentUsedDisplay.textContent = percentUsed + '%';
  progressAmountLabel.textContent = `${fmt(totalSpent)} / ${fmt(budget)}`;

  // progress fill
  const fillPct = budget === 0 ? 0 : Math.min(100, (totalSpent / budget) * 100);
  progressFill.style.width = fillPct + '%';
  progressFill.classList.remove('warning','danger');

  if (fillPct >= 100) {
    progressFill.classList.add('danger');
  } else if (fillPct >= 80) {
    progressFill.classList.add('warning');
  }
}

/** render expense list according to filters */
function renderExpensesList() {
  const q = searchInput.value.trim().toLowerCase();
  const cat = filterCategory.value;

  // filter and sort by date desc
  const filtered = expenses
    .filter(e => {
      const matchesQ = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      const matchesCat = cat === 'all' || e.category === cat;
      return matchesQ && matchesCat;
    })
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  expensesTBody.innerHTML = '';
  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="color:var(--muted); padding:14px;">No expenses yet</td>`;
    expensesTBody.appendChild(tr);
    return;
  }

  for (const ex of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(ex.name)}</td>
      <td>${escapeHtml(ex.category)}</td>
      <td>${fmt(ex.amount)}</td>
      <td>${ex.date}</td>
      <td class="actions-col">
        <div class="row-actions">
          <button class="small-btn btn" data-action="edit" data-id="${ex.id}">Edit</button>
          <button class="small-btn btn dangerous" data-action="delete" data-id="${ex.id}">Delete</button>
        </div>
      </td>
    `;
    expensesTBody.appendChild(tr);
  }
}

/** escape html to avoid accidental injection (basic) */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/** draw a simple pie chart on canvas for category breakdown */
function drawCategoryChart() {
  const ctx = categoryChart.getContext('2d');
  const width = categoryChart.width;
  const height = categoryChart.height;
  ctx.clearRect(0,0,width,height);

  if (expenses.length === 0) {
    // draw "no data"
    ctx.fillStyle = 'var(--muted)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', width/2, height/2);
    chartLegend.innerHTML = '';
    return;
  }

  // compute category totals
  const totals = {};
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
  }

  const categories = Object.keys(totals);
  const values = categories.map(c => totals[c]);
  const sum = values.reduce((a,b) => a+b, 0);

  // palette (deterministic)
  const palette = [
    '#60a5fa','#34d399','#f97316','#f43f5e','#a78bfa','#f59e0b','#94a3b8'
  ];

  // draw pie
  let start = -Math.PI/2;
  const cx = width/2;
  const cy = height/2;
  const radius = Math.min(width, height) * 0.35;

  chartLegend.innerHTML = '';

  categories.forEach((cat, i) => {
    const value = totals[cat];
    const angle = (value / sum) * Math.PI * 2;
    const color = palette[i % palette.length];

    // arc
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = color;
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fill();

    // legend
    const li = document.createElement('li');
    li.innerHTML = `<span class="legend-color" style="background:${color}"></span> ${escapeHtml(cat)} — ${fmt(value)} (${Math.round((value/sum)*100)}%)`;
    chartLegend.appendChild(li);

    start += angle;
  });

  // border circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.stroke();
}

/* ========== Business Logic ========== */

/** calculate insights and show AI-like tip */
function renderInsights() {
  if (expenses.length === 0) {
    // insightBox.textContent = 'No spending yet — add an expense to see insights.';
    return;
  }

  // compute totals by category for last 7 days and month
  const totals = {};
  let recentTotal = 0;
  const now = new Date();
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] || 0) + Number(e.amount);

    const ed = new Date(e.date + 'T00:00:00');
    const diffDays = Math.floor((now - ed) / (1000*60*60*24));
    if (diffDays <= 7) recentTotal += Number(e.amount);
  }

  // find largest category
  const categoryEntries = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  const [topCategory, topValue] = categoryEntries[0];

  const totalSpent = expenses.reduce((s, x) => s + Number(x.amount), 0);

  // sample heuristics for tips
  let tip = '';
  const pctTop = Math.round((topValue / totalSpent) * 100);

//   if (pctTop >= 50) {
//     tip = `You're spending ${pctTop}% of your total on ${topCategory}. Consider setting a small weekly cap for that category.`;
//   } else if (recentTotal > (budget * 0.3)) {
//     tip = `You've spent ${fmt(recentTotal)} in the last 7 days. Keep an eye — that's more than 30% of your monthly budget so far.`;
//   } else if (Object.keys(totals).length <= 2 && totalSpent > budget*0.6) {
//     tip = `Most of your spending is concentrated in only a couple of categories. Diversify spending or cut down where possible.`;
//   } else {
//     tip = `Spending looks balanced. Top category is ${topCategory} (${pctTop}%).`;
//   }

  insightBox.textContent = tip;
}

/* ========== CRUD Operations ========== */

/** Add a new expense from form */
function handleAddExpense(evt) {
  evt.preventDefault();
  const name = expenseName.value.trim();
  const cat = expenseCategory.value;
  const amt = parseFloat(expenseAmount.value);
  const date = expenseDate.value;

  if (!name || !cat || !date || !amt || amt <= 0) {
    alert('Please provide valid expense details.');
    return;
  }

  const newEx = { id: uid(), name, category: cat, amount: amt, date };
  expenses.push(newEx);
  saveState();

  // reset form & re-render
  expenseForm.reset();
  expenseDate.value = getISODateOffset(0);
  refreshAll();
}

/** set budget */
function handleSaveBudget() {
  const val = parseFloat(budgetInput.value);
  if (isNaN(val) || val < 0) {
    alert('Enter a valid budget amount.');
    return;
  }
  budget = val;
  saveState();
  refreshAll();
}

/** delete an expense by id */
function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  expenses = expenses.filter(e => e.id !== id);
  saveState();
  refreshAll();
}

/** edit: open modal filled */
function openEditModal(id) {
  const ex = expenses.find(x => x.id === id);
  if (!ex) return;
  editId.value = ex.id;
  editName.value = ex.name;
  editCategory.value = ex.category;
  editAmount.value = ex.amount;
  editDate.value = ex.date;
  editOverlay.classList.remove('hidden');
  editOverlay.setAttribute('aria-hidden','false');
}

/** save edit */
function handleSaveEdit(evt) {
  evt.preventDefault();
  const id = editId.value;
  const idx = expenses.findIndex(e => e.id === id);
  if (idx === -1) return;

  const name = editName.value.trim();
  const cat = editCategory.value;
  const amt = parseFloat(editAmount.value);
  const date = editDate.value;

  if (!name || !cat || !date || !amt || amt <= 0) {
    alert('Please fill valid values.');
    return;
  }

  expenses[idx].name = name;
  expenses[idx].category = cat;
  expenses[idx].amount = amt;
  expenses[idx].date = date;
  saveState();
  closeEditModal();
  refreshAll();
}

function closeEditModal() {
  editOverlay.classList.add('hidden');
  editOverlay.setAttribute('aria-hidden','true');
}

/* ========== Export / Clear ========== */

/** export current expenses to CSV */
function exportToCSV() {
  if (!expenses.length) { alert('No expenses to export.'); return; }
  const rows = [
    ['id','name','category','amount','date'],
    ...expenses.map(e => [e.id, e.name, e.category, e.amount, e.date])
  ];
  const csv = rows.map(r => r.map(val => `"${String(val).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** clear all data */
function handleClearAll() {
  if (!confirm('Clear all expenses and budget? This cannot be undone.')) return;
  budget = 0;
  expenses = [];
  saveState();
  refreshAll();
}

/* ========== Initialization & Event Wiring ========== */

function refreshAll() {
  // Update UI elements from state
  budgetInput.value = budget || '';
  renderBudgetSummary();
  renderExpensesList();
  drawCategoryChart();
  renderInsights();
}

/* event delegation for edit/delete buttons in table */
expensesTBody.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'delete') deleteExpense(id);
  if (action === 'edit') openEditModal(id);
});

// form handlers
expenseForm.addEventListener('submit', handleAddExpense);
document.getElementById('resetFormBtn').addEventListener('click', () => expenseForm.reset());

// budget
saveBudgetBtn.addEventListener('click', handleSaveBudget);

// search/filter
searchInput.addEventListener('input', renderExpensesList);
filterCategory.addEventListener('change', renderExpensesList);

// export/clear
exportCsvBtn.addEventListener('click', exportToCSV);
clearAllBtn.addEventListener('click', handleClearAll);

// edit form
cancelEditBtn.addEventListener('click', closeEditModal);
editForm.addEventListener('submit', handleSaveEdit);

// modal overlay click to close
editOverlay.addEventListener('click', (e) => {
  if (e.target === editOverlay) closeEditModal();
});

// theme toggle
themeToggle.addEventListener('change', (e) => {
  if (e.target.checked) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
});

// set default date fields to today
function setDefaultDates() {
  const today = getISODateOffset(0);
  expenseDate.value = today;
}

// basic HTML-escape used above - defined again for scope
function escapeHtml(text) {
  return String(text)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/* ========== Init ========== */
(function init() {
  loadState();
  seedSampleDataIfEmpty(); // loads sample if empty
  loadState(); // re-load after seeding
  setDefaultDates();
  refreshAll();

  // wire global shortcuts (optional)
  window.addEventListener('keydown', (e) => {
    // Esc closes edit modal
    if (e.key === 'Escape') closeEditModal();
  });
});
