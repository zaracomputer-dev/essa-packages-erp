const STORAGE_KEY = "business-ledger-urdu-v1";
const SESSION_KEY = "business-ledger-session";
const SYNC_META_KEY = "eissa-pos-sync-meta-v1";
const CLIENT_ID_KEY = "eissa-pos-client-id-v1";

const clientId = getClientId();
let supabaseClient = null;
let cloudUser = null;
let realtimeChannel = null;
let syncTimer = null;
let isApplyingRemoteState = false;
let isSyncingCloud = false;
let selectedInvoiceId = "";

const labels = {
  sale: "Sale",
  purchase: "Purchase",
  receive: "Receive",
  payment: "Payment",
  driver: "Driver Charge",
  expense: "Other Expense"
};

const state = loadState();

function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function defaultSettings() {
  return {
    companyName: "Eissa Packages",
    companyPhone: "",
    companyAddress: "Quality Packaging Solutions",
    taxNumber: "",
    defaultTax: 0,
    defaultLowStock: 5,
    theme: "light"
  };
}

function defaultState() {
  return {
    customers: [],
    entries: [],
    quotations: [],
    invoices: [],
    salesInvoices: [],
    purchaseInvoices: [],
    products: [],
    suppliers: [],
    dispatches: [],
    productions: [],
    staff: [],
    salaryExpenses: [],
    bankAccounts: [],
    bankTransactions: [],
    inventoryMovements: [],
    journalEntries: [],
    auditLogs: [],
    meta: {
      cloudUpdatedAt: 0,
      cloudClientId: clientId
    },
    settings: defaultSettings()
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState();

  try {
    const parsed = JSON.parse(saved);
    return {
      customers: parsed.customers || [],
      entries: parsed.entries || [],
      quotations: parsed.quotations || [],
      invoices: parsed.invoices || [],
      salesInvoices: parsed.salesInvoices || [],
      purchaseInvoices: parsed.purchaseInvoices || [],
      products: parsed.products || [],
      suppliers: parsed.suppliers || [],
      dispatches: parsed.dispatches || [],
      productions: parsed.productions || [],
      staff: parsed.staff || [],
      salaryExpenses: parsed.salaryExpenses || [],
      bankAccounts: parsed.bankAccounts || [],
      bankTransactions: parsed.bankTransactions || [],
      inventoryMovements: parsed.inventoryMovements || [],
      journalEntries: parsed.journalEntries || [],
      auditLogs: parsed.auditLogs || [],
      meta: {
        cloudUpdatedAt: amount(parsed.meta?.cloudUpdatedAt),
        cloudClientId: parsed.meta?.cloudClientId || clientId
      },
      settings: { ...defaultSettings(), ...(parsed.settings || {}) }
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  if (!isApplyingRemoteState) {
    state.meta = {
      ...(state.meta || {}),
      cloudUpdatedAt: Date.now(),
      cloudClientId: clientId
    };
    markSyncPending();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!isApplyingRemoteState) scheduleCloudSync(50);
}

function audit(action, details) {
  state.auditLogs.unshift({
    id: uid(),
    time: new Date().toLocaleString("en-PK"),
    action,
    details
  });
  state.auditLogs = state.auditLogs.slice(0, 250);
}

function loadSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSyncMeta(meta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

function markSyncPending() {
  saveSyncMeta({ ...loadSyncMeta(), pending: true, lastLocalChangeAt: Date.now() });
}

function markSyncClean() {
  saveSyncMeta({ ...loadSyncMeta(), pending: false, lastSyncedAt: Date.now() });
}

function isSupabaseConfigured() {
  const config = window.EISSA_SUPABASE_CONFIG || {};
  return Boolean(config.url && config.anonKey && window.supabase);
}

function initSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    const config = window.EISSA_SUPABASE_CONFIG;
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  }
  return supabaseClient;
}

function updateSyncStatus(text, mode = "info") {
  const box = document.querySelector("#syncStatus");
  if (!box) return;
  box.textContent = text;
  box.dataset.mode = mode;
}

function scheduleCloudSync(delay = 900) {
  if (!isSupabaseConfigured()) {
    updateSyncStatus("Cloud sync: not configured");
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToCloud, delay);
}

function cloudPayload() {
  return JSON.parse(JSON.stringify(state));
}

async function getCloudSession() {
  const client = initSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  cloudUser = data.session?.user || null;
  return data.session || null;
}

async function pullFromCloud() {
  if (isSyncingCloud) return false;
  const client = initSupabaseClient();
  const session = await getCloudSession();
  if (!client || !session) return false;

  const normalizedPulled = await pullNormalizedTables(client, session.user.id);
  if (normalizedPulled) return true;

  const { data, error } = await client
    .from("erp_state")
    .select("data, updated_at, client_id")
    .eq("user_id", session.user.id)
    .eq("state_key", "main")
    .maybeSingle();

  if (error) {
    updateSyncStatus(`Cloud pull failed: ${error.message}`, "error");
    return false;
  }
  if (!data?.data) return false;

  const remoteUpdatedAt = amount(data.data.meta?.cloudUpdatedAt);
  const localUpdatedAt = amount(state.meta?.cloudUpdatedAt);
  if (remoteUpdatedAt > localUpdatedAt && data.client_id !== clientId) {
    isApplyingRemoteState = true;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, { ...defaultState(), ...data.data });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    isApplyingRemoteState = false;
    renderAll();
    updateSyncStatus(`Cloud sync: pulled latest data ${new Date().toLocaleTimeString("en-PK")}`, "ok");
  }
  return true;
}

async function syncToCloud() {
  const client = initSupabaseClient();
  if (!client) {
    updateSyncStatus("Cloud sync: not configured");
    return false;
  }
  if (!navigator.onLine) {
    updateSyncStatus("Cloud sync: offline, will retry automatically", "warn");
    return false;
  }
  const session = await getCloudSession();
  if (!session) {
    updateSyncStatus("Cloud database: login required. Data is cached locally only until Supabase login.", "warn");
    return false;
  }

  updateSyncStatus("Cloud sync: syncing...");
  if (!loadSyncMeta().pending) await pullFromCloud();

  const payload = cloudPayload();
  isSyncingCloud = true;
  const { error } = await client.from("erp_state").upsert({
    user_id: session.user.id,
    state_key: "main",
    data: payload,
    client_id: clientId,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,state_key" });

  if (error) {
    isSyncingCloud = false;
    updateSyncStatus(`Cloud sync failed: ${error.message}`, "error");
    return false;
  }
  const normalizedSynced = await syncNormalizedTables(client, session.user.id);
  isSyncingCloud = false;
  markSyncClean();
  audit("Cloud sync", "State pushed to Supabase");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateSyncStatus(`Cloud sync: saved ${new Date().toLocaleTimeString("en-PK")}${normalizedSynced ? " + normalized tables" : " (JSON fallback)"}`, normalizedSynced ? "ok" : "warn");
  return true;
}

function normalizedTablePayloads(userId) {
  const withUser = row => ({ user_id: userId, ...row, updated_at: new Date().toISOString() });
  return {
    erp_customers: state.customers.map(item => withUser({
      id: item.id,
      name: item.name,
      phone: item.phone || "",
      address: item.address || "",
      opening_balance: amount(item.opening),
      raw_data: item
    })),
    erp_suppliers: state.suppliers.map(item => withUser({
      id: item.id,
      name: item.name,
      phone: item.phone || "",
      address: item.address || "",
      opening_balance: amount(item.opening),
      raw_data: item
    })),
    erp_products: state.products.map(item => withUser({
      id: item.id,
      name: item.name,
      category: item.category || "",
      barcode: item.barcode || "",
      cost: amount(item.cost),
      price: amount(item.price),
      stock: amount(item.stock),
      low_stock: amount(item.lowStock),
      raw_data: item
    })),
    erp_sales_invoices: state.salesInvoices.map(item => withUser({
      id: item.id,
      invoice_no: item.number,
      invoice_date: item.date,
      customer_id: item.customerId || null,
      product_id: item.productId || null,
      details: item.details || "",
      quantity: amount(item.quantity),
      rate: amount(item.rate),
      subtotal: amount(item.subtotal),
      tax: amount(item.tax),
      discount: amount(item.discount),
      freight_case: item.freightCase || "",
      freight: amount(item.freight),
      total: amount(item.total),
      raw_data: item
    })),
    erp_purchase_invoices: state.purchaseInvoices.map(item => withUser({
      id: item.id,
      invoice_no: item.number,
      invoice_date: item.date,
      supplier_id: item.supplierId || null,
      product_id: item.productId || null,
      details: item.details || "",
      quantity: amount(item.quantity),
      rate: amount(item.rate),
      subtotal: amount(item.subtotal),
      tax: amount(item.tax),
      freight: amount(item.freight),
      total: amount(item.total),
      raw_data: item
    })),
    erp_entries: state.entries.map(item => withUser({
      id: item.id,
      entry_date: item.date,
      entry_type: item.type,
      customer_id: item.customerId || null,
      supplier_id: item.supplierId || null,
      product_id: item.productId || null,
      source_type: item.sourceType || "",
      source_id: item.sourceId || "",
      details: item.details || "",
      quantity: amount(item.quantity),
      rate: amount(item.rate),
      amount: amount(item.amount),
      raw_data: item
    })),
    erp_journal_entries: state.journalEntries.map(item => withUser({
      id: item.id,
      journal_date: item.date,
      voucher_no: item.voucherNo,
      description: item.description || "",
      debit_account: item.debitAccount || "",
      credit_account: item.creditAccount || "",
      amount: amount(item.amount),
      source_type: item.sourceType || "",
      source_id: item.sourceId || "",
      raw_data: item
    })),
    erp_inventory_movements: state.inventoryMovements.map(item => withUser({
      id: item.id,
      movement_date: item.date,
      product_id: item.productId || null,
      movement_type: item.type,
      quantity: amount(item.quantity),
      rate: amount(item.rate),
      amount: amount(item.amount),
      source_type: item.sourceType || "",
      source_id: item.sourceId || "",
      ref_number: item.refNumber || "",
      party_name: item.partyName || "",
      details: item.details || "",
      raw_data: item
    }))
  };
}

function rowData(row, fallback) {
  return row.raw_data && typeof row.raw_data === "object" ? row.raw_data : fallback;
}

function maxUpdatedAt(rows) {
  return rows.reduce((max, row) => {
    const value = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    return Math.max(max, Number.isFinite(value) ? value : 0);
  }, 0);
}

async function fetchNormalizedTable(client, table, userId) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

async function pullJsonSnapshot(client, userId) {
  const { data, error } = await client
    .from("erp_state")
    .select("data, updated_at, client_id")
    .eq("user_id", userId)
    .eq("state_key", "main")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function pullNormalizedTables(client, userId) {
  try {
    const [
      customers,
      suppliers,
      products,
      salesInvoices,
      purchaseInvoices,
      entries,
      journalEntries,
      inventoryMovements
    ] = await Promise.all([
      fetchNormalizedTable(client, "erp_customers", userId),
      fetchNormalizedTable(client, "erp_suppliers", userId),
      fetchNormalizedTable(client, "erp_products", userId),
      fetchNormalizedTable(client, "erp_sales_invoices", userId),
      fetchNormalizedTable(client, "erp_purchase_invoices", userId),
      fetchNormalizedTable(client, "erp_entries", userId),
      fetchNormalizedTable(client, "erp_journal_entries", userId),
      fetchNormalizedTable(client, "erp_inventory_movements", userId)
    ]);

    const allRows = [
      ...customers,
      ...suppliers,
      ...products,
      ...salesInvoices,
      ...purchaseInvoices,
      ...entries,
      ...journalEntries,
      ...inventoryMovements
    ];
    if (!allRows.length) return false;

    const remoteUpdatedAt = maxUpdatedAt(allRows);
    const localUpdatedAt = amount(state.meta?.cloudUpdatedAt);
    if (loadSyncMeta().pending && localUpdatedAt > remoteUpdatedAt) return false;

    let jsonSnapshot = null;
    try {
      jsonSnapshot = await pullJsonSnapshot(client, userId);
    } catch {
      jsonSnapshot = null;
    }

    const baseState = { ...defaultState(), ...(jsonSnapshot?.data || {}) };
    const nextState = {
      ...baseState,
      customers: customers.map(row => rowData(row, {
        id: row.id,
        name: row.name,
        phone: row.phone || "",
        address: row.address || "",
        opening: amount(row.opening_balance)
      })),
      suppliers: suppliers.map(row => rowData(row, {
        id: row.id,
        name: row.name,
        phone: row.phone || "",
        address: row.address || "",
        opening: amount(row.opening_balance)
      })),
      products: products.map(row => rowData(row, {
        id: row.id,
        name: row.name,
        category: row.category || "",
        barcode: row.barcode || "",
        cost: amount(row.cost),
        price: amount(row.price),
        stock: amount(row.stock),
        lowStock: amount(row.low_stock)
      })),
      salesInvoices: salesInvoices.map(row => rowData(row, {
        id: row.id,
        number: row.invoice_no,
        date: row.invoice_date,
        customerId: row.customer_id || "",
        productId: row.product_id || "",
        details: row.details || "",
        quantity: amount(row.quantity),
        rate: amount(row.rate),
        subtotal: amount(row.subtotal),
        tax: amount(row.tax),
        discount: amount(row.discount),
        freightCase: row.freight_case || "",
        freight: amount(row.freight),
        salesType: row.raw_data?.salesType || "stock",
        total: amount(row.total)
      })),
      purchaseInvoices: purchaseInvoices.map(row => rowData(row, {
        id: row.id,
        number: row.invoice_no,
        date: row.invoice_date,
        supplierId: row.supplier_id || "",
        productId: row.product_id || "",
        details: row.details || "",
        quantity: amount(row.quantity),
        rate: amount(row.rate),
        subtotal: amount(row.subtotal),
        tax: amount(row.tax),
        freight: amount(row.freight),
        total: amount(row.total)
      })),
      entries: entries.map(row => rowData(row, {
        id: row.id,
        date: row.entry_date,
        type: row.entry_type,
        customerId: row.customer_id || "",
        supplierId: row.supplier_id || "",
        productId: row.product_id || "",
        sourceType: row.source_type || "",
        sourceId: row.source_id || "",
        details: row.details || "",
        quantity: amount(row.quantity),
        rate: amount(row.rate),
        amount: amount(row.amount)
      })),
      journalEntries: journalEntries.map(row => rowData(row, {
        id: row.id,
        date: row.journal_date,
        voucherNo: row.voucher_no,
        description: row.description || "",
        debitAccount: row.debit_account || "",
        creditAccount: row.credit_account || "",
        amount: amount(row.amount),
        sourceType: row.source_type || "",
        sourceId: row.source_id || ""
      })),
      inventoryMovements: inventoryMovements.map(row => rowData(row, {
        id: row.id,
        date: row.movement_date,
        productId: row.product_id || "",
        type: row.movement_type,
        quantity: amount(row.quantity),
        rate: amount(row.rate),
        amount: amount(row.amount),
        sourceType: row.source_type || "",
        sourceId: row.source_id || "",
        refNumber: row.ref_number || "",
        partyName: row.party_name || "",
        details: row.details || ""
      })),
      meta: {
        ...(baseState.meta || {}),
        cloudUpdatedAt: remoteUpdatedAt,
        cloudClientId: "supabase-normalized"
      },
      settings: { ...defaultSettings(), ...(baseState.settings || {}) }
    };

    isApplyingRemoteState = true;
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    isApplyingRemoteState = false;
    markSyncClean();
    renderAll();
    updateSyncStatus(`Cloud database: loaded live Supabase tables ${new Date().toLocaleTimeString("en-PK")}`, "ok");
    return true;
  } catch (error) {
    updateSyncStatus(`Cloud database pull failed: ${error.message}`, "error");
    return false;
  }
}

async function replaceNormalizedTable(client, table, rows, userId) {
  const deleteResult = await client.from(table).delete().eq("user_id", userId).neq("id", "__never__");
  if (deleteResult.error) throw deleteResult.error;
  if (!rows.length) return;
  const insertResult = await client.from(table).insert(rows);
  if (insertResult.error) throw insertResult.error;
}

async function syncNormalizedTables(client, userId) {
  const payloads = normalizedTablePayloads(userId);
  const parentTables = ["erp_customers", "erp_suppliers", "erp_products"];
  const childTables = [
    "erp_sales_invoices",
    "erp_purchase_invoices",
    "erp_entries",
    "erp_journal_entries",
    "erp_inventory_movements"
  ];
  try {
    for (const table of childTables) await replaceNormalizedTable(client, table, [], userId);
    for (const table of parentTables) await replaceNormalizedTable(client, table, payloads[table], userId);
    for (const table of childTables) await replaceNormalizedTable(client, table, payloads[table], userId);
    audit("Normalized cloud sync", "PostgreSQL ERP tables updated");
    return true;
  } catch (error) {
    updateSyncStatus(`Cloud sync saved JSON. Normalized tables pending: ${error.message}`, "warn");
    return false;
  }
}

async function startRealtimeSync() {
  const client = initSupabaseClient();
  const session = await getCloudSession();
  if (!client || !session || realtimeChannel) return;

  realtimeChannel = client
    .channel("erp-live-database")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "erp_state",
      filter: `user_id=eq.${session.user.id}`
    }, async payload => {
      if (isSyncingCloud) return;
      if (payload.new?.client_id === clientId) return;
      await pullFromCloud();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_customers", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_suppliers", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_products", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_sales_invoices", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_purchase_invoices", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_entries", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_journal_entries", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_inventory_movements", filter: `user_id=eq.${session.user.id}` }, () => { if (!isSyncingCloud) pullFromCloud(); })
    .subscribe();
}

async function setupCloudSync() {
  if (!isSupabaseConfigured()) {
    updateSyncStatus("Cloud sync: not configured. Add Supabase URL and anon key in supabase-config.js");
    return;
  }
  const client = initSupabaseClient();
  const session = await getCloudSession();
  if (session) {
    document.querySelector("#loginScreen").classList.add("hidden");
    markSyncClean();
    await pullFromCloud();
    await startRealtimeSync();
    updateSyncStatus("Cloud database: connected. Supabase is primary source of truth.", "ok");
  } else {
    document.querySelector("#loginScreen").classList.remove("hidden");
    updateSyncStatus("Cloud database: configured, please login with Supabase email/password");
  }
  client.auth.onAuthStateChange(async (_event, sessionData) => {
    cloudUser = sessionData?.user || null;
    if (cloudUser) {
      document.querySelector("#loginScreen").classList.add("hidden");
      markSyncClean();
      await pullFromCloud();
      await startRealtimeSync();
      updateSyncStatus("Cloud database: connected. Supabase is primary source of truth.", "ok");
    } else {
      document.querySelector("#loginScreen").classList.remove("hidden");
    }
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function amount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return amount(value).toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadText(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function getCustomer(id) {
  return state.customers.find(customer => customer.id === id);
}

function getProduct(id) {
  return state.products.find(product => product.id === id);
}

function getSupplier(id) {
  return state.suppliers.find(supplier => supplier.id === id);
}

function customerName(id) {
  return getCustomer(id)?.name || "General";
}

function supplierName(id) {
  return getSupplier(id)?.name || "General Supplier";
}

function salesTypeLabel(type) {
  return type === "direct_dispatch" ? "Direct Dispatch Sale" : "Stock Sale";
}

function isDirectDispatchSale(invoice) {
  return invoice?.salesType === "direct_dispatch";
}

function supplierBalance(supplier) {
  const opening = amount(supplier.opening);
  return state.entries.reduce((total, entry) => {
    if (entry.supplierId !== supplier.id) return total;
    if (entry.type === "purchase") return total + amount(entry.amount);
    if (entry.type === "payment") return total - amount(entry.amount);
    return total;
  }, opening);
}

function customerBalance(customer) {
  const opening = amount(customer.opening);
  return state.entries.reduce((total, entry) => {
    if (entry.customerId !== customer.id) return total;
    const value = amount(entry.amount);
    if (entry.type === "sale") return total + value;
    if (entry.type === "receive") return total - value;
    if (entry.type === "purchase") return total - value;
    if (entry.type === "payment") return total + value;
    return total;
  }, opening);
}

function totals(entries = state.entries) {
  return entries.reduce((sum, entry) => {
    sum[entry.type] = (sum[entry.type] || 0) + amount(entry.amount);
    return sum;
  }, { sale: 0, purchase: 0, receive: 0, payment: 0, driver: 0, expense: 0 });
}

function businessBalance(entries = state.entries) {
  const t = totals(entries);
  return t.sale + t.receive - t.purchase - t.payment - t.driver - t.expense;
}

function adjustProductStock(productId, type, quantity) {
  const product = getProduct(productId);
  if (!product) return;
  if (type === "sale") product.stock = amount(product.stock) - amount(quantity);
  if (type === "purchase") product.stock = amount(product.stock) + amount(quantity);
}

function movementDirection(type) {
  return ["purchase_in", "production_in", "adjustment_in", "return_in"].includes(type) ? "in" : "out";
}

function movementQuantitySign(type) {
  return movementDirection(type) === "in" ? 1 : -1;
}

function movementTypeLabel(type) {
  return {
    purchase_in: "Purchase In",
    sale_out: "Sale Out",
    production_in: "Production In",
    adjustment_in: "Adjustment In",
    adjustment_out: "Adjustment Out",
    return_in: "Return In"
  }[type] || type;
}

function movementExists(sourceType, sourceId, productId) {
  return state.inventoryMovements.some(item =>
    item.sourceType === sourceType && item.sourceId === sourceId && item.productId === productId
  );
}

function recordInventoryMovement(data) {
  if (!data.productId || !amount(data.quantity)) return;
  if (data.sourceType && data.sourceId && movementExists(data.sourceType, data.sourceId, data.productId)) return;
  const quantity = amount(data.quantity);
  state.inventoryMovements.unshift({
    id: uid(),
    date: data.date || today(),
    productId: data.productId,
    type: data.type,
    quantity,
    rate: amount(data.rate),
    amount: amount(data.amount) || quantity * amount(data.rate),
    sourceType: data.sourceType || "manual",
    sourceId: data.sourceId || "",
    refNumber: data.refNumber || "",
    partyName: data.partyName || "",
    details: data.details || ""
  });
}

function removeInventoryMovements(sourceId, refNumber = "") {
  state.inventoryMovements = state.inventoryMovements.filter(item => {
    if (item.sourceId === sourceId) return false;
    return !(refNumber && item.refNumber === refNumber);
  });
}

function stockValue() {
  return state.products.reduce((sum, product) => sum + amount(product.stock) * amount(product.cost), 0);
}

function lowStockProducts() {
  return state.products.filter(product => amount(product.stock) <= amount(product.lowStock));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emptyRow(columns, text = "No records yet") {
  return `<tr><td class="empty" colspan="${columns}">${text}</td></tr>`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setDefaultDates() {
  document.querySelector("#entryForm [name='date']").value = today();
  document.querySelector("#quotationForm [name='date']").value = today();
  document.querySelector("#dispatchForm [name='date']").value = today();
  document.querySelector("#productionForm [name='date']").value = today();
  document.querySelector("#salaryExpenseForm [name='date']").value = today();
  document.querySelector("#bankTransactionForm [name='date']").value = today();
  document.querySelector("#entryMonth").value = currentMonth();
  document.querySelector("#monthlyPicker").value = currentMonth();
  document.querySelector("#salaryExpenseMonth").value = currentMonth();
  document.querySelector("#bankLedgerMonth").value = currentMonth();
  document.querySelector("#journalMonth").value = currentMonth();
  document.querySelector("#inventoryMovementMonth").value = currentMonth();
}

function fillCustomerSelects() {
  const options = [`<option value="">General / no customer</option>`]
    .concat(state.customers.map(customer => `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`))
    .join("");

  document.querySelector("#entryCustomer").innerHTML = options;
  document.querySelector("#quotationCustomer").innerHTML = options;
  document.querySelector("#invoiceCustomer").innerHTML = options;
  document.querySelector("#dispatchCustomer").innerHTML = options;
  document.querySelector("#salesCustomer").innerHTML = options;
}

function fillProductSelects() {
  const options = [`<option value="">No product</option>`]
    .concat(state.products.map(product => `<option value="${product.id}">${escapeHtml(product.name)} - Stock ${money(product.stock)}</option>`))
    .join("");

  document.querySelector("#entryProduct").innerHTML = options;
  document.querySelector("#productionProduct").innerHTML = options;
  document.querySelector("#salesProduct").innerHTML = options;
  document.querySelector("#purchaseProduct").innerHTML = options;
  document.querySelector("#inventoryProductFilter").innerHTML = [`<option value="">All products</option>`]
    .concat(state.products.map(product => `<option value="${product.id}">${escapeHtml(product.name)}</option>`))
    .join("");
}

function fillSupplierSelects() {
  const options = [`<option value="">General / no supplier</option>`]
    .concat(state.suppliers.map(supplier => `<option value="${supplier.id}">${escapeHtml(supplier.name)}</option>`))
    .join("");
  document.querySelector("#purchaseSupplier").innerHTML = options;
  document.querySelector("#entrySupplier").innerHTML = options;
}

function fillLedgerSelects() {
  const customerOptions = state.customers.length
    ? state.customers.map(customer => `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`).join("")
    : `<option value="">No customers</option>`;
  const supplierOptions = state.suppliers.length
    ? state.suppliers.map(supplier => `<option value="${supplier.id}">${escapeHtml(supplier.name)}</option>`).join("")
    : `<option value="">No suppliers</option>`;
  document.querySelector("#customerLedgerSelect").innerHTML = customerOptions;
  document.querySelector("#supplierLedgerSelect").innerHTML = supplierOptions;
}

function bankAccountName(id) {
  const account = state.bankAccounts.find(item => item.id === id);
  return account ? `${account.bankName} - ${account.title || account.accountNumber || "Account"}` : "Bank";
}

function bankBalance(account) {
  return state.bankTransactions.reduce((total, item) => {
    if (item.bankId !== account.id) return total;
    if (item.type === "deposit" || item.type === "transfer_in") return total + amount(item.amount);
    return total - amount(item.amount);
  }, amount(account.opening));
}

function totalBankBalance() {
  return state.bankAccounts.reduce((sum, account) => sum + bankBalance(account), 0);
}

function totalReceivables() {
  const customerIds = new Set(state.customers.map(customer => customer.id));
  return [...customerIds].reduce((sum, id) => {
    const rows = customerLedgerRows(id);
    const balance = rows.reduce((total, row) => total + amount(row.debit) - amount(row.credit), 0);
    return sum + Math.max(0, balance);
  }, 0);
}

function totalPayables() {
  const supplierIds = new Set(state.suppliers.map(supplier => supplier.id));
  return [...supplierIds].reduce((sum, id) => {
    const rows = supplierLedgerRows(id);
    const balance = rows.reduce((total, row) => total + amount(row.credit) - amount(row.debit), 0);
    return sum + Math.max(0, balance);
  }, 0);
}

function fillBankSelects() {
  const options = state.bankAccounts.length
    ? state.bankAccounts.map(account => `<option value="${account.id}">${escapeHtml(bankAccountName(account.id))}</option>`).join("")
    : `<option value="">No bank account</option>`;
  document.querySelector("#bankTransactionAccount").innerHTML = options;
}

function renderDashboard() {
  const t = totals();
  const financials = financialSummary();
  document.querySelector("#mSales").textContent = money(t.sale);
  document.querySelector("#mPurchases").textContent = money(t.purchase);
  document.querySelector("#mReceived").textContent = money(t.receive);
  document.querySelector("#mPaid").textContent = money(t.payment);
  document.querySelector("#mDriver").textContent = money(t.driver);
  document.querySelector("#mBalance").textContent = money(businessBalance());
  document.querySelector("#mStockValue").textContent = money(stockValue());
  document.querySelector("#mLowStock").textContent = lowStockProducts().length;
  document.querySelector("#mNetProfit").textContent = money(financials.netProfit);
  document.querySelector("#mReceivables").textContent = money(financials.receivables);
  document.querySelector("#mPayables").textContent = money(financials.payables);
  document.querySelector("#mCashBalance").textContent = money(financials.cashBalance);
  document.querySelector("#mBankBalance").textContent = money(financials.bankBalance);

  const recent = [...state.entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  document.querySelector("#recentEntries").innerHTML = recent.length
    ? recent.map(entry => `
      <tr>
        <td>${entry.date}</td>
        <td>${labels[entry.type]}</td>
        <td>${escapeHtml(customerName(entry.customerId))}</td>
        <td>${escapeHtml(entry.details)}</td>
        <td>${money(entry.amount)}</td>
      </tr>
    `).join("")
    : emptyRow(5);

  renderChart();
  renderNotifications();
}

function renderChart() {
  const days = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const values = days.map(day => state.entries
    .filter(entry => entry.type === "sale" && entry.date === day)
    .reduce((sum, entry) => sum + amount(entry.amount), 0));
  const max = Math.max(1, ...values);

  document.querySelector("#salesChart").innerHTML = days.map((day, index) => {
    const height = Math.max(6, Math.round(values[index] / max * 150));
    return `<div class="bar" title="${money(values[index])}" style="height:${height}px"><span>${day.slice(5)}</span></div>`;
  }).join("");
}

function renderNotifications() {
  const notices = [];
  lowStockProducts().forEach(product => {
    notices.push(`Low stock: ${escapeHtml(product.name)} (${money(product.stock)})`);
  });
  state.customers.filter(customer => customerBalance(customer) > 0).slice(0, 5).forEach(customer => {
    notices.push(`Outstanding balance: ${escapeHtml(customer.name)} - ${money(customerBalance(customer))}`);
  });

  document.querySelector("#notificationList").innerHTML = notices.length
    ? notices.map(text => `<li class="notification">${text}</li>`).join("")
    : `<li class="notification">All clear. No alerts right now.</li>`;
}

function renderCustomers() {
  document.querySelector("#customerRows").innerHTML = state.customers.length
    ? state.customers.map(customer => `
      <tr>
        <td>${escapeHtml(customer.name)}</td>
        <td>${escapeHtml(customer.phone)}</td>
        <td>${money(customer.opening)}</td>
        <td>${money(customerBalance(customer))}</td>
        <td><button class="danger" data-delete-customer="${customer.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(5);
}

function renderSuppliers() {
  document.querySelector("#supplierRows").innerHTML = state.suppliers.length
    ? state.suppliers.map(supplier => `
      <tr>
        <td>${escapeHtml(supplier.name)}</td>
        <td>${escapeHtml(supplier.phone)}</td>
        <td>${money(supplier.opening)}</td>
        <td>${money(supplierBalance(supplier))}</td>
        <td><button class="danger" data-delete-supplier="${supplier.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(5);
}

function filteredProducts() {
  const search = document.querySelector("#productSearch").value.trim().toLowerCase();
  return state.products.filter(product => {
    const text = `${product.name} ${product.category} ${product.barcode}`.toLowerCase();
    return !search || text.includes(search);
  });
}

function renderProducts() {
  const products = filteredProducts();
  document.querySelector("#productRows").innerHTML = products.length
    ? products.map(product => {
      const isLow = amount(product.stock) <= amount(product.lowStock);
      return `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.category)}</td>
          <td>${escapeHtml(product.barcode)}</td>
          <td>${money(product.cost)}</td>
          <td>${money(product.price)}</td>
          <td>${money(product.stock)}</td>
          <td class="${isLow ? "status-low" : "status-ok"}">${isLow ? "Low" : "OK"}</td>
          <td>
            <button data-label-product="${product.id}" type="button">Label</button>
            <button class="danger" data-delete-product="${product.id}" type="button">Delete</button>
          </td>
        </tr>
      `;
    }).join("")
    : emptyRow(8);
}

function renderSalesInvoices() {
  document.querySelector("#salesInvoiceRows").innerHTML = state.salesInvoices.length
    ? [...state.salesInvoices].sort((a, b) => b.date.localeCompare(a.date)).map(invoice => `
      <tr>
        <td>${escapeHtml(invoice.number)}</td>
        <td>${escapeHtml(invoice.date)}</td>
        <td>${escapeHtml(salesTypeLabel(invoice.salesType))}</td>
        <td>${escapeHtml(customerName(invoice.customerId))}</td>
        <td>${escapeHtml(invoice.details)}</td>
        <td>${money(invoice.quantity)}</td>
        <td>${money(invoice.total)}</td>
        <td>${escapeHtml(invoice.freightCase)} / ${money(invoice.freight)}</td>
        <td><button class="danger" data-delete-sales-invoice="${invoice.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(9);
}

function renderPurchaseInvoices() {
  document.querySelector("#purchaseInvoiceRows").innerHTML = state.purchaseInvoices.length
    ? [...state.purchaseInvoices].sort((a, b) => b.date.localeCompare(a.date)).map(invoice => `
      <tr>
        <td>${escapeHtml(invoice.number)}</td>
        <td>${escapeHtml(invoice.date)}</td>
        <td>${escapeHtml(state.suppliers.find(supplier => supplier.id === invoice.supplierId)?.name || "General")}</td>
        <td>${escapeHtml(invoice.details)}</td>
        <td>${money(invoice.quantity)}</td>
        <td>${money(invoice.total)}</td>
        <td><button class="danger" data-delete-purchase-invoice="${invoice.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(7);
}

function customerLedgerRows(customerId) {
  const customer = getCustomer(customerId);
  if (!customer) return [];
  const rows = [{
    date: "Opening",
    type: "Opening Balance",
    ref: customer.name,
    debit: amount(customer.opening),
    credit: 0
  }];

  state.salesInvoices
    .filter(invoice => invoice.customerId === customerId)
    .forEach(invoice => {
      rows.push({
        date: invoice.date,
        type: "Sales Invoice",
        ref: invoice.number,
        debit: amount(invoice.subtotal) + amount(invoice.tax) - amount(invoice.discount),
        credit: 0
      });
      if (invoice.freightCase === "recoverable" && amount(invoice.freight)) {
        rows.push({
          date: invoice.date,
          type: "Freight Recovery",
          ref: invoice.number,
          debit: amount(invoice.freight),
          credit: 0
        });
      }
    });

  state.entries
    .filter(entry => entry.customerId === customerId && entry.type === "receive")
    .forEach(entry => {
      rows.push({
        date: entry.date,
        type: "Payment Received",
        ref: entry.details || "Receipt",
        debit: 0,
        credit: amount(entry.amount)
      });
    });

  return rows.sort((a, b) => {
    if (a.date === "Opening") return -1;
    if (b.date === "Opening") return 1;
    return a.date.localeCompare(b.date);
  });
}

function supplierLedgerRows(supplierId) {
  const supplier = state.suppliers.find(item => item.id === supplierId);
  if (!supplier) return [];
  const rows = [{
    date: "Opening",
    type: "Opening Balance",
    ref: supplier.name,
    debit: 0,
    credit: amount(supplier.opening)
  }];

  state.purchaseInvoices
    .filter(invoice => invoice.supplierId === supplierId)
    .forEach(invoice => {
      rows.push({
        date: invoice.date,
        type: "Purchase Invoice",
        ref: invoice.number,
        debit: 0,
        credit: amount(invoice.total)
      });
    });

  state.entries
    .filter(entry => entry.supplierId === supplierId && entry.type === "payment")
    .forEach(entry => {
      rows.push({
        date: entry.date,
        type: "Payment Made",
        ref: entry.details || "Payment",
        debit: amount(entry.amount),
        credit: 0
      });
    });

  return rows.sort((a, b) => {
    if (a.date === "Opening") return -1;
    if (b.date === "Opening") return 1;
    return a.date.localeCompare(b.date);
  });
}

function renderCustomerLedger() {
  const select = document.querySelector("#customerLedgerSelect");
  const rows = customerLedgerRows(select.value);
  let running = 0;
  let sales = 0;
  let received = 0;
  let freight = 0;
  const html = rows.map(row => {
    running += amount(row.debit) - amount(row.credit);
    if (row.type === "Sales Invoice") sales += amount(row.debit);
    if (row.type === "Payment Received") received += amount(row.credit);
    if (row.type === "Freight Recovery") freight += amount(row.debit);
    return `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.ref)}</td>
        <td>${money(row.debit)}</td>
        <td>${money(row.credit)}</td>
        <td>${money(running)}</td>
      </tr>
    `;
  }).join("");
  const customer = getCustomer(select.value);
  document.querySelector("#customerLedgerOpening").textContent = money(customer?.opening || 0);
  document.querySelector("#customerLedgerSales").textContent = money(sales);
  document.querySelector("#customerLedgerReceived").textContent = money(received);
  document.querySelector("#customerLedgerFreight").textContent = money(freight);
  document.querySelector("#customerLedgerOutstanding").textContent = money(running);
  document.querySelector("#customerLedgerRows").innerHTML = rows.length ? html : emptyRow(6);
}

function renderSupplierLedger() {
  const select = document.querySelector("#supplierLedgerSelect");
  const rows = supplierLedgerRows(select.value);
  let running = 0;
  let purchases = 0;
  let paid = 0;
  const html = rows.map(row => {
    running += amount(row.credit) - amount(row.debit);
    if (row.type === "Purchase Invoice") purchases += amount(row.credit);
    if (row.type === "Payment Made") paid += amount(row.debit);
    return `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.ref)}</td>
        <td>${money(row.debit)}</td>
        <td>${money(row.credit)}</td>
        <td>${money(running)}</td>
      </tr>
    `;
  }).join("");
  const supplier = state.suppliers.find(item => item.id === select.value);
  document.querySelector("#supplierLedgerOpening").textContent = money(supplier?.opening || 0);
  document.querySelector("#supplierLedgerPurchases").textContent = money(purchases);
  document.querySelector("#supplierLedgerPaid").textContent = money(paid);
  document.querySelector("#supplierLedgerOutstanding").textContent = money(running);
  document.querySelector("#supplierLedgerRows").innerHTML = rows.length ? html : emptyRow(6);
}

function filteredJournalEntries() {
  const month = document.querySelector("#journalMonth").value;
  return state.journalEntries.filter(entry => !month || entry.date.startsWith(month));
}

function renderJournalBook() {
  const rows = filteredJournalEntries().sort((a, b) => a.date.localeCompare(b.date));
  document.querySelector("#journalRows").innerHTML = rows.length
    ? rows.map(entry => `
      <tr>
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(entry.voucherNo)}</td>
        <td>${escapeHtml(entry.description)}</td>
        <td>${escapeHtml(entry.debitAccount)}</td>
        <td>${escapeHtml(entry.creditAccount)}</td>
        <td>${money(entry.amount)}</td>
      </tr>
    `).join("")
    : emptyRow(6);
}

function accountBalances() {
  return state.journalEntries.reduce((balances, entry) => {
    if (!balances[entry.debitAccount]) balances[entry.debitAccount] = { debit: 0, credit: 0 };
    if (!balances[entry.creditAccount]) balances[entry.creditAccount] = { debit: 0, credit: 0 };
    balances[entry.debitAccount].debit += amount(entry.amount);
    balances[entry.creditAccount].credit += amount(entry.amount);
    return balances;
  }, {});
}

function financialSummary() {
  const t = totals();
  const salaryExpense = state.salaryExpenses.reduce((sum, item) => sum + amount(item.amount), 0);
  const freightExpense = state.entries
    .filter(entry => entry.type === "driver")
    .reduce((sum, entry) => sum + amount(entry.amount), 0);
  const otherExpenses = state.entries
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + amount(entry.amount), 0);
  const cogs = t.purchase;
  const grossProfit = t.sale - cogs;
  const totalExpenses = otherExpenses + freightExpense + salaryExpense;
  const netProfit = grossProfit - totalExpenses;
  const cashBalance = t.receive - t.payment - otherExpenses - freightExpense - salaryExpense;
  const bankBalanceValue = totalBankBalance();

  return {
    sales: t.sale,
    cogs,
    grossProfit,
    expenses: otherExpenses,
    freightExpense,
    salaryExpense,
    totalExpenses,
    netProfit,
    receivables: totalReceivables(),
    payables: totalPayables(),
    cashBalance,
    bankBalance: bankBalanceValue,
    inventory: stockValue()
  };
}

function renderFinancials() {
  const balances = accountBalances();
  let totalDebit = 0;
  let totalCredit = 0;
  const trialRows = Object.entries(balances).sort(([a], [b]) => a.localeCompare(b)).map(([account, value]) => {
    const netDebit = Math.max(0, amount(value.debit) - amount(value.credit));
    const netCredit = Math.max(0, amount(value.credit) - amount(value.debit));
    totalDebit += netDebit;
    totalCredit += netCredit;
    return `<tr><td>${escapeHtml(account)}</td><td>${money(netDebit)}</td><td>${money(netCredit)}</td></tr>`;
  });
  document.querySelector("#trialBalanceRows").innerHTML = trialRows.length ? trialRows.join("") : emptyRow(3);
  document.querySelector("#trialBalanceStatus").innerHTML = `Total Debit: <strong>${money(totalDebit)}</strong> | Total Credit: <strong>${money(totalCredit)}</strong> | ${Math.abs(totalDebit - totalCredit) < 0.01 ? "Balanced" : "Difference: " + money(totalDebit - totalCredit)}`;

  const summary = financialSummary();
  document.querySelector("#fNetProfit").textContent = money(summary.netProfit);
  document.querySelector("#fReceivables").textContent = money(summary.receivables);
  document.querySelector("#fPayables").textContent = money(summary.payables);
  document.querySelector("#fCashBalance").textContent = money(summary.cashBalance);
  document.querySelector("#fBankBalance").textContent = money(summary.bankBalance);

  document.querySelector("#profitLossRows").innerHTML = [
    ["Sales", summary.sales],
    ["Cost of Goods Sold", summary.cogs],
    ["Gross Profit", summary.grossProfit],
    ["Expenses", summary.expenses],
    ["Freight Expense", summary.freightExpense],
    ["Salary Expense", summary.salaryExpense],
    ["Net Profit", summary.netProfit]
  ].map(([label, value]) => `<tr><td>${label}</td><td>${money(value)}</td></tr>`).join("");

  document.querySelector("#balanceSheetAssetRows").innerHTML = [
    ["Cash", summary.cashBalance],
    ["Bank", summary.bankBalance],
    ["Inventory", summary.inventory],
    ["Accounts Receivable", summary.receivables]
  ].map(([label, value]) => `<tr><td>${label}</td><td>${money(value)}</td></tr>`).join("");

  const totalLiabilities = summary.payables;
  const retainedEarnings = summary.netProfit;
  const assetsTotal = summary.cashBalance + summary.bankBalance + summary.inventory + summary.receivables;
  const capital = assetsTotal - totalLiabilities - retainedEarnings;
  document.querySelector("#balanceSheetLiabilityRows").innerHTML = [
    ["Accounts Payable", summary.payables],
    ["Outstanding Expenses", 0],
    ["Capital", capital],
    ["Retained Earnings", retainedEarnings]
  ].map(([label, value]) => `<tr><td>${label}</td><td>${money(value)}</td></tr>`).join("");
}

function renderDispatches() {
  document.querySelector("#dispatchRows").innerHTML = state.dispatches.length
    ? state.dispatches.map(item => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(customerName(item.customerId))}</td>
        <td>${escapeHtml(item.vehicle)}</td>
        <td>${escapeHtml(item.goods)}</td>
        <td>${money(item.quantity)}</td>
        <td>${money(item.freight)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td><button class="danger" data-delete-dispatch="${item.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(8);
}

function renderProductions() {
  document.querySelector("#productionRows").innerHTML = state.productions.length
    ? state.productions.map(item => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(getProduct(item.productId)?.name || "Product")}</td>
        <td>${money(item.quantity)}</td>
        <td>${money(item.totalCost)}</td>
        <td>${money(item.unitCost)}</td>
        <td><button class="danger" data-delete-production="${item.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(6);

  const last = state.productions[0];
  document.querySelector("#costingBox").innerHTML = last
    ? `Last production unit cost: <strong>${money(last.unitCost)}</strong>. Suggested selling price with 20% margin: <strong>${money(last.unitCost * 1.2)}</strong>.`
    : "Add production data to calculate unit cost and suggested selling price.";
}

function renderStaff() {
  document.querySelector("#staffRows").innerHTML = state.staff.length
    ? state.staff.map(member => `
      <tr>
        <td>${escapeHtml(member.name)}</td>
        <td>${escapeHtml(member.role)}</td>
        <td>${escapeHtml(member.phone)}</td>
        <td>${money(member.salary)}</td>
        <td><button class="danger" data-delete-staff="${member.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(5);
}

function salaryExpenseLabel(type) {
  return {
    director: "Director Salary",
    labour: "Labour Salary",
    mistry: "Mistry Expense",
    misc: "Misc Expense"
  }[type] || "Expense";
}

function filteredSalaryExpenses() {
  const month = document.querySelector("#salaryExpenseMonth").value;
  return state.salaryExpenses.filter(item => !month || item.date.startsWith(month));
}

function renderSalaryExpenses() {
  const rows = filteredSalaryExpenses();
  const totalsByType = rows.reduce((sum, item) => {
    sum[item.type] = (sum[item.type] || 0) + amount(item.amount);
    return sum;
  }, {});

  document.querySelector("#salaryDirectorTotal").textContent = money(totalsByType.director || 0);
  document.querySelector("#salaryLabourTotal").textContent = money(totalsByType.labour || 0);
  document.querySelector("#salaryMistryTotal").textContent = money(totalsByType.mistry || 0);
  document.querySelector("#salaryMiscTotal").textContent = money(totalsByType.misc || 0);

  document.querySelector("#salaryExpenseRows").innerHTML = rows.length
    ? rows.map(item => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${salaryExpenseLabel(item.type)}</td>
        <td>${escapeHtml(item.person)}</td>
        <td>${escapeHtml(item.details)}</td>
        <td>${money(item.amount)}</td>
        <td><button class="danger" data-delete-salary-expense="${item.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(6);
}

function renderBankAccounts() {
  document.querySelector("#bankAccountRows").innerHTML = state.bankAccounts.length
    ? state.bankAccounts.map(account => `
      <tr>
        <td>${escapeHtml(account.bankName)}</td>
        <td>${escapeHtml(account.title)}</td>
        <td>${escapeHtml(account.accountNumber)}</td>
        <td>${money(account.opening)}</td>
        <td>${money(bankBalance(account))}</td>
        <td><button class="danger" data-delete-bank-account="${account.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(6);
}

function filteredBankTransactions() {
  const month = document.querySelector("#bankLedgerMonth").value;
  return state.bankTransactions.filter(item => !month || item.date.startsWith(month));
}

function renderBankTransactions() {
  const rows = filteredBankTransactions();
  document.querySelector("#bankTransactionRows").innerHTML = rows.length
    ? rows.map(item => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(bankAccountName(item.bankId))}</td>
        <td>${escapeHtml(item.type.replaceAll("_", " "))}</td>
        <td>${escapeHtml(item.details)}</td>
        <td>${money(item.amount)}</td>
        <td><button class="danger" data-delete-bank-transaction="${item.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(6);
}

function filteredInventoryMovements() {
  const productId = document.querySelector("#inventoryProductFilter").value;
  const month = document.querySelector("#inventoryMovementMonth").value;
  return [...state.inventoryMovements]
    .filter(item => !productId || item.productId === productId)
    .filter(item => !month || item.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderInventoryMovementLedger() {
  const rows = filteredInventoryMovements();
  let running = 0;
  const chronological = [...rows].reverse().map(item => {
    running += movementQuantitySign(item.type) * amount(item.quantity);
    return { ...item, running };
  }).reverse();

  document.querySelector("#inventoryMovementRows").innerHTML = chronological.length
    ? chronological.map(item => {
      const isIn = movementDirection(item.type) === "in";
      return `
        <tr>
          <td>${escapeHtml(item.date)}</td>
          <td>${escapeHtml(getProduct(item.productId)?.name || "Unknown product")}</td>
          <td>${escapeHtml(movementTypeLabel(item.type))}</td>
          <td>${escapeHtml(item.refNumber || item.sourceType)}</td>
          <td>${escapeHtml(item.partyName || "-")}</td>
          <td>${isIn ? money(item.quantity) : "0"}</td>
          <td>${isIn ? "0" : money(item.quantity)}</td>
          <td>${money(item.rate)}</td>
          <td>${money(item.running)}</td>
        </tr>
      `;
    }).join("")
    : emptyRow(9);
}

function renderProductStockMovementReport() {
  const rows = state.products.map(product => {
    const movements = state.inventoryMovements.filter(item => item.productId === product.id);
    const stockIn = movements
      .filter(item => movementDirection(item.type) === "in")
      .reduce((sum, item) => sum + amount(item.quantity), 0);
    const stockOut = movements
      .filter(item => movementDirection(item.type) === "out")
      .reduce((sum, item) => sum + amount(item.quantity), 0);
    return {
      product,
      stockIn,
      stockOut,
      netMovement: stockIn - stockOut,
      currentStock: amount(product.stock),
      stockValue: amount(product.stock) * amount(product.cost)
    };
  });

  document.querySelector("#productStockMovementRows").innerHTML = rows.length
    ? rows.map(row => `
      <tr>
        <td>${escapeHtml(row.product.name)}</td>
        <td>${escapeHtml(row.product.category || "-")}</td>
        <td>${money(row.stockIn)}</td>
        <td>${money(row.stockOut)}</td>
        <td>${money(row.netMovement)}</td>
        <td>${money(row.currentStock)}</td>
        <td>${money(row.stockValue)}</td>
      </tr>
    `).join("")
    : emptyRow(7);
}

function renderSalesTypeReports() {
  const stockRows = state.salesInvoices.filter(invoice => !isDirectDispatchSale(invoice));
  const directRows = state.salesInvoices.filter(invoice => isDirectDispatchSale(invoice));
  const rowHtml = rows => rows.length
    ? [...rows].sort((a, b) => b.date.localeCompare(a.date)).map(invoice => `
      <tr>
        <td>${escapeHtml(invoice.date)}</td>
        <td>${escapeHtml(invoice.number)}</td>
        <td>${escapeHtml(customerName(invoice.customerId))}</td>
        <td>${escapeHtml(invoice.details)}</td>
        <td>${money(invoice.quantity)}</td>
        <td>${money(invoice.total)}</td>
      </tr>
    `).join("")
    : emptyRow(6);

  document.querySelector("#stockSalesReportRows").innerHTML = rowHtml(stockRows);
  document.querySelector("#directDispatchSalesReportRows").innerHTML = rowHtml(directRows);
}

function renderReports() {
  const t = totals();
  const stockSales = state.salesInvoices
    .filter(invoice => !isDirectDispatchSale(invoice))
    .reduce((sum, invoice) => sum + amount(invoice.subtotal), 0);
  const directDispatchSales = state.salesInvoices
    .filter(invoice => isDirectDispatchSale(invoice))
    .reduce((sum, invoice) => sum + amount(invoice.subtotal), 0);
  const outstanding = state.customers.reduce((sum, customer) => sum + Math.max(0, customerBalance(customer)), 0);
  const freightRecovery = state.salesInvoices
    .filter(invoice => invoice.freightCase === "recoverable")
    .reduce((sum, invoice) => sum + amount(invoice.freight), 0);
  const freightExpense = state.salesInvoices
    .filter(invoice => invoice.freightCase === "company_expense")
    .reduce((sum, invoice) => sum + amount(invoice.freight), 0) + t.driver;
  const freight = freightRecovery + freightExpense;
  const production = state.productions.reduce((sum, item) => sum + amount(item.totalCost), 0);
  const salaryExpense = state.salaryExpenses.reduce((sum, item) => sum + amount(item.amount), 0);
  const estimatedProfit = t.sale - t.purchase - t.expense - t.driver;

  document.querySelector("#rSales").textContent = money(t.sale);
  document.querySelector("#rStockSales").textContent = money(stockSales);
  document.querySelector("#rDirectDispatchSales").textContent = money(directDispatchSales);
  document.querySelector("#rPurchases").textContent = money(t.purchase);
  document.querySelector("#rProfit").textContent = money(estimatedProfit);
  document.querySelector("#rOutstanding").textContent = money(outstanding);
  document.querySelector("#rFreight").textContent = money(freight);
  document.querySelector("#rFreightRecovery").textContent = money(freightRecovery);
  document.querySelector("#rFreightExpense").textContent = money(freightExpense);
  document.querySelector("#rProduction").textContent = money(production);
  document.querySelector("#rSalaryExpense").textContent = money(salaryExpense);
  document.querySelector("#rBankBalance").textContent = money(totalBankBalance());
  document.querySelector("#erpStatusBox").innerHTML = `
    ERP status: <strong>Prototype online</strong><br>
    Backend: <strong>Supabase JSON sync plus normalized table export ready</strong><br>
    Security: local login and Supabase auth supported<br>
    Backup: browser backup/export and cloud sync available
  `;
  renderSalesTypeReports();
  renderInventoryMovementLedger();
  renderProductStockMovementReport();
}

function renderAuditLogs() {
  document.querySelector("#auditRows").innerHTML = state.auditLogs.length
    ? state.auditLogs.map(log => `
      <tr>
        <td>${escapeHtml(log.time)}</td>
        <td>${escapeHtml(log.action)}</td>
        <td>${escapeHtml(log.details)}</td>
      </tr>
    `).join("")
    : emptyRow(3);
}

function filteredEntries() {
  const search = document.querySelector("#entrySearch").value.trim().toLowerCase();
  const month = document.querySelector("#entryMonth").value;

  return state.entries.filter(entry => {
    const haystack = `${customerName(entry.customerId)} ${entry.details} ${labels[entry.type]}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesMonth = !month || entry.date.startsWith(month);
    return matchesSearch && matchesMonth;
  });
}

function renderEntries() {
  const rows = filteredEntries().sort((a, b) => b.date.localeCompare(a.date));

  document.querySelector("#entryRows").innerHTML = rows.length
    ? rows.map(entry => `
      <tr>
        <td>${entry.date}</td>
        <td>${labels[entry.type]}</td>
        <td>${escapeHtml(customerName(entry.customerId))}</td>
        <td>${escapeHtml(entry.details)}</td>
        <td>${money(entry.quantity)}</td>
        <td>${money(entry.rate)}</td>
        <td>${money(entry.amount)}</td>
        <td><button class="danger" data-delete-entry="${entry.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(8);
}

function renderQuotations() {
  document.querySelector("#quotationRows").innerHTML = state.quotations.length
    ? [...state.quotations].sort((a, b) => b.date.localeCompare(a.date)).map(quotation => `
      <tr>
        <td>${quotation.date}</td>
        <td>${escapeHtml(customerName(quotation.customerId))}</td>
        <td>${money(quotation.total)}</td>
        <td>${escapeHtml(quotation.note)}</td>
        <td><button class="danger" data-delete-quotation="${quotation.id}" type="button">Delete</button></td>
      </tr>
    `).join("")
    : emptyRow(5);
}

function invoiceItems() {
  return [...document.querySelectorAll(".invoice-item")].map(row => {
    const description = row.querySelector("[data-item='description']").value.trim();
    const quantity = amount(row.querySelector("[data-item='quantity']").value);
    const rate = amount(row.querySelector("[data-item='rate']").value);
    return { description, quantity, rate, total: quantity * rate };
  }).filter(item => item.description || item.quantity || item.rate);
}

function invoiceTotals(items, discount, taxPercent, shipping) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxable = Math.max(0, subtotal - amount(discount));
  const tax = taxable * amount(taxPercent) / 100;
  const grandTotal = taxable + tax + amount(shipping);
  return { subtotal, tax, grandTotal };
}

function salesInvoiceNumber() {
  return `SI-${String(state.salesInvoices.length + 1).padStart(4, "0")}`;
}

function purchaseInvoiceNumber() {
  return `PI-${String(state.purchaseInvoices.length + 1).padStart(4, "0")}`;
}

function invoiceMath(quantity, rate, taxPercent = 0, discount = 0, freight = 0) {
  const subtotal = amount(quantity) * amount(rate);
  const taxable = Math.max(0, subtotal - amount(discount));
  const tax = taxable * amount(taxPercent) / 100;
  return {
    subtotal,
    tax,
    total: taxable + tax + amount(freight)
  };
}

function salesInvoiceNumberExists(number, ignoreId = "") {
  const value = String(number || "").trim().toLowerCase();
  return state.salesInvoices.some(invoice => invoice.id !== ignoreId && String(invoice.number).toLowerCase() === value)
    || state.invoices.some(invoice => String(invoice.number).toLowerCase() === value);
}

function purchaseInvoiceNumberExists(number, ignoreId = "") {
  const value = String(number || "").trim().toLowerCase();
  return state.purchaseInvoices.some(invoice => invoice.id !== ignoreId && String(invoice.number).toLowerCase() === value);
}

function hasEnoughStock(productId, quantity) {
  const product = getProduct(productId);
  return !product || amount(product.stock) >= amount(quantity);
}

function productHasReferences(productId) {
  return state.entries.some(entry => entry.productId === productId)
    || state.salesInvoices.some(invoice => invoice.productId === productId)
    || state.purchaseInvoices.some(invoice => invoice.productId === productId)
    || state.productions.some(item => item.productId === productId);
}

function customerHasReferences(customerId) {
  return state.entries.some(entry => entry.customerId === customerId)
    || state.salesInvoices.some(invoice => invoice.customerId === customerId)
    || state.invoices.some(invoice => invoice.customerId === customerId)
    || state.dispatches.some(item => item.customerId === customerId);
}

function supplierHasReferences(supplierId) {
  return state.entries.some(entry => entry.supplierId === supplierId)
    || state.purchaseInvoices.some(invoice => invoice.supplierId === supplierId);
}

function canReversePurchaseInvoice(invoice) {
  const product = getProduct(invoice?.productId);
  return !product || amount(product.stock) >= amount(invoice.quantity);
}

function removeRelatedAccounting(sourceId, refNumber = "") {
  state.journalEntries = state.journalEntries.filter(entry => entry.sourceId !== sourceId);
  state.entries = state.entries.filter(entry => {
    if (entry.sourceId === sourceId) return false;
    return !(refNumber && String(entry.details || "").includes(refNumber));
  });
}

function backfillInventoryMovements() {
  let changed = false;
  const addMovement = data => {
    const before = state.inventoryMovements.length;
    recordInventoryMovement(data);
    if (state.inventoryMovements.length !== before) changed = true;
  };

  state.purchaseInvoices.forEach(invoice => addMovement({
    date: invoice.date,
    productId: invoice.productId,
    type: "purchase_in",
    quantity: invoice.quantity,
    rate: invoice.rate,
    amount: invoice.subtotal,
    sourceType: "purchase_invoice",
    sourceId: invoice.id,
    refNumber: invoice.number,
    partyName: supplierName(invoice.supplierId),
    details: invoice.details
  }));

  state.salesInvoices
    .filter(invoice => !isDirectDispatchSale(invoice))
    .forEach(invoice => addMovement({
      date: invoice.date,
      productId: invoice.productId,
      type: "sale_out",
      quantity: invoice.quantity,
      rate: invoice.rate,
      amount: invoice.subtotal,
      sourceType: "sales_invoice",
      sourceId: invoice.id,
      refNumber: invoice.number,
      partyName: customerName(invoice.customerId),
      details: invoice.details
    }));

  state.productions.forEach(item => addMovement({
    date: item.date,
    productId: item.productId,
    type: "production_in",
    quantity: item.quantity,
    rate: item.unitCost,
    amount: item.totalCost,
    sourceType: "production",
    sourceId: item.id,
    refNumber: "Production",
    partyName: "Production",
    details: "Production output"
  }));

  state.entries
    .filter(entry => entry.productId && !entry.sourceType && ["sale", "purchase"].includes(entry.type))
    .forEach(entry => addMovement({
      date: entry.date,
      productId: entry.productId,
      type: entry.type === "purchase" ? "purchase_in" : "sale_out",
      quantity: entry.quantity,
      rate: entry.rate,
      amount: entry.amount,
      sourceType: "entry",
      sourceId: entry.id,
      refNumber: labels[entry.type],
      partyName: entry.supplierId ? supplierName(entry.supplierId) : customerName(entry.customerId),
      details: entry.details
    }));

  state.products.forEach(product => {
    if (movementExists("stock_migration", product.id, product.id)) return;
    const netMovement = state.inventoryMovements
      .filter(item => item.productId === product.id)
      .reduce((sum, item) => sum + movementQuantitySign(item.type) * amount(item.quantity), 0);
    const difference = amount(product.stock) - netMovement;
    if (!difference) return;
    addMovement({
      date: today(),
      productId: product.id,
      type: difference > 0 ? "adjustment_in" : "adjustment_out",
      quantity: Math.abs(difference),
      rate: product.cost,
      amount: Math.abs(difference) * amount(product.cost),
      sourceType: "stock_migration",
      sourceId: product.id,
      refNumber: "Opening/Migration",
      partyName: "System",
      details: "Opening stock balance created during inventory ledger migration"
    });
  });

  if (changed) audit("Inventory movement migration", "Stock ledger generated from existing ERP records");
  return changed;
}

function voucherNumber(prefix = "JV") {
  return `${prefix}-${String(state.journalEntries.length + 1).padStart(5, "0")}`;
}

function postJournal(date, description, debitAccount, creditAccount, value, sourceType = "manual", sourceId = "") {
  const entry = {
    id: uid(),
    date,
    voucherNo: voucherNumber(),
    description,
    debitAccount,
    creditAccount,
    amount: amount(value),
    sourceType,
    sourceId
  };
  state.journalEntries.push(entry);
  audit("Journal entry posted", `${entry.voucherNo} ${debitAccount} Dr / ${creditAccount} Cr ${money(value)}`);
  if (document.querySelector("#toastContainer")) {
    showToast("Financial Statements Updated");
  }
  return entry;
}

function postSalesInvoiceJournal(invoice) {
  postJournal(
    invoice.date,
    `Sales Invoice ${invoice.number} - ${customerName(invoice.customerId)}`,
    `${customerName(invoice.customerId)} A/C`,
    "Sales A/C",
    amount(invoice.subtotal) + amount(invoice.tax) - amount(invoice.discount),
    "sales_invoice",
    invoice.id
  );
  if (invoice.freightCase === "recoverable" && amount(invoice.freight)) {
    postJournal(
      invoice.date,
      `Freight Recovery ${invoice.number}`,
      `${customerName(invoice.customerId)} A/C`,
      "Freight Recovery A/C",
      invoice.freight,
      "freight_recovery",
      invoice.id
    );
  }
  if (invoice.freightCase === "company_expense" && amount(invoice.freight)) {
    postJournal(
      invoice.date,
      `Freight Expense ${invoice.number}`,
      "Freight Expense A/C",
      "Cash/Bank A/C",
      invoice.freight,
      "freight_expense",
      invoice.id
    );
  }
}

function postPurchaseInvoiceJournal(invoice) {
  const supplier = state.suppliers.find(item => item.id === invoice.supplierId);
  postJournal(
    invoice.date,
    `Purchase Invoice ${invoice.number} - ${supplier?.name || "Supplier"}`,
    "Purchase A/C",
    `${supplier?.name || "Supplier"} A/C`,
    invoice.total,
    "purchase_invoice",
    invoice.id
  );
}

function journalExists(sourceType, sourceId) {
  return state.journalEntries.some(entry => entry.sourceType === sourceType && entry.sourceId === sourceId);
}

function backfillAccountingFromExistingData() {
  let changed = false;
  state.invoices.forEach(invoice => {
    if (!state.salesInvoices.some(item => item.legacyInvoiceId === invoice.id || item.number === invoice.number)) {
      const legacySalesInvoice = createSalesInvoiceFromLegacyInvoice(invoice);
      state.salesInvoices.push(legacySalesInvoice);
      changed = true;
    }
  });
  state.salesInvoices.forEach(invoice => {
    if (!state.entries.some(entry => entry.sourceId === invoice.id || String(entry.details || "").includes(invoice.number))) {
      state.entries.push({
        id: uid(),
        date: invoice.date,
        type: "sale",
        customerId: invoice.customerId,
        supplierId: "",
        productId: invoice.productId || "",
        sourceType: invoice.legacyInvoiceId ? "legacy_invoice" : "sales_invoice",
        sourceId: invoice.id,
        details: `${invoice.legacyInvoiceId ? "Legacy" : "Sales"} Invoice ${invoice.number} - ${invoice.details}`,
        quantity: amount(invoice.quantity) || 1,
        rate: amount(invoice.rate) || amount(invoice.subtotal),
        amount: amount(invoice.subtotal)
      });
      if (invoice.freightCase === "recoverable" && amount(invoice.freight)) {
        state.entries.push({
          id: uid(),
          date: invoice.date,
          type: "sale",
          customerId: invoice.customerId,
          supplierId: "",
          productId: "",
          sourceType: "freight_recovery",
          sourceId: invoice.id,
          details: `Freight recovery ${invoice.number}`,
          quantity: 1,
          rate: amount(invoice.freight),
          amount: amount(invoice.freight)
        });
      }
      changed = true;
    }
    if (!journalExists("sales_invoice", invoice.id)) {
      postSalesInvoiceJournal(invoice);
      changed = true;
    }
  });
  state.purchaseInvoices.forEach(invoice => {
    if (!state.entries.some(entry => entry.sourceId === invoice.id || String(entry.details || "").includes(invoice.number))) {
      state.entries.push({
        id: uid(),
        date: invoice.date,
        type: "purchase",
        customerId: "",
        supplierId: invoice.supplierId,
        productId: invoice.productId,
        sourceType: "purchase_invoice",
        sourceId: invoice.id,
        details: `Purchase Invoice ${invoice.number} - ${invoice.details}`,
        quantity: amount(invoice.quantity) || 1,
        rate: amount(invoice.rate),
        amount: amount(invoice.subtotal)
      });
      changed = true;
    }
    if (!journalExists("purchase_invoice", invoice.id)) {
      postPurchaseInvoiceJournal(invoice);
      changed = true;
    }
  });
  if (changed) {
    audit("Accounting backfill", "Historical invoices connected to ledger/journal architecture");
    saveState();
  }
}

function invoiceFormData() {
  const form = document.querySelector("#invoiceForm");
  const data = formData(form);
  const customer = getCustomer(data.customerId);
  const items = invoiceItems();
  const invoiceTotal = invoiceTotals(items, data.discount, data.taxPercent, data.shipping);
  return {
    id: uid(),
    number: data.number.trim(),
    date: data.date,
    dueDate: data.dueDate,
    salesType: data.salesType || "stock",
    sellerName: data.sellerName.trim(),
    sellerAddress: data.sellerAddress.trim(),
    customerId: data.customerId,
    buyerName: data.buyerName.trim() || customer?.name || "General",
    buyerAddress: data.buyerAddress.trim() || customer?.address || "",
    items,
    discount: amount(data.discount),
    taxPercent: amount(data.taxPercent),
    shipping: amount(data.shipping),
    terms: data.terms.trim(),
    subtotal: invoiceTotal.subtotal,
    tax: invoiceTotal.tax,
    grandTotal: invoiceTotal.grandTotal
  };
}

function invoiceShareText(invoice) {
  const items = invoice.items.length
    ? invoice.items.map(item => `- ${item.description}: ${money(item.quantity)} x ${money(item.rate)} = ${money(item.total)}`).join("\n")
    : "- No items";

  return [
    `${invoice.sellerName || "Eissa Packages"} Invoice`,
    `Invoice No: ${invoice.number}`,
    `Date: ${invoice.date}`,
    `Sales Type: ${salesTypeLabel(invoice.salesType)}`,
    `Customer: ${invoice.buyerName}`,
    "",
    "Items:",
    items,
    "",
    `Subtotal: ${money(invoice.subtotal)}`,
    `Discount: ${money(invoice.discount)}`,
    `Tax: ${money(invoice.tax)}`,
    `Delivery / Freight: ${money(invoice.shipping)}`,
    `Total: ${money(invoice.grandTotal)}`,
    "",
    invoice.terms || "Thank you for your business."
  ].join("\n");
}

function getSavedInvoice(invoiceId) {
  return state.invoices.find(invoice => invoice.id === invoiceId) || null;
}

function activeInvoice() {
  return getSavedInvoice(selectedInvoiceId) || invoiceFormData();
}

function selectSavedInvoice(invoiceId) {
  const invoice = getSavedInvoice(invoiceId);
  if (!invoice) return null;
  selectedInvoiceId = invoiceId;
  renderInvoices();
  renderInvoicePreview(invoice);
  return invoice;
}

function printInvoice(invoiceId = selectedInvoiceId) {
  const invoice = invoiceId ? selectSavedInvoice(invoiceId) : activeInvoice();
  if (!invoice) {
    alert("Please select a saved invoice first.");
    return;
  }
  renderInvoicePreview(invoice);
  document.body.classList.add("print-invoice");
  window.print();
  setTimeout(() => document.body.classList.remove("print-invoice"), 250);
}

function emailInvoice(invoiceId = selectedInvoiceId) {
  const invoice = invoiceId ? selectSavedInvoice(invoiceId) : activeInvoice();
  if (!invoice) {
    alert("Please select a saved invoice first.");
    return;
  }
  const subject = `${invoice.sellerName || "Eissa Packages"} Invoice ${invoice.number}`;
  const body = invoiceShareText(invoice);
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function whatsappInvoice(invoiceId = selectedInvoiceId) {
  const invoice = invoiceId ? selectSavedInvoice(invoiceId) : activeInvoice();
  if (!invoice) {
    alert("Please select a saved invoice first.");
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(invoiceShareText(invoice))}`, "_blank");
}

function createInvoiceFromAssistant(customerNameText, itemNameText, qtyText, rateText, freightText) {
  const customerNameValue = String(customerNameText || "").trim();
  const itemName = String(itemNameText || "").trim();
  let customer = findCustomerByName(customerNameValue);
  if (!customer) {
    customer = { id: uid(), name: customerNameValue, phone: "", address: "", opening: 0 };
    state.customers.push(customer);
    audit("Customer auto-created by AI", customer.name);
  }

  const product = findProductByName(itemName);
  const quantity = amount(qtyText || 1);
  const rate = amount(rateText || product?.price || 0);
  const freight = amount(freightText || 0);
  if (product && !hasEnoughStock(product.id, quantity)) {
    return `Stock is not enough for ${product.name}. Available stock: ${money(product.stock)}.`;
  }
  const itemTotal = quantity * rate;
  const tax = itemTotal * amount(state.settings.defaultTax) / 100;
  const invoiceNumber = nextInvoiceNumber();
  if (salesInvoiceNumberExists(invoiceNumber)) {
    return `Invoice number ${invoiceNumber} already exists. Please try again.`;
  }
  const invoice = {
    id: uid(),
    number: invoiceNumber,
    date: today(),
    dueDate: "",
    salesType: product ? "stock" : "direct_dispatch",
    sellerName: state.settings.companyName || "Eissa Packages",
    sellerAddress: state.settings.companyAddress || "Quality Packaging Solutions",
    customerId: customer.id,
    buyerName: customer.name,
    buyerAddress: customer.address || "",
    items: [{ description: itemName, quantity, rate, total: itemTotal }],
    discount: 0,
    taxPercent: amount(state.settings.defaultTax),
    shipping: freight,
    terms: "Generated by AI Assistant.",
    subtotal: itemTotal,
    tax,
    grandTotal: itemTotal + freight + tax
  };
  const salesInvoice = {
    id: uid(),
    legacyInvoiceId: invoice.id,
    number: invoice.number,
    date: invoice.date,
    customerId: customer.id,
    productId: product?.id || "",
    salesType: product ? "stock" : "direct_dispatch",
    details: itemName,
    quantity,
    rate,
    taxPercent: invoice.taxPercent,
    discount: 0,
    freightCase: freight ? "recoverable" : "customer_direct",
    freight,
    subtotal: itemTotal,
    tax,
    total: invoice.grandTotal
  };

  state.invoices.push(invoice);
  state.salesInvoices.push(salesInvoice);
  state.entries.push({
    id: uid(),
    date: today(),
    type: "sale",
    customerId: customer.id,
    productId: product?.id || "",
    details: itemName,
    quantity,
    rate,
    amount: itemTotal,
    sourceType: "sales_invoice",
    sourceId: salesInvoice.id
  });
  if (freight) {
    state.entries.push({
      id: uid(),
      date: today(),
      type: "sale",
      customerId: customer.id,
      productId: "",
      details: `Freight Recovery ${invoice.number}`,
      quantity: 1,
      rate: freight,
      amount: freight,
      sourceType: "freight_recovery",
      sourceId: salesInvoice.id
    });
  }
  if (product) adjustProductStock(product.id, "sale", quantity);
  if (product) {
    recordInventoryMovement({
      date: invoice.date,
      productId: product.id,
      type: "sale_out",
      quantity,
      rate,
      amount: itemTotal,
      sourceType: "sales_invoice",
      sourceId: salesInvoice.id,
      refNumber: invoice.number,
      partyName: customer.name,
      details: itemName
    });
  }
  postSalesInvoiceJournal(salesInvoice);
  audit("Invoice generated by AI", `${invoice.number} ${customer.name} ${money(invoice.grandTotal)}`);
  saveState();
  renderAll();
  return `Invoice created: ${invoice.number}\nCustomer: ${customer.name}\nItem: ${itemName}\nQty: ${money(quantity)}\nRate: ${money(rate)}\nTotal: ${money(invoice.grandTotal)}\nOpen Invoices tab to print, save PDF, email or WhatsApp.`;
}

function createSalesInvoiceFromLegacyInvoice(invoice) {
  const subtotal = amount(invoice.subtotal);
  return {
    id: uid(),
    legacyInvoiceId: invoice.id,
    number: invoice.number,
    date: invoice.date,
    customerId: invoice.customerId,
    productId: "",
    salesType: invoice.salesType || "stock",
    details: `Invoice ${invoice.number}`,
    quantity: 1,
    rate: subtotal,
    taxPercent: amount(invoice.taxPercent),
    discount: amount(invoice.discount),
    freightCase: amount(invoice.shipping) ? "recoverable" : "customer_direct",
    freight: amount(invoice.shipping),
    subtotal,
    tax: amount(invoice.tax),
    total: amount(invoice.grandTotal)
  };
}

function renderInvoicePreview(invoice = activeInvoice()) {
  document.querySelector("#invoiceGrandTotal").textContent = money(invoice.grandTotal);
  document.querySelector("#invoicePreview").innerHTML = `
    <div class="invoice-preview-header">
      <div>
        <div class="invoice-brand">
          <span class="brand-logo" aria-hidden="true">EP</span>
          <div>
            <h3>${escapeHtml(invoice.sellerName || "Eissa Packages")}</h3>
            <p>Quality Packaging Solutions</p>
          </div>
        </div>
        <p>${escapeHtml(invoice.sellerAddress)}</p>
      </div>
      <div>
        <h3>Invoice</h3>
        <p>Number: ${escapeHtml(invoice.number)}</p>
        <p>Date: ${escapeHtml(invoice.date)}</p>
        <p>Due Date: ${escapeHtml(invoice.dueDate)}</p>
        <p>Sales Type: ${escapeHtml(salesTypeLabel(invoice.salesType))}</p>
      </div>
    </div>
    <div class="invoice-preview-parties">
      <div>
        <h4>Bill To</h4>
        <p>${escapeHtml(invoice.buyerName)}</p>
        <p>${escapeHtml(invoice.buyerAddress)}</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${invoice.items.length ? invoice.items.map(item => `
          <tr><td>${escapeHtml(item.description)}</td><td>${money(item.quantity)}</td><td>${money(item.rate)}</td><td>${money(item.total)}</td></tr>
        `).join("") : emptyRow(4, "Add invoice items")}</tbody>
      </table>
    </div>
    <div class="invoice-preview-total">
      <div></div>
      <dl>
        <div><dt>Subtotal</dt><dd>${money(invoice.subtotal)}</dd></div>
        <div><dt>Discount</dt><dd>${money(invoice.discount)}</dd></div>
        <div><dt>Tax</dt><dd>${money(invoice.tax)}</dd></div>
        <div><dt>Delivery</dt><dd>${money(invoice.shipping)}</dd></div>
        <div><dt><strong>Total</strong></dt><dd><strong>${money(invoice.grandTotal)}</strong></dd></div>
      </dl>
    </div>
    <p>${escapeHtml(invoice.terms)}</p>
  `;
}

function renderInvoices() {
  document.querySelector("#invoiceRows").innerHTML = state.invoices.length
    ? [...state.invoices].sort((a, b) => b.date.localeCompare(a.date)).map(invoice => `
      <tr class="${invoice.id === selectedInvoiceId ? "selected-row" : ""}">
        <td>${escapeHtml(invoice.number)}</td>
        <td>${escapeHtml(invoice.date)}</td>
        <td>${escapeHtml(invoice.buyerName)}</td>
        <td>${money(invoice.grandTotal)}</td>
        <td>
          <button data-select-invoice="${invoice.id}" type="button">Open</button>
          <button data-print-saved-invoice="${invoice.id}" type="button">Print</button>
          <button data-pdf-saved-invoice="${invoice.id}" type="button">PDF</button>
          <button data-whatsapp-saved-invoice="${invoice.id}" type="button">WhatsApp</button>
          <button class="danger" data-delete-invoice="${invoice.id}" type="button">Delete</button>
        </td>
      </tr>
    `).join("")
    : emptyRow(5);
}

function renderMonthly() {
  const month = document.querySelector("#monthlyPicker").value || currentMonth();
  const entries = state.entries.filter(entry => entry.date.startsWith(month));
  const t = totals(entries);
  const expenses = t.driver + t.expense;

  document.querySelector("#monthSales").textContent = money(t.sale);
  document.querySelector("#monthPurchases").textContent = money(t.purchase);
  document.querySelector("#monthReceived").textContent = money(t.receive);
  document.querySelector("#monthPaid").textContent = money(t.payment);
  document.querySelector("#monthExpenses").textContent = money(expenses);
  document.querySelector("#monthNet").textContent = money(t.sale + t.receive - t.purchase - t.payment - expenses);

  document.querySelector("#monthlyRows").innerHTML = entries.length
    ? entries.sort((a, b) => a.date.localeCompare(b.date)).map(entry => `
      <tr>
        <td>${entry.date}</td>
        <td>${labels[entry.type]}</td>
        <td>${escapeHtml(customerName(entry.customerId))}</td>
        <td>${escapeHtml(entry.details)}</td>
        <td>${money(entry.amount)}</td>
      </tr>
    `).join("")
    : emptyRow(5);
}

function renderBalanceSheet() {
  document.querySelector("#balanceRows").innerHTML = state.customers.length
    ? state.customers.map(customer => {
      const customerEntries = state.entries.filter(entry => entry.customerId === customer.id);
      const t = totals(customerEntries);
      return `
        <tr>
          <td>${escapeHtml(customer.name)}</td>
          <td>${money(customer.opening)}</td>
          <td>${money(t.sale)}</td>
          <td>${money(t.receive)}</td>
          <td>${money(t.purchase)}</td>
          <td>${money(t.payment)}</td>
          <td>${money(customerBalance(customer))}</td>
        </tr>
      `;
    }).join("")
    : emptyRow(7);
}

function renderSettings() {
  const form = document.querySelector("#settingsForm");
  form.companyName.value = state.settings.companyName || "";
  form.companyPhone.value = state.settings.companyPhone || "";
  form.companyAddress.value = state.settings.companyAddress || "";
  form.taxNumber.value = state.settings.taxNumber || "";
  form.defaultTax.value = amount(state.settings.defaultTax);
  form.defaultLowStock.value = amount(state.settings.defaultLowStock || 5);
}

function renderGlobalSearch() {
  const query = document.querySelector("#globalSearch").value.trim().toLowerCase();
  const results = [];
  if (query) {
    state.customers
      .filter(customer => `${customer.name} ${customer.phone}`.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach(customer => results.push(`Customer: ${escapeHtml(customer.name)} - Balance ${money(customerBalance(customer))}`));
    state.products
      .filter(product => `${product.name} ${product.category} ${product.barcode}`.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach(product => results.push(`Product: ${escapeHtml(product.name)} - Stock ${money(product.stock)}`));
    state.invoices
      .filter(invoice => `${invoice.number} ${invoice.buyerName}`.toLowerCase().includes(query))
      .slice(0, 5)
      .forEach(invoice => results.push(`Invoice: ${escapeHtml(invoice.number)} - ${money(invoice.grandTotal)}`));
  }

  document.querySelector("#globalResults").innerHTML = results.length
    ? results.map(result => `<div class="search-hit">${result}</div>`).join("")
    : "";
}

function renderAll() {
  fillCustomerSelects();
  fillProductSelects();
  fillSupplierSelects();
  fillLedgerSelects();
  fillBankSelects();
  renderDashboard();
  renderCustomers();
  renderSuppliers();
  renderProducts();
  renderSalesInvoices();
  renderPurchaseInvoices();
  renderCustomerLedger();
  renderSupplierLedger();
  renderJournalBook();
  renderFinancials();
  renderDispatches();
  renderProductions();
  renderStaff();
  renderSalaryExpenses();
  renderBankAccounts();
  renderBankTransactions();
  renderReports();
  renderAuditLogs();
  renderEntries();
  renderInvoices();
  renderInvoicePreview();
  renderQuotations();
  renderMonthly();
  renderBalanceSheet();
  renderSettings();
  renderGlobalSearch();
}

function addAssistantMessage(role, text) {
  const chat = document.querySelector("#assistantChat");
  const bubble = document.createElement("div");
  bubble.className = `assistant-message ${role}`;
  bubble.textContent = text;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function showToast(message) {
  const container = document.querySelector("#toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function findCustomerByName(name) {
  const needle = String(name || "").trim().toLowerCase();
  return state.customers.find(customer => customer.name.toLowerCase() === needle)
    || state.customers.find(customer => customer.name.toLowerCase().includes(needle));
}

function findProductByName(name) {
  const needle = String(name || "").trim().toLowerCase();
  return state.products.find(product => product.name.toLowerCase() === needle)
    || state.products.find(product => product.name.toLowerCase().includes(needle));
}

function commandNumber(text, key, fallback = 0) {
  const match = text.match(new RegExp(`${key}\\s+([0-9.]+)`, "i"));
  return match ? amount(match[1]) : fallback;
}

function handleAssistantCommand(rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (!text) return "Type a question or command.";

  if (lower.includes("invoice") && (lower.includes("how") || lower.includes("help") || lower.includes("create"))) {
    return [
      "To create an invoice:",
      "1. Open Invoices.",
      "2. Select or type the customer.",
      "3. Add item description, quantity and rate.",
      "4. Add discount, tax or driver charge if needed.",
      "5. Click Save Invoice, then Print Invoice.",
      "",
      "Example: for 12,000 ML at 130,000 per 1,000 ML, enter Qty 12 and Rate 130000."
    ].join("\n");
  }

  if ((lower.includes("invoice") || lower.includes("bill")) && (lower.includes("bana") || lower.includes("banado") || lower.includes("bana do"))) {
    const hasDetails = lower.includes("qty") || lower.includes("quantity") || lower.includes("rate") || lower.includes("item");
    if (!hasDetails) {
      return [
        "Invoice banaane ke liye customer, item, quantity aur rate zaroori hain.",
        "",
        "Aap is tarah bolen:",
        "Ali ko Drip qty 12 rate 90 invoice bana do",
        "",
        "Ya:",
        "create invoice for Ali item Drip qty 12 rate 90"
      ].join("\n");
    }
  }

  if (lower.includes("dashboard") || lower.includes("report")) {
    return `Dashboard summary: Sales ${money(totals().sale)}, Purchases ${money(totals().purchase)}, Balance ${money(businessBalance())}, Low stock ${lowStockProducts().length}.`;
  }

  let match = text.match(/^add customer\s+(.+?)(?:\s+opening\s+([0-9.]+))?$/i);
  if (match) {
    const name = match[1].trim();
    const opening = amount(match[2]);
    const existing = findCustomerByName(name);
    if (existing) return `Customer already exists: ${existing.name}. Balance: ${money(customerBalance(existing))}`;
    state.customers.push({ id: uid(), name, phone: "", address: "", opening });
    saveState();
    renderAll();
    return `Customer added: ${name}. Opening balance: ${money(opening)}.`;
  }

  match = text.match(/^add product\s+(.+?)(?:\s+cost\s+([0-9.]+))?(?:\s+price\s+([0-9.]+))?(?:\s+stock\s+([0-9.]+))?$/i);
  if (match) {
    const name = match[1].trim();
    const cost = amount(match[2]);
    const price = amount(match[3]);
    const stock = amount(match[4]);
    const existing = findProductByName(name);
    if (existing) return `Product already exists: ${existing.name}. Stock: ${money(existing.stock)}.`;
    const product = {
      id: uid(),
      name,
      category: "",
      barcode: "",
      cost,
      price,
      stock,
      lowStock: amount(state.settings.defaultLowStock || 5)
    };
    state.products.push(product);
    if (stock) {
      recordInventoryMovement({
        date: today(),
        productId: product.id,
        type: "adjustment_in",
        quantity: stock,
        rate: cost,
        amount: stock * cost,
        sourceType: "product_opening",
        sourceId: product.id,
        refNumber: "Opening Stock",
        partyName: "System",
        details: "Opening stock from AI product creation"
      });
    }
    saveState();
    renderAll();
    return `Product added: ${name}. Cost ${money(cost)}, price ${money(price)}, stock ${money(stock)}.`;
  }

  match = text.match(/^sale\s+(.+?)\s+to\s+(.+?)(?:\s+qty\s+([0-9.]+))?(?:\s+rate\s+([0-9.]+))?$/i);
  if (match) {
    const product = findProductByName(match[1]);
    const customer = findCustomerByName(match[2]);
    const quantity = amount(match[3] || 1);
    const rate = amount(match[4] || product?.price || 0);
    if (!product) return `Product not found: ${match[1]}. Add it first.`;
    if (!customer) return `Customer not found: ${match[2]}. Add customer first.`;
    if (!hasEnoughStock(product.id, quantity)) return `Stock is not enough for ${product.name}. Available stock: ${money(product.stock)}.`;
    const entry = {
      id: uid(),
      date: today(),
      type: "sale",
      customerId: customer.id,
      productId: product.id,
      details: product.name,
      quantity,
      rate,
      amount: quantity * rate
    };
    state.entries.push(entry);
    adjustProductStock(product.id, "sale", quantity);
    recordInventoryMovement({
      date: entry.date,
      productId: product.id,
      type: "sale_out",
      quantity,
      rate,
      amount: entry.amount,
      sourceType: "entry",
      sourceId: entry.id,
      refNumber: "AI Sale",
      partyName: customer.name,
      details: product.name
    });
    saveState();
    renderAll();
    return `Sale added: ${product.name} to ${customer.name}. Qty ${money(quantity)}, rate ${money(rate)}, total ${money(quantity * rate)}.`;
  }

  match = text.match(/^(?:create|make|generate)\s+(?:sale\s+)?invoice\s+for\s+(.+?)\s+item\s+(.+?)(?:\s+qty\s+([0-9.]+))?(?:\s+rate\s+([0-9.]+))?(?:\s+freight\s+([0-9.]+))?$/i);
  if (match) {
    return createInvoiceFromAssistant(match[1], match[2], match[3], match[4], match[5]);
  }

  match = text.match(/^(.+?)\s+(?:ko|ke naam|kay naam)\s+(.+?)\s+(?:qty|quantity|miqdar|quantity)\s+([0-9.]+)\s+(?:rate|rait|price)\s+([0-9.]+)(?:\s+freight\s+([0-9.]+))?\s+(?:invoice|bill)\s+(?:bana|banado|bana do|create|make).*$/i);
  if (match) {
    return createInvoiceFromAssistant(match[1], match[2], match[3], match[4], match[5]);
  }

  match = text.match(/^purchase\s+(.+?)(?:\s+qty\s+([0-9.]+))?(?:\s+rate\s+([0-9.]+))?$/i);
  if (match) {
    const product = findProductByName(match[1]);
    const quantity = amount(match[2] || 1);
    const rate = amount(match[3] || product?.cost || 0);
    if (!product) return `Product not found: ${match[1]}. Add it first.`;
    const entry = {
      id: uid(),
      date: today(),
      type: "purchase",
      customerId: "",
      productId: product.id,
      details: product.name,
      quantity,
      rate,
      amount: quantity * rate
    };
    state.entries.push(entry);
    adjustProductStock(product.id, "purchase", quantity);
    recordInventoryMovement({
      date: entry.date,
      productId: product.id,
      type: "purchase_in",
      quantity,
      rate,
      amount: entry.amount,
      sourceType: "entry",
      sourceId: entry.id,
      refNumber: "AI Purchase",
      partyName: "General Supplier",
      details: product.name
    });
    saveState();
    renderAll();
    return `Purchase added: ${product.name}. Qty ${money(quantity)}, rate ${money(rate)}, total ${money(quantity * rate)}.`;
  }

  match = text.match(/^receive\s+from\s+(.+?)\s+amount\s+([0-9.]+)$/i);
  if (match) {
    const customer = findCustomerByName(match[1]);
    const value = amount(match[2]);
    if (!customer) return `Customer not found: ${match[1]}. Add customer first.`;
    state.entries.push({
      id: uid(),
      date: today(),
      type: "receive",
      customerId: customer.id,
      productId: "",
      details: "Payment received",
      quantity: 1,
      rate: value,
      amount: value
    });
    saveState();
    renderAll();
    return `Payment received from ${customer.name}: ${money(value)}. New balance: ${money(customerBalance(customer))}.`;
  }

  match = text.match(/^driver charge\s+([0-9.]+)(?:\s+details\s+(.+))?$/i);
  if (match) {
    const value = amount(match[1]);
    const details = match[2]?.trim() || "Driver charge";
    state.entries.push({
      id: uid(),
      date: today(),
      type: "driver",
      customerId: "",
      productId: "",
      details,
      quantity: 1,
      rate: value,
      amount: value
    });
    saveState();
    renderAll();
    return `Driver charge added: ${money(value)}.`;
  }

  if (lower.includes("help") || lower.includes("commands")) {
    return [
      "I can help with these commands:",
      "add customer Ali opening 5000",
      "add product Drip cost 62 price 90 stock 100",
      "create invoice for Ali item Drip qty 12 rate 90",
      "sale Drip to Ali qty 12 rate 90",
      "purchase Drip qty 50 rate 62",
      "receive from Ali amount 1000",
      "driver charge 2500 details truck rent",
      "How do I create an invoice?"
    ].join("\n");
  }

  return "I can help with customers, products, sales, purchases, payments, driver charges, invoices and reports. Type 'help' to see commands.";
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.view}`).classList.add("active");
  });
});

document.querySelector("#customerForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.customers.push({
    id: uid(),
    name: data.name.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    opening: amount(data.opening)
  });
  audit("Customer added", data.name.trim());
  saveState();
  event.currentTarget.reset();
  event.currentTarget.opening.value = 0;
  renderAll();
});

document.querySelector("#supplierForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.suppliers.push({
    id: uid(),
    name: data.name.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    opening: amount(data.opening)
  });
  audit("Supplier added", data.name.trim());
  saveState();
  event.currentTarget.reset();
  event.currentTarget.opening.value = 0;
  renderAll();
});

document.querySelector("#productForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const product = {
    id: uid(),
    name: data.name.trim(),
    category: data.category.trim(),
    barcode: data.barcode.trim(),
    cost: amount(data.cost),
    price: amount(data.price),
    stock: amount(data.stock),
    lowStock: amount(data.lowStock || state.settings.defaultLowStock || 5)
  };
  state.products.push(product);
  if (product.stock) {
    recordInventoryMovement({
      date: today(),
      productId: product.id,
      type: "adjustment_in",
      quantity: product.stock,
      rate: product.cost,
      amount: product.stock * product.cost,
      sourceType: "product_opening",
      sourceId: product.id,
      refNumber: "Opening Stock",
      partyName: "System",
      details: "Opening stock from product master"
    });
  }
  audit("Product added", data.name.trim());
  saveState();
  event.currentTarget.reset();
  event.currentTarget.cost.value = 0;
  event.currentTarget.price.value = 0;
  event.currentTarget.stock.value = 0;
  event.currentTarget.lowStock.value = amount(state.settings.defaultLowStock || 5);
  renderAll();
});

document.querySelector("#entryForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const quantity = amount(data.quantity);
  const rate = amount(data.rate);
  const calculated = quantity * rate;
  if (data.type === "sale" && !hasEnoughStock(data.productId, quantity)) {
    alert("Not enough stock. Sale blocked to prevent negative inventory.");
    return;
  }
  const entry = {
    id: uid(),
    date: data.date,
    type: data.type,
    customerId: data.customerId,
    supplierId: data.supplierId,
    productId: data.productId,
    details: data.details.trim(),
    quantity,
    rate,
    amount: amount(data.amount) || calculated
  };
  state.entries.push(entry);
  adjustProductStock(data.productId, data.type, quantity);
  if (data.productId && ["sale", "purchase"].includes(data.type)) {
    recordInventoryMovement({
      date: data.date,
      productId: data.productId,
      type: data.type === "purchase" ? "purchase_in" : "sale_out",
      quantity,
      rate,
      amount: entry.amount,
      sourceType: "entry",
      sourceId: entry.id,
      refNumber: labels[data.type],
      partyName: data.supplierId ? supplierName(data.supplierId) : customerName(data.customerId),
      details: data.details.trim()
    });
  }
  if (data.type === "receive") {
    postJournal(data.date, `Payment Received - ${customerName(data.customerId)}`, "Cash/Bank A/C", `${customerName(data.customerId)} A/C`, amount(data.amount) || calculated, "receipt", "");
    showToast("Journal Entry Posted");
    showToast("Accounting Updated");
  }
  if (data.type === "payment") {
    const supplier = state.suppliers.find(item => item.id === data.supplierId);
    const partyAccount = supplier ? `${supplier.name} A/C` : `${customerName(data.customerId)} A/C`;
    postJournal(data.date, `Payment Made - ${supplier?.name || customerName(data.customerId)}`, partyAccount, "Cash/Bank A/C", amount(data.amount) || calculated, "payment", "");
    showToast("Journal Entry Posted");
    showToast("Accounting Updated");
    if (supplier) showToast("Supplier Ledger Updated");
  }
  if (data.type === "driver" || data.type === "expense") {
    postJournal(data.date, data.details.trim() || labels[data.type], `${labels[data.type]} A/C`, "Cash/Bank A/C", amount(data.amount) || calculated, data.type, "");
    showToast("Journal Entry Posted");
    showToast("Accounting Updated");
  }
  audit("Entry added", `${labels[data.type]} ${data.details.trim()} ${money(amount(data.amount) || calculated)}`);
  saveState();
  event.currentTarget.reset();
  event.currentTarget.date.value = today();
  event.currentTarget.quantity.value = 1;
  event.currentTarget.rate.value = 0;
  event.currentTarget.amount.value = 0;
  renderAll();
});

document.querySelector("#salesInvoiceForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const quantity = amount(data.quantity);
  const rate = amount(data.rate);
  const salesType = data.salesType || "stock";
  if (salesInvoiceNumberExists(data.number)) {
    alert("Duplicate sales invoice number. Please use a unique invoice number.");
    return;
  }
  if (salesType === "stock" && !hasEnoughStock(data.productId, quantity)) {
    alert("Not enough stock. Sales invoice blocked to prevent negative inventory.");
    return;
  }
  const totals = invoiceMath(quantity, rate, data.taxPercent, data.discount, data.freightCase === "recoverable" ? data.freight : 0);
  const invoice = {
    id: uid(),
    number: data.number.trim(),
    date: data.date,
    customerId: data.customerId,
    productId: data.productId,
    salesType,
    details: data.details.trim() || getProduct(data.productId)?.name || "Sales item",
    quantity,
    rate,
    taxPercent: amount(data.taxPercent),
    discount: amount(data.discount),
    freightCase: data.freightCase,
    freight: amount(data.freight),
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total
  };
  state.salesInvoices.push(invoice);
  state.entries.push({
    id: uid(),
    date: invoice.date,
    type: "sale",
    customerId: invoice.customerId,
    productId: invoice.productId,
    sourceType: "sales_invoice",
    sourceId: invoice.id,
    details: `Sales Invoice ${invoice.number} - ${invoice.details}`,
    quantity,
    rate,
    amount: totals.subtotal
  });
  if (invoice.freightCase === "recoverable" && invoice.freight) {
    state.entries.push({
      id: uid(),
      date: invoice.date,
      type: "sale",
      customerId: invoice.customerId,
      productId: "",
      sourceType: "freight_recovery",
      sourceId: invoice.id,
      details: `Freight recovery ${invoice.number}`,
      quantity: 1,
      rate: invoice.freight,
      amount: invoice.freight
    });
  }
  if (invoice.freightCase === "company_expense" && invoice.freight) {
    state.entries.push({
      id: uid(),
      date: invoice.date,
      type: "driver",
      customerId: "",
      productId: "",
      sourceType: "freight_expense",
      sourceId: invoice.id,
      details: `Freight expense ${invoice.number}`,
      quantity: 1,
      rate: invoice.freight,
      amount: invoice.freight
    });
  }
  if (!isDirectDispatchSale(invoice)) {
    adjustProductStock(invoice.productId, "sale", quantity);
    recordInventoryMovement({
      date: invoice.date,
      productId: invoice.productId,
      type: "sale_out",
      quantity,
      rate,
      amount: invoice.subtotal,
      sourceType: "sales_invoice",
      sourceId: invoice.id,
      refNumber: invoice.number,
      partyName: customerName(invoice.customerId),
      details: invoice.details
    });
  }
  postSalesInvoiceJournal(invoice);
  audit("Sales invoice added", `${invoice.number} ${customerName(invoice.customerId)} ${money(invoice.total)}`);
  saveState();
  showToast("Customer Ledger Updated");
  showToast("Journal Entry Posted");
  showToast("Accounting Updated");
  event.currentTarget.reset();
  event.currentTarget.number.value = salesInvoiceNumber();
  event.currentTarget.date.value = today();
  event.currentTarget.quantity.value = 1;
  event.currentTarget.rate.value = 0;
  event.currentTarget.salesType.value = "stock";
  event.currentTarget.taxPercent.value = amount(state.settings.defaultTax);
  event.currentTarget.discount.value = 0;
  event.currentTarget.freight.value = 0;
  renderAll();
});

document.querySelector("#purchaseInvoiceForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const quantity = amount(data.quantity);
  const rate = amount(data.rate);
  if (purchaseInvoiceNumberExists(data.number)) {
    alert("Duplicate purchase invoice number. Please use a unique invoice number.");
    return;
  }
  const totals = invoiceMath(quantity, rate, data.taxPercent, 0, data.freight);
  const invoice = {
    id: uid(),
    number: data.number.trim(),
    date: data.date,
    supplierId: data.supplierId,
    productId: data.productId,
    details: data.details.trim() || getProduct(data.productId)?.name || "Purchase item",
    quantity,
    rate,
    taxPercent: amount(data.taxPercent),
    freight: amount(data.freight),
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total
  };
  state.purchaseInvoices.push(invoice);
  state.entries.push({
    id: uid(),
    date: invoice.date,
    type: "purchase",
    customerId: "",
    supplierId: invoice.supplierId,
    productId: invoice.productId,
    sourceType: "purchase_invoice",
    sourceId: invoice.id,
    details: `Purchase Invoice ${invoice.number} - ${invoice.details}`,
    quantity,
    rate,
    amount: totals.subtotal
  });
  adjustProductStock(invoice.productId, "purchase", quantity);
  recordInventoryMovement({
    date: invoice.date,
    productId: invoice.productId,
    type: "purchase_in",
    quantity,
    rate,
    amount: invoice.subtotal,
    sourceType: "purchase_invoice",
    sourceId: invoice.id,
    refNumber: invoice.number,
    partyName: supplierName(invoice.supplierId),
    details: invoice.details
  });
  postPurchaseInvoiceJournal(invoice);
  audit("Purchase invoice added", `${invoice.number} ${money(invoice.total)}`);
  saveState();
  showToast("Supplier Ledger Updated");
  showToast("Journal Entry Posted");
  showToast("Accounting Updated");
  event.currentTarget.reset();
  event.currentTarget.number.value = purchaseInvoiceNumber();
  event.currentTarget.date.value = today();
  event.currentTarget.quantity.value = 1;
  event.currentTarget.rate.value = 0;
  event.currentTarget.taxPercent.value = amount(state.settings.defaultTax);
  event.currentTarget.freight.value = 0;
  renderAll();
});

document.querySelector("#quotationForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.quotations.push({
    id: uid(),
    date: data.date,
    customerId: data.customerId,
    items: data.items.trim(),
    total: amount(data.total),
    note: data.note.trim()
  });
  audit("Quotation added", `${customerName(data.customerId)} ${money(data.total)}`);
  saveState();
  event.currentTarget.reset();
  event.currentTarget.date.value = today();
  event.currentTarget.total.value = 0;
  renderAll();
});

document.querySelector("#invoiceForm").addEventListener("input", () => {
  selectedInvoiceId = "";
  renderInvoices();
  renderInvoicePreview(invoiceFormData());
});
document.querySelector("#invoiceForm").addEventListener("submit", event => {
  event.preventDefault();
  const invoice = invoiceFormData();
  if (salesInvoiceNumberExists(invoice.number)) {
    alert("Duplicate invoice number. Please use a unique invoice number.");
    return;
  }
  state.invoices.push(invoice);
  const legacySalesInvoice = createSalesInvoiceFromLegacyInvoice(invoice);
  state.salesInvoices.push(legacySalesInvoice);
  state.entries.push({
    id: uid(),
    date: legacySalesInvoice.date,
    type: "sale",
    customerId: legacySalesInvoice.customerId,
    supplierId: "",
    productId: "",
    sourceType: "legacy_invoice",
    sourceId: legacySalesInvoice.id,
    details: `Legacy Invoice ${legacySalesInvoice.number} - ${legacySalesInvoice.details}`,
    quantity: 1,
    rate: legacySalesInvoice.subtotal,
    amount: legacySalesInvoice.subtotal
  });
  if (legacySalesInvoice.freightCase === "recoverable" && legacySalesInvoice.freight) {
    state.entries.push({
      id: uid(),
      date: legacySalesInvoice.date,
      type: "sale",
      customerId: legacySalesInvoice.customerId,
      supplierId: "",
      productId: "",
      sourceType: "legacy_freight_recovery",
      sourceId: legacySalesInvoice.id,
      details: `Freight recovery ${legacySalesInvoice.number}`,
      quantity: 1,
      rate: legacySalesInvoice.freight,
      amount: legacySalesInvoice.freight
    });
  }
  postSalesInvoiceJournal(legacySalesInvoice);
  audit("Invoice added", `${invoice.number} ${invoice.buyerName} ${money(invoice.grandTotal)}`);
  saveState();
  selectedInvoiceId = invoice.id;
  showToast("Customer Ledger Updated");
  showToast("Journal Entry Posted");
  showToast("Accounting Updated");
  event.currentTarget.reset();
  event.currentTarget.number.value = nextInvoiceNumber();
  event.currentTarget.date.value = today();
  document.querySelector("#invoiceItems").innerHTML = "";
  applySettingsToInvoice();
  addInvoiceItem();
  renderAll();
});

document.querySelector("#dispatchForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.dispatches.unshift({
    id: uid(),
    date: data.date,
    customerId: data.customerId,
    vehicle: data.vehicle.trim(),
    goods: data.goods.trim(),
    quantity: amount(data.quantity),
    freight: amount(data.freight),
    status: data.status
  });
  audit("Dispatch added", `${data.goods.trim()} ${data.vehicle.trim()} ${money(data.freight)}`);
  saveState();
  event.currentTarget.reset();
  event.currentTarget.date.value = today();
  renderAll();
});

document.querySelector("#productionForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const quantity = amount(data.quantity);
  const totalCost = amount(data.rawCost) + amount(data.labourCost) + amount(data.otherCost);
  const unitCost = quantity ? totalCost / quantity : 0;
  const production = {
    id: uid(),
    date: data.date,
    productId: data.productId,
    quantity,
    rawCost: amount(data.rawCost),
    labourCost: amount(data.labourCost),
    otherCost: amount(data.otherCost),
    totalCost,
    unitCost
  };
  state.productions.unshift(production);
  adjustProductStock(data.productId, "purchase", quantity);
  recordInventoryMovement({
    date: production.date,
    productId: production.productId,
    type: "production_in",
    quantity,
    rate: unitCost,
    amount: totalCost,
    sourceType: "production",
    sourceId: production.id,
    refNumber: "Production",
    partyName: "Production",
    details: "Production output"
  });
  audit("Production added", `${getProduct(data.productId)?.name || "Product"} qty ${money(quantity)} unit cost ${money(unitCost)}`);
  saveState();
  event.currentTarget.reset();
  event.currentTarget.date.value = today();
  renderAll();
});

document.querySelector("#staffForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.staff.push({
    id: uid(),
    name: data.name.trim(),
    role: data.role.trim(),
    phone: data.phone.trim(),
    salary: amount(data.salary)
  });
  audit("Staff added", data.name.trim());
  saveState();
  event.currentTarget.reset();
  event.currentTarget.salary.value = 0;
  renderAll();
});

document.querySelector("#salaryExpenseForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const value = amount(data.amount);
  state.salaryExpenses.unshift({
    id: uid(),
    date: data.date,
    type: data.type,
    person: data.person.trim(),
    details: data.details.trim(),
    amount: value
  });
  state.entries.push({
    id: uid(),
    date: data.date,
    type: "expense",
    customerId: "",
    productId: "",
    details: `${salaryExpenseLabel(data.type)} - ${data.person.trim()} ${data.details.trim()}`.trim(),
    quantity: 1,
    rate: value,
    amount: value
  });
  postJournal(
    data.date,
    `${salaryExpenseLabel(data.type)} - ${data.person.trim()}`,
    `${salaryExpenseLabel(data.type)} A/C`,
    "Cash/Bank A/C",
    value,
    "salary_expense",
    ""
  );
  audit("Salary/Misc expense added", `${salaryExpenseLabel(data.type)} ${money(value)}`);
  saveState();
  showToast("Journal Entry Posted");
  showToast("Accounting Updated");
  event.currentTarget.reset();
  event.currentTarget.date.value = today();
  event.currentTarget.amount.value = 0;
  renderAll();
});

document.querySelector("#bankAccountForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.bankAccounts.push({
    id: uid(),
    bankName: data.bankName,
    title: data.title.trim(),
    accountNumber: data.accountNumber.trim(),
    opening: amount(data.opening)
  });
  audit("Bank account added", `${data.bankName} ${data.title.trim()}`);
  saveState();
  event.currentTarget.reset();
  event.currentTarget.opening.value = 0;
  renderAll();
});

document.querySelector("#bankTransactionForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!data.bankId) {
    alert("Please add a bank account first.");
    return;
  }
  state.bankTransactions.unshift({
    id: uid(),
    date: data.date,
    bankId: data.bankId,
    type: data.type,
    details: data.details.trim(),
    amount: amount(data.amount)
  });
  const debitAccount = data.type === "deposit" || data.type === "transfer_in"
    ? bankAccountName(data.bankId)
    : data.type === "bank_charge"
      ? "Bank Charges A/C"
      : "Cash/Bank Clearing A/C";
  const creditAccount = data.type === "deposit" || data.type === "transfer_in"
    ? "Cash/Bank Clearing A/C"
    : bankAccountName(data.bankId);
  postJournal(data.date, `Bank ${data.type.replaceAll("_", " ")} - ${data.details.trim()}`, debitAccount, creditAccount, data.amount, "bank_transaction", "");
  audit("Bank transaction added", `${bankAccountName(data.bankId)} ${data.type} ${money(data.amount)}`);
  saveState();
  showToast("Journal Entry Posted");
  showToast("Accounting Updated");
  event.currentTarget.reset();
  event.currentTarget.date.value = today();
  event.currentTarget.amount.value = 0;
  renderAll();
});

document.querySelector("#addInvoiceItem").addEventListener("click", addInvoiceItem);
document.querySelector("#printInvoiceBtn").addEventListener("click", () => printInvoice());
document.querySelector("#pdfInvoiceBtn").addEventListener("click", () => printInvoice());
document.querySelector("#emailInvoiceBtn").addEventListener("click", () => emailInvoice());
document.querySelector("#whatsappInvoiceBtn").addEventListener("click", () => whatsappInvoice());

document.addEventListener("click", event => {
  const selectInvoiceId = event.target.dataset.selectInvoice;
  const printSavedInvoiceId = event.target.dataset.printSavedInvoice;
  const pdfSavedInvoiceId = event.target.dataset.pdfSavedInvoice;
  const whatsappSavedInvoiceId = event.target.dataset.whatsappSavedInvoice;
  const customerId = event.target.dataset.deleteCustomer;
  const supplierId = event.target.dataset.deleteSupplier;
  const productId = event.target.dataset.deleteProduct;
  const labelProductId = event.target.dataset.labelProduct;
  const salesInvoiceId = event.target.dataset.deleteSalesInvoice;
  const purchaseInvoiceId = event.target.dataset.deletePurchaseInvoice;
  const entryId = event.target.dataset.deleteEntry;
  const quotationId = event.target.dataset.deleteQuotation;
  const invoiceId = event.target.dataset.deleteInvoice;
  const dispatchId = event.target.dataset.deleteDispatch;
  const productionId = event.target.dataset.deleteProduction;
  const staffId = event.target.dataset.deleteStaff;
  const salaryExpenseId = event.target.dataset.deleteSalaryExpense;
  const bankAccountId = event.target.dataset.deleteBankAccount;
  const bankTransactionId = event.target.dataset.deleteBankTransaction;

  if (selectInvoiceId) {
    selectSavedInvoice(selectInvoiceId);
  }

  if (printSavedInvoiceId) {
    printInvoice(printSavedInvoiceId);
  }

  if (pdfSavedInvoiceId) {
    printInvoice(pdfSavedInvoiceId);
  }

  if (whatsappSavedInvoiceId) {
    whatsappInvoice(whatsappSavedInvoiceId);
  }

  if (customerId) {
    if (customerHasReferences(customerId)) {
      alert("This customer has invoices, dispatches, or ledger entries. Delete or reverse those records first.");
      return;
    }
    if (!confirm("Delete this customer?")) return;
    const index = state.customers.findIndex(customer => customer.id === customerId);
    if (index >= 0) state.customers.splice(index, 1);
    audit("Customer deleted", customerId);
    saveState();
    renderAll();
  }

  if (supplierId) {
    if (supplierHasReferences(supplierId)) {
      alert("This supplier has purchase invoices or ledger entries. Delete or reverse those records first.");
      return;
    }
    if (!confirm("Delete this supplier?")) return;
    const index = state.suppliers.findIndex(supplier => supplier.id === supplierId);
    if (index >= 0) state.suppliers.splice(index, 1);
    audit("Supplier deleted", supplierId);
    saveState();
    renderAll();
  }

  if (productId) {
    if (productHasReferences(productId)) {
      alert("This product has stock movement, invoices, entries, or production records. Delete or reverse those records first.");
      return;
    }
    if (!confirm("Delete this product?")) return;
    const index = state.products.findIndex(product => product.id === productId);
    if (index >= 0) state.products.splice(index, 1);
    removeInventoryMovements(productId);
    audit("Product deleted", productId);
    saveState();
    renderAll();
  }

  if (labelProductId) {
    printProductLabel(labelProductId);
  }

  if (salesInvoiceId && confirm("Delete this sales invoice?")) {
    const invoice = state.salesInvoices.find(item => item.id === salesInvoiceId);
    const index = state.salesInvoices.findIndex(item => item.id === salesInvoiceId);
    if (invoice) {
      if (!isDirectDispatchSale(invoice)) adjustProductStock(invoice.productId, "purchase", invoice.quantity);
      removeRelatedAccounting(invoice.id, invoice.number);
      removeInventoryMovements(invoice.id, invoice.number);
    }
    if (index >= 0) state.salesInvoices.splice(index, 1);
    audit("Sales invoice deleted", salesInvoiceId);
    saveState();
    renderAll();
  }

  if (purchaseInvoiceId && confirm("Delete this purchase invoice?")) {
    const invoice = state.purchaseInvoices.find(item => item.id === purchaseInvoiceId);
    const index = state.purchaseInvoices.findIndex(item => item.id === purchaseInvoiceId);
    if (invoice) {
      if (!canReversePurchaseInvoice(invoice)) {
        alert("This purchase invoice cannot be reversed because the stock has already been sold or consumed.");
        return;
      }
      adjustProductStock(invoice.productId, "sale", invoice.quantity);
      removeRelatedAccounting(invoice.id, invoice.number);
      removeInventoryMovements(invoice.id, invoice.number);
    }
    if (index >= 0) state.purchaseInvoices.splice(index, 1);
    audit("Purchase invoice deleted", purchaseInvoiceId);
    saveState();
    renderAll();
  }

  if (entryId) {
    const entry = state.entries.find(item => item.id === entryId);
    if (entry?.sourceType || entry?.sourceId) {
      alert("This entry was created automatically from an invoice or freight transaction. Reverse the original record instead.");
      return;
    }
    if (!confirm("Delete this entry?")) return;
    const index = state.entries.findIndex(item => item.id === entryId);
    if (index >= 0) state.entries.splice(index, 1);
    removeInventoryMovements(entryId);
    audit("Entry deleted", entryId);
    saveState();
    renderAll();
  }

  if (quotationId && confirm("Delete this quotation?")) {
    const index = state.quotations.findIndex(quotation => quotation.id === quotationId);
    if (index >= 0) state.quotations.splice(index, 1);
    audit("Quotation deleted", quotationId);
    saveState();
    renderAll();
  }

  if (invoiceId && confirm("Delete this invoice?")) {
    const invoice = state.invoices.find(item => item.id === invoiceId);
    const linkedSales = state.salesInvoices.find(item => item.legacyInvoiceId === invoiceId);
    if (linkedSales) {
      removeRelatedAccounting(linkedSales.id, linkedSales.number);
      removeInventoryMovements(linkedSales.id, linkedSales.number);
      state.salesInvoices = state.salesInvoices.filter(item => item.id !== linkedSales.id);
    }
    const index = state.invoices.findIndex(invoice => invoice.id === invoiceId);
    if (index >= 0) state.invoices.splice(index, 1);
    if (selectedInvoiceId === invoiceId) selectedInvoiceId = "";
    audit("Invoice deleted", invoice?.number || invoiceId);
    saveState();
    renderAll();
  }

  if (dispatchId && confirm("Delete this dispatch record?")) {
    const index = state.dispatches.findIndex(item => item.id === dispatchId);
    if (index >= 0) state.dispatches.splice(index, 1);
    audit("Dispatch deleted", dispatchId);
    saveState();
    renderAll();
  }

  if (productionId && confirm("Delete this production record?")) {
    const production = state.productions.find(item => item.id === productionId);
    if (production && !hasEnoughStock(production.productId, production.quantity)) {
      alert("This production record cannot be reversed because the stock has already been sold or consumed.");
      return;
    }
    const index = state.productions.findIndex(item => item.id === productionId);
    if (production) adjustProductStock(production.productId, "sale", production.quantity);
    if (index >= 0) state.productions.splice(index, 1);
    removeInventoryMovements(productionId);
    audit("Production deleted", productionId);
    saveState();
    renderAll();
  }

  if (staffId && confirm("Delete this staff member?")) {
    const index = state.staff.findIndex(item => item.id === staffId);
    if (index >= 0) state.staff.splice(index, 1);
    audit("Staff deleted", staffId);
    saveState();
    renderAll();
  }

  if (salaryExpenseId && confirm("Delete this salary/misc expense?")) {
    const index = state.salaryExpenses.findIndex(item => item.id === salaryExpenseId);
    if (index >= 0) state.salaryExpenses.splice(index, 1);
    audit("Salary/Misc expense deleted", salaryExpenseId);
    saveState();
    renderAll();
  }

  if (bankAccountId && confirm("Delete this bank account?")) {
    const index = state.bankAccounts.findIndex(item => item.id === bankAccountId);
    if (index >= 0) state.bankAccounts.splice(index, 1);
    state.bankTransactions = state.bankTransactions.filter(item => item.bankId !== bankAccountId);
    audit("Bank account deleted", bankAccountId);
    saveState();
    renderAll();
  }

  if (bankTransactionId && confirm("Delete this bank transaction?")) {
    const index = state.bankTransactions.findIndex(item => item.id === bankTransactionId);
    if (index >= 0) state.bankTransactions.splice(index, 1);
    audit("Bank transaction deleted", bankTransactionId);
    saveState();
    renderAll();
  }
});

document.querySelector("#entryForm [name='quantity']").addEventListener("input", updateEntryAmount);
document.querySelector("#entryForm [name='rate']").addEventListener("input", updateEntryAmount);
document.querySelector("#entryProduct").addEventListener("change", event => {
  const product = getProduct(event.target.value);
  const form = document.querySelector("#entryForm");
  if (!product) return;
  form.details.value = product.name;
  form.rate.value = product.price;
  updateEntryAmount();
});

document.querySelector("#salesProduct").addEventListener("change", event => {
  const product = getProduct(event.target.value);
  const form = document.querySelector("#salesInvoiceForm");
  if (!product) return;
  form.details.value = product.name;
  form.rate.value = product.price;
});

document.querySelector("#purchaseProduct").addEventListener("change", event => {
  const product = getProduct(event.target.value);
  const form = document.querySelector("#purchaseInvoiceForm");
  if (!product) return;
  form.details.value = product.name;
  form.rate.value = product.cost;
});

function updateEntryAmount() {
  const form = document.querySelector("#entryForm");
  form.amount.value = amount(form.quantity.value) * amount(form.rate.value);
}

document.querySelector("#entrySearch").addEventListener("input", renderEntries);
document.querySelector("#entryMonth").addEventListener("change", renderEntries);
document.querySelector("#customerLedgerSelect").addEventListener("change", renderCustomerLedger);
document.querySelector("#supplierLedgerSelect").addEventListener("change", renderSupplierLedger);
document.querySelector("#productSearch").addEventListener("input", renderProducts);
document.querySelector("#globalSearch").addEventListener("input", renderGlobalSearch);
document.querySelector("#monthlyPicker").addEventListener("change", renderMonthly);
document.querySelector("#salaryExpenseMonth").addEventListener("change", renderSalaryExpenses);
document.querySelector("#bankLedgerMonth").addEventListener("change", renderBankTransactions);
document.querySelector("#journalMonth").addEventListener("change", renderJournalBook);
document.querySelector("#inventoryProductFilter").addEventListener("change", renderInventoryMovementLedger);
document.querySelector("#inventoryMovementMonth").addEventListener("change", renderInventoryMovementLedger);
document.querySelector("#printBtn").addEventListener("click", () => window.print());
document.querySelector("#monthlyCsvBtn").addEventListener("click", exportMonthlyCsv);
document.querySelector("#balanceCsvBtn").addEventListener("click", exportBalanceCsv);
document.querySelector("#clearAuditBtn").addEventListener("click", () => {
  if (!confirm("Clear audit logs?")) return;
  state.auditLogs = [];
  saveState();
  renderAll();
});

document.querySelector("#assistantForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAssistantText();
});

function submitAssistantText() {
  const input = document.querySelector("#assistantInput");
  const text = input.value.trim();
  if (!text) return;
  addAssistantMessage("user", text);
  input.value = "";
  addAssistantMessage("bot", handleAssistantCommand(text));
}

document.querySelector("#assistantVoiceBtn").addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice typing is not supported in this browser. Please use Chrome or Edge.");
    return;
  }
  const input = document.querySelector("#assistantInput");
  const button = document.querySelector("#assistantVoiceBtn");
  const recognition = new SpeechRecognition();
  recognition.lang = "en-PK";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  button.classList.add("listening");
  button.textContent = "Listening...";
  recognition.onresult = event => {
    input.value = event.results[0][0].transcript;
    input.focus();
    setTimeout(submitAssistantText, 150);
  };
  recognition.onerror = () => {
    alert("Voice could not be heard clearly. Please try again.");
  };
  recognition.onend = () => {
    button.classList.remove("listening");
    button.textContent = "Voice";
  };
  recognition.start();
});

document.querySelectorAll("[data-example]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector("#assistantInput").value = button.dataset.example;
    document.querySelector("#assistantInput").focus();
  });
});

document.querySelector("#settingsForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.settings.companyName = data.companyName.trim();
  state.settings.companyPhone = data.companyPhone.trim();
  state.settings.companyAddress = data.companyAddress.trim();
  state.settings.taxNumber = data.taxNumber.trim();
  state.settings.defaultTax = amount(data.defaultTax);
  state.settings.defaultLowStock = amount(data.defaultLowStock || 5);
  saveState();
  applySettingsToInvoice();
  renderAll();
});

document.querySelector("#themeBtn").addEventListener("click", () => {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  saveState();
  applyTheme();
});

document.querySelector("#syncNowBtn").addEventListener("click", async () => {
  await syncToCloud();
});

document.querySelector("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  if (supabaseClient) supabaseClient.auth.signOut();
  document.querySelector("#loginScreen").classList.remove("hidden");
});

document.querySelector("#dripPresetBtn").addEventListener("click", () => {
  const existing = state.products.find(product => product.name.toLowerCase() === "drip");
  if (existing) {
    existing.cost = 62;
    existing.price = 90;
    existing.lowStock = existing.lowStock || 5;
  } else {
    state.products.push({
      id: uid(),
      name: "Drip",
      category: "Drip",
      barcode: "",
      cost: 62,
      price: 90,
      stock: 0,
      lowStock: amount(state.settings.defaultLowStock || 5)
    });
  }
  saveState();
  renderAll();
  alert("Drip product is ready: purchase price 62, sale price 90.");
});

document.querySelector("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (isSupabaseConfigured()) {
    if (!data.username.includes("@")) {
      alert("Production cloud login required. Use your Supabase email and password so all computers share the same database.");
      return;
    }
    initSupabaseClient().auth.signInWithPassword({
      email: data.username.trim(),
      password: data.password
    }).then(async ({ error }) => {
      if (error) {
        alert(`Cloud login failed: ${error.message}`);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "1");
      document.querySelector("#loginScreen").classList.add("hidden");
      await setupCloudSync();
    });
    return;
  }
  if (data.username === "admin" && data.password === "1234") {
    sessionStorage.setItem(SESSION_KEY, "1");
    document.querySelector("#loginScreen").classList.add("hidden");
    scheduleCloudSync(200);
  } else {
    alert("Wrong username or password.");
  }
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  audit("Backup exported", "JSON backup downloaded");
  saveState();
  downloadText(`business-ledger-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
});

document.querySelector("#importFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      state.customers = imported.customers || [];
      state.entries = imported.entries || [];
      state.quotations = imported.quotations || [];
      state.invoices = imported.invoices || [];
      state.salesInvoices = imported.salesInvoices || [];
      state.purchaseInvoices = imported.purchaseInvoices || [];
      state.products = imported.products || [];
      state.suppliers = imported.suppliers || [];
      state.dispatches = imported.dispatches || [];
      state.productions = imported.productions || [];
      state.staff = imported.staff || [];
      state.salaryExpenses = imported.salaryExpenses || [];
      state.bankAccounts = imported.bankAccounts || [];
      state.bankTransactions = imported.bankTransactions || [];
      state.journalEntries = imported.journalEntries || [];
      state.auditLogs = imported.auditLogs || [];
      state.settings = { ...defaultSettings(), ...(imported.settings || {}) };
      audit("Backup restored", file.name);
      saveState();
      applyTheme();
      applySettingsToInvoice();
      renderAll();
    } catch {
      alert("Backup file is not valid.");
    }
  };
  reader.readAsText(file);
});

function nextInvoiceNumber() {
  return `INV-${String(state.invoices.length + 1).padStart(4, "0")}`;
}

function addInvoiceItem() {
  const row = document.createElement("div");
  row.className = "invoice-item";
  row.innerHTML = `
    <input data-item="description" placeholder="Goods / service">
    <input data-item="quantity" type="number" step="0.01" value="1" aria-label="Quantity">
    <input data-item="rate" type="number" step="0.01" value="0" aria-label="Rate">
    <input data-item="total" type="number" step="0.01" value="0" aria-label="Amount" readonly>
    <button class="danger" type="button" aria-label="Delete">x</button>
  `;
  row.addEventListener("input", () => {
    const quantity = amount(row.querySelector("[data-item='quantity']").value);
    const rate = amount(row.querySelector("[data-item='rate']").value);
    row.querySelector("[data-item='total']").value = quantity * rate;
    renderInvoicePreview();
  });
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    renderInvoicePreview();
  });
  document.querySelector("#invoiceItems").appendChild(row);
  renderInvoicePreview();
}

function printProductLabel(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const label = window.open("", "_blank", "width=420,height=520");
  const code = product.barcode || product.id.slice(0, 10);
  label.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>${escapeHtml(product.name)} Label</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        .label { width: 320px; border: 2px solid #111; padding: 18px; text-align: center; }
        .brand { font-weight: 900; font-size: 24px; }
        .box { margin: 16px auto; width: 140px; height: 140px; display: grid; place-items: center; border: 1px solid #111; font-size: 42px; font-weight: 900; }
        .barcode { margin-top: 12px; letter-spacing: 3px; font-family: monospace; border-top: 8px repeating-linear-gradient(90deg, #111 0 2px, #fff 2px 4px); padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="brand">Eissa Packages</div>
        <h2>${escapeHtml(product.name)}</h2>
        <p>Price: ${money(product.price)}</p>
        <div class="box">QR</div>
        <div class="barcode">${escapeHtml(code)}</div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `);
  label.document.close();
  audit("Label printed", product.name);
  saveState();
}


function applyTheme() {
  document.body.classList.toggle("dark", state.settings.theme === "dark");
  document.querySelector("#themeBtn").textContent = state.settings.theme === "dark" ? "Light" : "Dark";
}

function applySettingsToInvoice() {
  const form = document.querySelector("#invoiceForm");
  if (!form.sellerName.value) form.sellerName.value = state.settings.companyName || "Eissa Packages";
  if (!form.sellerAddress.value) form.sellerAddress.value = state.settings.companyAddress || "Quality Packaging Solutions";
  form.taxPercent.value = amount(state.settings.defaultTax);
}

function tickClock() {
  const now = new Date();
  document.querySelector("#liveClock").textContent = now.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

function exportMonthlyCsv() {
  const month = document.querySelector("#monthlyPicker").value || currentMonth();
  const rows = state.entries
    .filter(entry => entry.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(entry => [
      entry.date,
      labels[entry.type],
      customerName(entry.customerId),
      entry.details,
      entry.quantity,
      entry.rate,
      entry.amount
    ]);

  const csv = [
    ["Date", "Type", "Customer", "Details", "Quantity", "Rate", "Amount"],
    ...rows
  ].map(row => row.map(csvCell).join(",")).join("\n");

  downloadText(`monthly-sheet-${month}.csv`, csv, "text/csv;charset=utf-8");
}

function exportBalanceCsv() {
  const rows = state.customers.map(customer => {
    const customerEntries = state.entries.filter(entry => entry.customerId === customer.id);
    const t = totals(customerEntries);
    return [
      customer.name,
      customer.opening,
      t.sale,
      t.receive,
      t.purchase,
      t.payment,
      customerBalance(customer)
    ];
  });

  const csv = [
    ["Customer", "Opening", "Sales", "Received", "Purchases", "Paid", "Balance"],
    ...rows
  ].map(row => row.map(csvCell).join(",")).join("\n");

  downloadText(`balance-sheet-${today()}.csv`, csv, "text/csv;charset=utf-8");
}

setDefaultDates();
document.querySelector("#invoiceForm [name='number']").value = nextInvoiceNumber();
document.querySelector("#invoiceForm [name='date']").value = today();
document.querySelector("#salesInvoiceForm [name='number']").value = salesInvoiceNumber();
document.querySelector("#salesInvoiceForm [name='date']").value = today();
document.querySelector("#salesInvoiceForm [name='taxPercent']").value = amount(state.settings.defaultTax);
document.querySelector("#purchaseInvoiceForm [name='number']").value = purchaseInvoiceNumber();
document.querySelector("#purchaseInvoiceForm [name='date']").value = today();
document.querySelector("#purchaseInvoiceForm [name='taxPercent']").value = amount(state.settings.defaultTax);
document.querySelector("#productForm [name='lowStock']").value = amount(state.settings.defaultLowStock || 5);
applyTheme();
applySettingsToInvoice();
backfillAccountingFromExistingData();
if (backfillInventoryMovements()) saveState();
tickClock();
setInterval(tickClock, 1000);
window.addEventListener("online", () => {
  updateSyncStatus("Internet returned. Syncing...");
  scheduleCloudSync(100);
});
window.addEventListener("offline", () => {
  updateSyncStatus("Cloud sync: offline, changes will sync later", "warn");
});
addInvoiceItem();
renderAll();
setupCloudSync();
addAssistantMessage("bot", "Hello. I can help you run this POS software. Type 'help' or use the example buttons.");
