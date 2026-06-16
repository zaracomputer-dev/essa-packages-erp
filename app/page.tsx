const kpis = [
  { label: "Monthly Revenue", value: "PKR 2.48M", change: "+12.4%", tone: "text-emerald-700" },
  { label: "Open Orders", value: "186", change: "24 urgent", tone: "text-amber-700" },
  { label: "Inventory Value", value: "PKR 8.9M", change: "+4.1%", tone: "text-sky-700" },
  { label: "Pending Payments", value: "PKR 640K", change: "18 invoices", tone: "text-rose-700" },
];

const navigation = [
  "Dashboard",
  "Sales",
  "Inventory",
  "Production",
  "Dispatch",
  "Finance",
  "Reports",
  "Settings",
];

const inventory = [
  { name: "Kraft Paper", stock: "12.4 tons", status: "Healthy", level: "82%" },
  { name: "Corrugated Sheets", stock: "8,420 pcs", status: "Reorder soon", level: "42%" },
  { name: "Packing Tape", stock: "1,260 rolls", status: "Healthy", level: "76%" },
  { name: "Printed Labels", stock: "18,500 pcs", status: "Low stock", level: "23%" },
];

const transactions = [
  { id: "INV-1028", party: "Ashraf Sons Pharma", type: "Invoice", amount: "PKR 184,000", time: "09:45 AM" },
  { id: "PO-447", party: "AJ Paper Mills", type: "Purchase", amount: "PKR 520,000", time: "10:20 AM" },
  { id: "DSP-318", party: "Nutra Pharma", type: "Dispatch", amount: "48 cartons", time: "11:05 AM" },
  { id: "PAY-882", party: "Surgitex Pharma", type: "Payment", amount: "PKR 96,000", time: "12:15 PM" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <section className="grid min-h-screen lg:grid-cols-[420px_1fr]">
        <aside className="flex flex-col justify-between bg-slate-950 px-8 py-8 text-white">
          <div>
            <div className="mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
                Essa Packages
              </p>
              <h1 className="mt-3 text-3xl font-bold">ERP Control Room</h1>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold">Secure Login</h2>
              <form className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-slate-200">
                  Email
                  <input
                    className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-300"
                    defaultValue="admin@essapackages.com"
                    type="email"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-200">
                  Password
                  <input
                    className="mt-2 w-full rounded-md border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-300"
                    defaultValue="password"
                    type="password"
                  />
                </label>
                <button className="w-full rounded-md bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300">
                  Sign in
                </button>
              </form>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">
            System status: production, inventory, dispatch, and finance modules are ready for API integration.
          </div>
        </aside>

        <div className="flex min-w-0">
          <nav className="hidden w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6 lg:block">
            <p className="px-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Modules
            </p>
            <div className="mt-5 space-y-1">
              {navigation.map((item) => (
                <a
                  className={`block rounded-md px-3 py-3 text-sm font-semibold ${
                    item === "Dashboard"
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  href="#"
                  key={item}
                >
                  {item}
                </a>
              ))}
            </div>
          </nav>

          <section className="min-w-0 flex-1 overflow-hidden px-5 py-6 sm:px-8 lg:px-10">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Tuesday, June 16, 2026</p>
                <h2 className="mt-1 text-3xl font-bold tracking-normal">Dashboard</h2>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-slate-700">Live operations</span>
              </div>
            </header>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((item) => (
                <article className="rounded-lg border border-slate-200 bg-white p-5" key={item.label}>
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className={`text-sm font-bold ${item.tone}`}>{item.change}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.25fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Inventory Summary</h3>
                  <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Review stock
                  </button>
                </div>
                <div className="mt-5 space-y-5">
                  {inventory.map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div>
                          <p className="font-semibold text-slate-950">{item.name}</p>
                          <p className="mt-1 text-slate-500">{item.stock}</p>
                        </div>
                        <p className="font-semibold text-slate-600">{item.status}</p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-sky-500" style={{ width: item.level }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Recent Transactions</h3>
                  <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Export
                  </button>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-3 font-semibold">Reference</th>
                        <th className="pb-3 font-semibold">Party</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Amount</th>
                        <th className="pb-3 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((item) => (
                        <tr key={item.id}>
                          <td className="py-4 font-semibold text-slate-950">{item.id}</td>
                          <td className="py-4 text-slate-700">{item.party}</td>
                          <td className="py-4 text-slate-700">{item.type}</td>
                          <td className="py-4 font-semibold text-slate-950">{item.amount}</td>
                          <td className="py-4 text-slate-500">{item.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
