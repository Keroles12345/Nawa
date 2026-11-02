const state = {
  accessToken: sessionStorage.getItem('accessToken'),
  refreshToken: sessionStorage.getItem('refreshToken'),
  user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  page: 'overview',
  products: [],
  categories: [],
  orders: [],
  users: [],
  cart: new Map(),
  search: '',
  categoryFilter: 'all',
  customerSearch: '',
  teamSearch: '',
};

function isAdmin() {
  return state.user?.role === 'ADMIN';
}

function isManager() {
  return state.user?.role === 'ADMIN' || state.user?.role === 'STAFF';
}

const pageNames = {
  overview: 'Overview',
  products: 'Products',
  categories: 'Categories',
  orders: 'Orders',
  customers: 'Customers',
  users: 'Users',
};
const pageContent = document.querySelector('#page-content');
const authScreen = document.querySelector('#auth-screen');
const appShell = document.querySelector('#app-shell');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const entityDialog = document.querySelector('#entity-dialog');
const orderStatuses = [
  ['PENDING', 'Pending'],
  ['PROCESSING', 'Processing'],
  ['SHIPPED', 'Shipped'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
];

document.querySelector('#current-year').textContent = String(new Date().getFullYear());

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast${type === 'error' ? ' error' : ''}`;
  item.textContent = message;
  document.querySelector('#toast-region').append(item);
  window.setTimeout(() => item.remove(), 4000);
}

function setSession(data) {
  state.accessToken = data.accessToken;
  state.refreshToken = data.refreshToken;
  state.user = data.user;
  sessionStorage.setItem('accessToken', data.accessToken);
  sessionStorage.setItem('refreshToken', data.refreshToken);
  sessionStorage.setItem('user', JSON.stringify(data.user));
}

function clearSession() {
  state.accessToken = null;
  state.refreshToken = null;
  state.user = null;
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
}

async function refreshSession() {
  if (!state.refreshToken) return false;
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: state.refreshToken }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    clearSession();
    return false;
  }
  state.accessToken = result.data.accessToken;
  state.refreshToken = result.data.refreshToken;
  sessionStorage.setItem('accessToken', state.accessToken);
  sessionStorage.setItem('refreshToken', state.refreshToken);
  return true;
}

async function api(path, options = {}, canRefresh = true) {
  const headers = new Headers(options.headers || {});
  if (state.accessToken) headers.set('Authorization', `Bearer ${state.accessToken}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && canRefresh && !path.includes('/api/auth/')) {
    if (await refreshSession()) return api(path, options, false);
    showAuth();
    throw new Error('Your session expired. Please sign in again.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'The request could not be completed. Please try again.');
  }
  return result;
}

function showAuth(mode = 'login') {
  authScreen.hidden = false;
  appShell.hidden = true;
  loginForm.hidden = mode !== 'login';
  registerForm.hidden = mode !== 'register';
  document.querySelector('#auth-title').textContent = mode === 'login' ? 'Welcome back' : 'Create your account';
  document.querySelector('#auth-subtitle').textContent = mode === 'login'
    ? 'Sign in to manage your store from one place.'
    : 'Get started with your store in just a few steps.';
  document.querySelector('#auth-switch').innerHTML = mode === 'login'
    ? 'Don’t have an account? <button type="button" class="text-button" data-action="show-register">Create one</button>'
    : 'Already have an account? <button type="button" class="text-button" data-action="show-login">Sign in</button>';
}

function showApp() {
  authScreen.hidden = true;
  appShell.hidden = false;
  document.querySelectorAll('.admin-only').forEach((item) => { item.hidden = !isAdmin(); });
  document.querySelectorAll('.staff-admin-only').forEach((item) => { item.hidden = !isManager(); });
  document.querySelector('#profile-name').textContent = state.user?.name || 'User';
  document.querySelector('#profile-avatar').textContent = (state.user?.name || 'N').trim().slice(0, 1);
  document.querySelector('#profile-role').textContent = isAdmin() ? 'Store admin' : state.user?.role === 'STAFF' ? 'Staff' : 'Customer';
  if (!isManager() && ['categories', 'customers', 'users'].includes(state.page)) state.page = 'overview';
}

async function signIn(form, mode) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(form).entries());
    const result = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) }, false);
    setSession(result.data);
    form.reset();
    state.page = 'overview';
    showApp();
    await loadPage();
    toast(mode === 'register' ? 'Your account was created.' : 'Welcome back.');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

async function logout() {
  const refreshToken = state.refreshToken;
  clearSession();
  try {
    if (refreshToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    toast('You signed out on this device, but the server could not revoke the session.', 'error');
  } finally {
    showAuth();
  }
}

async function loadData() {
  const canManageOrders = isManager();
  const requests = [
    api('/api/products'),
    api('/api/categories'),
    api(canManageOrders ? '/api/orders' : '/api/orders/mine'),
    canManageOrders ? api('/api/users') : Promise.resolve({ data: [] }),
  ];
  const [products, categories, orders, users] = await Promise.all(requests);
  state.products = products.data || [];
  state.categories = categories.data || [];
  state.orders = orders.data || [];
  state.users = users.data || [];
  document.querySelector('#product-nav-count').textContent = String(state.products.length);
  document.querySelector('#order-nav-count').textContent = String(state.orders.length);
}

async function loadPage() {
  showApp();
  pageContent.innerHTML = '<div class="loading">Loading store data…</div>';
  try {
    await loadData();
    renderPage();
  } catch (error) {
    pageContent.innerHTML = `<div class="panel empty-state"><span>!</span><b>Could not load data</b><p>${escapeHtml(error.message)}</p><button class="button button-secondary" data-action="reload-page">Try again</button></div>`;
  }
}

function heading(title, description, action = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}

function emptyState(icon, title, description) {
  return `<div class="empty-state"><span>${icon}</span><b>${title}</b><p>${description}</p></div>`;
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function orderById(id) {
  return state.orders.find((order) => order.id === id);
}

function categoryName(id) {
  return state.categories.find((category) => category.id === id)?.name || 'Uncategorized';
}

function statusLabel(status) {
  const names = Object.fromEntries(orderStatuses);
  return names[status] || status || '—';
}

function statusClass(status) {
  return `status-${String(status || '').toLowerCase()}`;
}

function productRows(products, actions = false) {
  if (!products.length) return `<tr><td colspan="${actions ? 5 : 4}">${emptyState('▦', 'No products yet', 'Add your first product to see it here.')}</td></tr>`;
  return products.map((product) => `<tr>
    <td><div class="product-cell"><span class="product-thumb">▦</span><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description)}</small></div></div></td>
    <td>${escapeHtml(categoryName(product.categoryId))}</td>
    <td><strong>${formatCurrency(product.price)}</strong></td>
    <td>${Number(product.inventory) || 0}</td>
    ${actions ? `<td><div class="table-actions"><button class="icon-button" type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}" aria-label="Edit">✎</button><button class="icon-button" type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}" aria-label="Delete">⌫</button></div></td>` : ''}
  </tr>`).join('');
}

function orderActions(order) {
  return `<div class="table-actions"><button class="icon-button" type="button" data-action="edit-order" data-id="${escapeHtml(order.id)}" aria-label="Edit order">✎</button><button class="icon-button danger-icon" type="button" data-action="delete-order" data-id="${escapeHtml(order.id)}" aria-label="Delete order">⌫</button></div>`;
}

function orderRows(orders, limit = Infinity) {
  const canManageOrders = isManager();
  if (!orders.length) return `<tr><td colspan="${canManageOrders ? 6 : 4}">${emptyState('▤', 'No orders yet', 'New orders will appear here.')}</td></tr>`;
  return orders.slice(0, limit).map((order) => {
    const customer = state.users.find((user) => user.id === order.userId);
    return `<tr>
      <td><strong>#${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</strong></td>
      ${canManageOrders ? `<td>${escapeHtml(customer?.name || 'Customer')}</td>` : ''}
      <td>${formatDate(order.createdAt)}</td>
      <td><strong>${formatCurrency(order.total)}</strong></td>
      <td><span class="status-pill ${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td>
      ${canManageOrders ? `<td>${orderActions(order)}</td>` : ''}
    </tr>`;
  }).join('');
}

function statsMarkup() {
  const totalRevenue = state.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lowStock = state.products.filter((product) => Number(product.inventory) < 10).length;
  const customerCount = state.users.filter((user) => user.role === 'CUSTOMER').length;
  const stats = [
    ['Total sales', formatCurrency(totalRevenue), 'Across all recorded orders', '↗'],
    ['Orders', state.orders.length, 'Total orders', '▤'],
    ['Products', state.products.length, `${lowStock} low-stock products`, '▦'],
    ['Customers', customerCount, 'Registered accounts', '♙'],
  ];
  return `<div class="stat-grid">${stats.map(([label, value, note, icon]) => `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong class="stat-value">${value}</strong><div class="stat-foot">${note}</div></div>`).join('')}</div>`;
}

function overviewPage() {
  const admin = isAdmin();
  const manager = isManager();
  const banner = manager
    ? ''
    : `<div class="welcome-banner"><div><h2>Welcome, ${escapeHtml(state.user?.name || '')}!</h2><p>Browse our products and keep track of your orders.</p></div><span class="welcome-badge">Your account is ready</span></div>`;
  const stats = manager
    ? statsMarkup()
    : `<div class="stat-grid"><div class="stat-card"><div class="stat-top"><span>My orders</span><span class="stat-icon">▤</span></div><strong class="stat-value">${state.orders.length}</strong><div class="stat-foot">Orders placed from your account</div></div><div class="stat-card"><div class="stat-top"><span>Available products</span><span class="stat-icon">▦</span></div><strong class="stat-value">${state.products.length}</strong><div class="stat-foot">Browse the full catalog</div></div></div>`;
  const title = admin ? 'Overview' : manager ? 'Staff overview' : 'Your dashboard';
  const description = manager ? 'Here is a quick summary of your store today.' : 'Everything you need to shop and track your orders.';
  return `${heading(title, description, `<button class="button button-primary" ${manager ? 'data-action="new-order"' : 'data-action="navigate" data-view="products"'}><span class="button-icon">＋</span>${manager ? 'Create order' : 'Browse products'}</button>`)}
    ${banner}${stats}
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><h2>${manager ? 'Recent orders' : 'My recent orders'}</h2><p>${manager ? 'Track the latest orders placed in your store.' : 'Your latest orders.'}</p></div><button class="panel-link" data-action="navigate" data-view="orders">View all →</button></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th>${manager ? '<th>Customer</th>' : ''}<th>Date</th><th>Total</th><th>Status</th>${manager ? '<th>Actions</th>' : ''}</tr></thead><tbody>${orderRows(state.orders, 5)}</tbody></table></div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Quick links</h2><p>Jump to what you need.</p></div></div><div class="quick-actions">
        ${admin ? `<button class="quick-action" data-action="navigate" data-view="products"><span>＋</span><span><b>Add a product</b><small>Add a new item to your store</small></span></button><button class="quick-action" data-action="navigate" data-view="categories"><span>◇</span><span><b>Manage categories</b><small>Organize your products</small></span></button>` : `<button class="quick-action" data-action="navigate" data-view="products"><span>▦</span><span><b>Browse products</b><small>Discover available products</small></span></button>`}
        ${manager ? `<button class="quick-action" data-action="navigate" data-view="customers"><span>♙</span><span><b>View customers</b><small>Manage customer accounts</small></span></button><button class="quick-action" data-action="navigate" data-view="users"><span>♟</span><span><b>Manage users</b><small>Create Admin and Staff accounts</small></span></button>` : `<button class="quick-action" data-action="navigate" data-view="orders"><span>▤</span><span><b>Track orders</b><small>Review your order history</small></span></button>`}
      </div></section>
    </div>`;
}

function productsPage() {
  const admin = state.user?.role === 'ADMIN';
  if (admin) {
    return `${heading('Products', `You have ${state.products.length} products in your store.`, `<button class="button button-primary" data-action="new-product"><span class="button-icon">＋</span>Add product</button>`)}
      <div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="product-search" type="search" placeholder="Search products…" value="${escapeHtml(state.search)}"></label><select class="filter-select" id="category-filter"><option value="all">All categories</option>${state.categories.map((category) => `<option value="${escapeHtml(category.id)}" ${state.categoryFilter === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select></div>
      <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody id="products-body">${productRows(filteredProducts(), true)}</tbody></table></div></section>`;
  }
  if (isManager()) {
    return `${heading('Products', 'Browse the product catalog. Product management is available to Admins.', '')}
      <div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="product-search" type="search" placeholder="Search products…" value="${escapeHtml(state.search)}"></label><select class="filter-select" id="category-filter"><option value="all">All categories</option>${state.categories.map((category) => `<option value="${escapeHtml(category.id)}" ${state.categoryFilter === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select></div>
      <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr></thead><tbody id="products-body">${productRows(filteredProducts())}</tbody></table></div></section>`;
  }
  const products = filteredProducts();
  const cartTotal = [...state.cart.entries()].reduce((sum, [id, quantity]) => sum + (Number(productById(id)?.price) || 0) * quantity, 0);
  const cartCount = [...state.cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  return `${heading('Browse products', 'Choose what you like and add it to your cart.', '')}
    <div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="product-search" type="search" placeholder="Search products…" value="${escapeHtml(state.search)}"></label><select class="filter-select" id="category-filter"><option value="all">All categories</option>${state.categories.map((category) => `<option value="${escapeHtml(category.id)}" ${state.categoryFilter === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select></div>
    <div class="product-grid">${products.length ? products.map((product) => `<article class="shop-card"><div class="shop-card-art">▦</div><div class="shop-card-body"><span class="shop-card-category">${escapeHtml(categoryName(product.categoryId))}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p><div class="shop-card-bottom"><div><div class="shop-price">${formatCurrency(product.price)}</div><span class="shop-stock">${Number(product.inventory) > 0 ? `${Number(product.inventory)} in stock` : 'Out of stock'}</span></div><button class="button button-primary button-small" data-action="add-cart" data-id="${escapeHtml(product.id)}" ${Number(product.inventory) < 1 ? 'disabled' : ''}>Add to cart</button></div></div></article>`).join('') : emptyState('▦', 'No products found', 'Try changing your search or category.')}
    </div>${cartCount ? `<div class="cart-bar"><div><b>Your cart · ${cartCount} items</b><small>Total: ${formatCurrency(cartTotal)}</small></div><button class="button button-primary" data-action="checkout">Place order →</button></div>` : ''}`;
}

function filteredProducts() {
  const query = state.search.trim().toLowerCase();
  return state.products.filter((product) => {
    const matchesText = !query || `${product.name} ${product.description}`.toLowerCase().includes(query);
    const matchesCategory = state.categoryFilter === 'all' || product.categoryId === state.categoryFilter;
    return matchesText && matchesCategory;
  });
}

function categoriesPage() {
  return `${heading('Categories', `Organize your store into ${state.categories.length} categories.`, `<button class="button button-primary" data-action="new-category"><span class="button-icon">＋</span>Add category</button>`)}
    <div class="category-grid">${state.categories.length ? state.categories.map((category) => {
      const count = state.products.filter((product) => product.categoryId === category.id).length;
      return `<article class="category-card"><div class="category-card-top"><span class="category-card-icon">◇</span><div class="table-actions"><button class="icon-button" data-action="edit-category" data-id="${escapeHtml(category.id)}" aria-label="Edit">✎</button><button class="icon-button" data-action="delete-category" data-id="${escapeHtml(category.id)}" aria-label="Delete">⌫</button></div></div><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description || 'No description for this category.')}</p><div class="category-card-foot"><span>${count} products</span><span>${formatDate(category.createdAt)}</span></div></article>`;
    }).join('') : emptyState('◇', 'No categories yet', 'Add a category to organize your products.')}</div>`;
}

function ordersPage() {
  const manager = isManager();
  return `${heading(manager ? 'Orders' : 'My orders', manager ? `${state.orders.length} orders in your store.` : 'Track the status of your orders.', manager ? `<button class="button button-primary" data-action="new-order"><span class="button-icon">＋</span>Create order</button>` : '')}
    <section class="panel"><div class="panel-heading"><div><h2>Order history</h2><p>${manager ? 'All orders placed in your store.' : 'Your previous orders.'}</p></div></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th>${manager ? '<th>Customer</th>' : ''}<th>Date</th><th>Items</th><th>Total</th><th>Status</th>${manager ? '<th>Actions</th>' : ''}</tr></thead><tbody>${state.orders.length ? state.orders.map((order) => {
        const customer = state.users.find((user) => user.id === order.userId);
        return `<tr><td><strong>#${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</strong></td>${manager ? `<td>${escapeHtml(customer?.name || 'Customer')}</td>` : ''}<td>${formatDate(order.createdAt)}</td><td>${order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0}</td><td><strong>${formatCurrency(order.total)}</strong></td><td><span class="status-pill ${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td>${manager ? `<td>${orderActions(order)}</td>` : ''}</tr>`;
      }).join('') : `<tr><td colspan="${manager ? 7 : 5}">${emptyState('▤', 'No orders yet', manager ? 'New orders will appear here.' : 'Browse products and place an order to see it here.')}</td></tr>`}</tbody></table></div></section>`;
}

function customersPage() {
  const customers = state.users.filter((user) => {
    if (user.role !== 'CUSTOMER') return false;
    const query = state.customerSearch.trim().toLowerCase();
    return !query || `${user.name} ${user.email}`.toLowerCase().includes(query);
  });
  const customerCount = state.users.filter((user) => user.role === 'CUSTOMER').length;
  return `${heading('Customers', `${customerCount} customer accounts available for orders.`, `<button class="button button-primary" data-action="new-customer"><span class="button-icon">＋</span>Add customer</button>`)}
    <div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="customer-search" type="search" placeholder="Search customers by name or email…" value="${escapeHtml(state.customerSearch)}"></label></div>
    <section class="panel"><div class="panel-heading"><div><h2>Customer accounts</h2><p>Create customer accounts here, then select them when creating an order.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Account type</th><th>Registered</th></tr></thead><tbody>${customers.length ? customers.map((user) => `<tr><td><div class="product-cell"><span class="profile-avatar">${escapeHtml((user.name || 'U').slice(0, 1))}</span><strong>${escapeHtml(user.name)}</strong></div></td><td>${escapeHtml(user.email)}</td><td><span class="status-pill">Customer</span></td><td>${formatDate(user.createdAt)}</td></tr>`).join('') : `<tr><td colspan="4">${emptyState('♙', state.customerSearch ? 'No matching customers' : 'No customers yet', state.customerSearch ? 'Try another name or email.' : 'Add a customer account to start creating orders.')}</td></tr>`}</tbody></table></div></section>`;
}

function usersPage() {
  const teamUsers = state.users.filter((user) => {
    if (!['ADMIN', 'STAFF'].includes(user.role)) return false;
    const query = state.teamSearch.trim().toLowerCase();
    return !query || `${user.name} ${user.email}`.toLowerCase().includes(query);
  });
  const teamUserCount = state.users.filter((user) => user.role === 'ADMIN' || user.role === 'STAFF').length;
  return `${heading('Users', `${teamUserCount} Admin and Staff accounts.`, `<button class="button button-primary" data-action="new-team-user"><span class="button-icon">＋</span>Add user</button>`)}
    <div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="team-user-search" type="search" placeholder="Search users by name or email…" value="${escapeHtml(state.teamSearch)}"></label></div>
    <section class="panel"><div class="panel-heading"><div><h2>Team accounts</h2><p>Create Admin or Staff accounts. Staff can manage orders and customers, but not products or categories.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Registered</th></tr></thead><tbody>${teamUsers.length ? teamUsers.map((user) => `<tr><td><div class="product-cell"><span class="profile-avatar">${escapeHtml((user.name || 'U').slice(0, 1))}</span><strong>${escapeHtml(user.name)}</strong></div></td><td>${escapeHtml(user.email)}</td><td><span class="status-pill ${user.role === 'ADMIN' ? 'status-processing' : ''}">${user.role === 'ADMIN' ? 'Admin' : 'Staff'}</span></td><td>${formatDate(user.createdAt)}</td></tr>`).join('') : `<tr><td colspan="4">${emptyState('♟', state.teamSearch ? 'No matching users' : 'No team users yet', state.teamSearch ? 'Try another name or email.' : 'Add an Admin or Staff account to get started.')}</td></tr>`}</tbody></table></div></section>`;
}

function renderPage() {
  if (!isManager() && ['categories', 'customers', 'users'].includes(state.page)) state.page = 'overview';
  document.querySelector('#breadcrumb-current').textContent = pageNames[state.page] || pageNames.overview;
  document.querySelectorAll('.nav-link[data-view]').forEach((link) => link.classList.toggle('active', link.dataset.view === state.page));
  const views = { overview: overviewPage, products: productsPage, categories: categoriesPage, orders: ordersPage, customers: customersPage, users: usersPage };
  pageContent.innerHTML = (views[state.page] || overviewPage)();
}

function navigate(view) {
  if (!pageNames[view] || (!isManager() && ['categories', 'customers', 'users'].includes(view))) return;
  state.page = view;
  state.search = '';
  state.categoryFilter = 'all';
  document.querySelector('#sidebar').classList.remove('open');
  loadPage();
}

function productOptions(selectedId = '') {
  return state.products.map((product) => `<option value="${escapeHtml(product.id)}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name)} — ${formatCurrency(product.price)}</option>`).join('');
}

function orderItemRow(item = {}) {
  return `<div class="form-row order-item-row">
    <div><label>Product</label><select class="order-product" required>${productOptions(item.productId)}</select></div>
    <div class="quantity-field"><label>Quantity</label><input class="order-quantity" type="number" min="1" step="1" value="${Number(item.quantity) || 1}" required><button class="icon-button" type="button" data-action="remove-order-item" aria-label="Remove item">×</button></div>
  </div>`;
}

function openOrderDialog(order = null) {
  if (!state.products.length) {
    toast('Add a product before creating an order.', 'error');
    return;
  }
  const customers = state.users.filter((user) => user.role === 'CUSTOMER');
  if (!customers.length) {
    state.page = 'customers';
    renderPage();
    toast('Add a customer here before creating an order.', 'error');
    return;
  }
  const form = document.querySelector('#entity-form');
  form.dataset.kind = 'order';
  form.dataset.id = order?.id || '';
  document.querySelector('#dialog-eyebrow').textContent = 'Order management';
  document.querySelector('#dialog-title').textContent = order ? 'Edit order' : 'Create order';
  const selectedCustomer = order?.userId || customers[0].id;
  const items = order?.items?.length ? order.items : [{ productId: state.products[0].id, quantity: 1 }];
  form.innerHTML = `<label for="order-customer">Customer</label><select id="order-customer" name="userId" required>${customers.map((customer) => `<option value="${escapeHtml(customer.id)}" ${customer.id === selectedCustomer ? 'selected' : ''}>${escapeHtml(customer.name)} — ${escapeHtml(customer.email)}</option>`).join('')}</select>
    <label for="order-status">Status</label><select id="order-status" name="status" required>${orderStatuses.map(([value, label]) => `<option value="${value}" ${(order?.status || 'PENDING') === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
    <div class="order-items-heading"><label>Order items</label><button class="button button-secondary button-small" type="button" data-action="add-order-item">＋ Add item</button></div>
    <div id="order-items">${items.map((item) => orderItemRow(item)).join('')}</div>
    <div class="dialog-actions"><button class="button button-primary" type="submit">${order ? 'Save order' : 'Create order'}</button><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button></div>`;
  entityDialog.showModal();
}

function openCustomerDialog() {
  const form = document.querySelector('#entity-form');
  form.dataset.kind = 'customer';
  form.dataset.id = '';
  document.querySelector('#dialog-eyebrow').textContent = 'Customer management';
  document.querySelector('#dialog-title').textContent = 'Add customer';
  form.innerHTML = `<label for="customer-name">Full name</label><input id="customer-name" name="name" minlength="2" autocomplete="name" required placeholder="Customer name">
    <label for="customer-email">Email address</label><input id="customer-email" name="email" type="email" autocomplete="email" required placeholder="name@example.com">
    <label for="customer-password">Temporary password</label><input id="customer-password" name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters">
    <div class="dialog-actions"><button class="button button-primary" type="submit">Create customer</button><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button></div>`;
  entityDialog.showModal();
}

function openTeamUserDialog() {
  const form = document.querySelector('#entity-form');
  form.dataset.kind = 'team-user';
  form.dataset.id = '';
  document.querySelector('#dialog-eyebrow').textContent = 'Team management';
  document.querySelector('#dialog-title').textContent = 'Add team user';
  form.innerHTML = `<label for="team-user-name">Full name</label><input id="team-user-name" name="name" minlength="2" autocomplete="name" required placeholder="Team member name">
    <label for="team-user-email">Email address</label><input id="team-user-email" name="email" type="email" autocomplete="email" required placeholder="name@example.com">
    <label for="team-user-password">Temporary password</label><input id="team-user-password" name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters">
    <label for="team-user-role">Role</label><select id="team-user-role" name="role" required><option value="STAFF">Staff — orders and customers</option><option value="ADMIN">Admin — full access</option></select>
    <p class="form-hint">Staff and admins can create team accounts. Staff can manage orders and customers, but cannot manage products or categories.</p>
    <div class="dialog-actions"><button class="button button-primary" type="submit">Create account</button><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button></div>`;
  entityDialog.showModal();
}

function openEntityDialog(kind, entity = null) {
  if (kind === 'order') {
    openOrderDialog(entity);
    return;
  }
  const form = document.querySelector('#entity-form');
  const isProduct = kind === 'product';
  document.querySelector('#dialog-eyebrow').textContent = isProduct ? 'Store catalog' : 'Store organization';
  document.querySelector('#dialog-title').textContent = `${entity ? 'Edit' : 'Add'} ${isProduct ? 'product' : 'category'}`;
  form.dataset.kind = kind;
  form.dataset.id = entity?.id || '';
  if (isProduct) {
    if (!state.categories.length) {
      toast('Add at least one category before creating a product.', 'error');
      return;
    }
    form.innerHTML = `<label for="entity-name">Product name</label><input id="entity-name" name="name" minlength="2" required value="${escapeHtml(entity?.name || '')}" placeholder="Example: Everyday bag">
      <label for="entity-description">Description</label><textarea id="entity-description" name="description" minlength="5" required placeholder="Write a short product description">${escapeHtml(entity?.description || '')}</textarea>
      <div class="form-row"><div><label for="entity-price">Price (SAR)</label><input id="entity-price" name="price" type="number" min="0.01" step="0.01" required value="${escapeHtml(entity?.price ?? '')}"></div><div><label for="entity-inventory">Inventory</label><input id="entity-inventory" name="inventory" type="number" min="0" step="1" required value="${escapeHtml(entity?.inventory ?? 0)}"></div></div>
      <label for="entity-category">Category</label><select id="entity-category" name="categoryId" required>${state.categories.map((category) => `<option value="${escapeHtml(category.id)}" ${entity?.categoryId === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select>
      <div class="dialog-actions"><button class="button button-primary" type="submit">${entity ? 'Save changes' : 'Add product'}</button><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button></div>`;
  } else {
    form.innerHTML = `<label for="entity-name">Category name</label><input id="entity-name" name="name" minlength="2" required value="${escapeHtml(entity?.name || '')}" placeholder="Example: Clothing">
      <label for="entity-description">Description</label><textarea id="entity-description" name="description" placeholder="A short category description">${escapeHtml(entity?.description || '')}</textarea>
      <div class="dialog-actions"><button class="button button-primary" type="submit">${entity ? 'Save changes' : 'Add category'}</button><button class="button button-secondary" type="button" data-action="close-dialog">Cancel</button></div>`;
  }
  entityDialog.showModal();
}

async function saveEntity(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const { kind, id } = form.dataset;
  let body = Object.fromEntries(new FormData(form).entries());
  if (kind === 'customer') {
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
      entityDialog.close();
      state.customerSearch = '';
      toast('Customer account created. You can now select this customer for an order.');
      await loadPage();
    } catch (error) {
      toast(error.message, 'error');
    }
    return;
  }
  if (kind === 'team-user') {
    try {
      await api('/api/users/staff', { method: 'POST', body: JSON.stringify(body) });
      entityDialog.close();
      state.customerSearch = '';
      toast(`${body.role === 'ADMIN' ? 'Admin' : 'Staff'} account created.`);
      await loadPage();
    } catch (error) {
      toast(error.message, 'error');
    }
    return;
  }
  if (kind === 'product') {
    body = { ...body, price: Number(body.price), inventory: Number(body.inventory) };
  }
  if (kind === 'order') {
    body.items = [...form.querySelectorAll('.order-item-row')].map((row) => ({
      productId: row.querySelector('.order-product').value,
      quantity: Number(row.querySelector('.order-quantity').value),
    }));
    if (!body.items.length) {
      toast('An order must contain at least one item.', 'error');
      return;
    }
  }
  const path = kind === 'order'
    ? `/api/orders${id ? `/${encodeURIComponent(id)}` : ''}`
    : `/api/${kind === 'product' ? 'products' : 'categories'}${id ? `/${encodeURIComponent(id)}` : ''}`;
  try {
    await api(path, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    entityDialog.close();
    toast(kind === 'order' ? `Order ${id ? 'updated' : 'created'} successfully.` : `${kind === 'product' ? 'Product' : 'Category'} saved.`);
    await loadPage();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteEntity(kind, id) {
  const entity = kind === 'product' ? productById(id) : state.categories.find((category) => category.id === id);
  if (!entity || !window.confirm(`Delete "${entity.name}"?`)) return;
  try {
    await api(`/api/${kind === 'product' ? 'products' : 'categories'}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('Deleted successfully.');
    await loadPage();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function checkout() {
  const items = [...state.cart.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  if (!items.length) return;
  try {
    await api('/api/orders', { method: 'POST', body: JSON.stringify({ items }) });
    state.cart.clear();
    state.page = 'orders';
    await loadPage();
    toast('Your order has been placed.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteOrder(id) {
  const order = orderById(id);
  if (!order || !window.confirm(`Delete order #${id.slice(0, 8).toUpperCase()}? This cannot be undone.`)) return;
  try {
    await api(`/api/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('Order deleted.');
    await loadPage();
  } catch (error) {
    toast(error.message, 'error');
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-view]');
  if (!target) return;
  if (target.dataset.view) {
    navigate(target.dataset.view);
    return;
  }
  const action = target.dataset.action;
  if (action === 'show-register') showAuth('register');
  if (action === 'show-login') showAuth('login');
  if (action === 'logout') void logout();
  if (action === 'new-product') openEntityDialog('product');
  if (action === 'new-category') openEntityDialog('category');
  if (action === 'new-customer') openCustomerDialog();
  if (action === 'new-team-user') openTeamUserDialog();
  if (action === 'new-order') openOrderDialog();
  if (action === 'edit-order') openOrderDialog(orderById(target.dataset.id));
  if (action === 'delete-order') void deleteOrder(target.dataset.id);
  if (action === 'add-order-item') document.querySelector('#order-items').insertAdjacentHTML('beforeend', orderItemRow({ productId: state.products[0]?.id, quantity: 1 }));
  if (action === 'remove-order-item') {
    const rows = [...document.querySelectorAll('.order-item-row')];
    if (rows.length === 1) {
      toast('An order must contain at least one item.', 'error');
    } else {
      target.closest('.order-item-row').remove();
    }
  }
  if (action === 'edit-product') openEntityDialog('product', productById(target.dataset.id));
  if (action === 'edit-category') openEntityDialog('category', state.categories.find((category) => category.id === target.dataset.id));
  if (action === 'delete-product') void deleteEntity('product', target.dataset.id);
  if (action === 'delete-category') void deleteEntity('category', target.dataset.id);
  if (action === 'close-dialog') entityDialog.close();
  if (action === 'checkout') void checkout();
  if (action === 'reload-page') void loadPage();
  if (action === 'toggle-menu') document.querySelector('#sidebar').classList.toggle('open');
  if (action === 'add-cart') {
    const product = productById(target.dataset.id);
    if (!product) return;
    const quantity = state.cart.get(product.id) || 0;
    if (quantity >= Number(product.inventory)) {
      toast('The requested quantity is not available.', 'error');
      return;
    }
    state.cart.set(product.id, quantity + 1);
    renderPage();
    toast('Product added to your cart.');
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'customer-search') {
    state.customerSearch = event.target.value;
    renderPage();
    const search = document.querySelector('#customer-search');
    search.focus();
    search.setSelectionRange(state.customerSearch.length, state.customerSearch.length);
  }
  if (event.target.id === 'team-user-search') {
    state.teamSearch = event.target.value;
    renderPage();
    const search = document.querySelector('#team-user-search');
    search.focus();
    search.setSelectionRange(state.teamSearch.length, state.teamSearch.length);
  }
  if (event.target.id === 'product-search') {
    state.search = event.target.value;
    const selectionStart = event.target.selectionStart;
    renderPage();
    const search = document.querySelector('#product-search');
    search.focus();
    search.setSelectionRange(selectionStart, selectionStart);
    if (isAdmin()) {
      document.querySelector('#products-body').innerHTML = productRows(filteredProducts(), true);
    }
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'category-filter') {
    state.categoryFilter = event.target.value;
    renderPage();
  }
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void signIn(loginForm, 'login');
});
registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void signIn(registerForm, 'register');
});
document.querySelector('#entity-form').addEventListener('submit', (event) => void saveEntity(event));
entityDialog.addEventListener('click', (event) => {
  if (event.target === entityDialog) entityDialog.close();
});

if (state.accessToken && state.user) {
  void loadPage();
} else {
  showAuth();
}
