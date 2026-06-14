export default function Dashboard() {
  
  
  return (
    <main className="min-h-screen bg-slate-950 text-white flex">

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 p-6">
        <h1 className="text-3xl font-bold mb-10">
          Essa ERP
        </h1>

        <nav className="space-y-4">
          <div className="bg-blue-600 p-4 rounded-xl cursor-pointer">
            Dashboard
          </div>

          <div className="bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700">
            Sales
          </div>

          <div className="bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700">
            Inventory
          </div>

          <div className="bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700">
            Customers
          </div>

          <div className="bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700">
            Reports
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <section className="flex-1 p-10">
        <h2 className="text-3xl font-bold mb-10">
          ERP Dashboard
        </h2>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-6 rounded-2xl">
            <h3 className="text-2xl">Sales</h3>
            <p className="text-4xl font-bold mt-4">
              PKR 500,000
            </p>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl">
            <h3 className="text-xl">Orders</h3>
            <p className="text-2xl font-bold mt-4">
              240
            </p>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl">
            <h3 className="text-2xl">Customers</h3>
            <p className="text-2xl font-bold mt-4">
              120
            </p>
          </div>
        </div>
        <div className="mt-10 bg-slate-800 p-6 rounded-2xl">
  <h2 className="text-2xl font-bold mb-4">Recent Orders</h2>
  <div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Create Invoice
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

    <input
      type="text"
      placeholder="Customer Name"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

    <input
      type="text"
      placeholder="Product Name"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

    <input
      type="number"
      placeholder="Quantity"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

    <input
      type="number"
      placeholder="Price"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

  </div>

  <button className="mt-6 bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-bold">
    Generate Invoice
  </button>

</div>
<div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">

  <div className="bg-slate-800 p-6 rounded-2xl">
    <h2 className="text-2xl font-bold mb-4">Monthly Sales</h2>

    <div className="space-y-4">
      <div>
        <p>January</p>
        <div className="w-full bg-slate-700 rounded-full h-4">
          <div className="bg-blue-500 h-4 rounded-full w-[70%]"></div>
        </div>
      </div>

      <div>
        <p>February</p>
        <div className="w-full bg-slate-700 rounded-full h-4">
          <div className="bg-green-500 h-4 rounded-full w-[50%]"></div>
        </div>
      </div>

      <div>
        <p>March</p>
        <div className="w-full bg-slate-700 rounded-full h-4">
          <div className="bg-purple-500 h-4 rounded-full w-[90%]"></div>
        </div>
      </div>
    </div>
  </div>

  <div className="bg-slate-800 p-6 rounded-2xl">
    <h2 className="text-2xl font-bold mb-4">System Status</h2>

    <div className="space-y-3">
      <div className="flex justify-between">
        <span>Server</span>
        <span className="text-green-400">Online</span>
      </div>

      <div className="flex justify-between">
        <span>Database</span>
        <span className="text-green-400">Connected</span>
      </div>

      <div className="flex justify-between">
        <span>AI Engine</span>
        <span className="text-yellow-400">Processing</span>
      </div>
    </div>
  </div>

</div>
  <table className="w-full text-left">
    <thead>
      <tr className="text-gray-400">
        <th className="pb-3">Customer</th>
        <th className="pb-3">Product</th>
        <th className="pb-3">Amount</th>
      </tr>
    </thead>

    <tbody>
      <tr>
        <td className="py-2">Ali</td>
        <td>Boxes</td>
        <td>PKR 25,000</td>
      </tr>

      <tr>
        <td className="py-2">Ahmed</td>
        <td>Tapes</td>
        <td>PKR 15,000</td>
      </tr>

      <tr>
        <td className="py-2">Usman</td>
        <td>Packaging Roll</td>
        <td>PKR 40,000</td>
      </tr>
    </tbody>
  </table>
</div><div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Create Invoice
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

    <input
      type="text"
      placeholder="Customer Name"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

    <input
      type="text"
      placeholder="Product Name"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

    <input
      type="number"
      placeholder="Quantity"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

    <input
      type="number"
      placeholder="Price"
      className="p-4 rounded-xl bg-slate-700 text-white"
    />

  </div>

  <button className="mt-6 bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-bold">
    Generate Invoice
  </button>

</div>
      </section>
<footer className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-700 p-4 text-center text-gray-400">
  © 2026 Essa ERP System — AI Powered Business Solution
</footer>
<div className="fixed top-5 right-5 space-y-4">

  <div className="bg-green-600 px-6 py-4 rounded-2xl shadow-2xl">
    ✅ New Order Received
  </div>

  <div className="bg-blue-600 px-6 py-4 rounded-2xl shadow-2xl">
    📦 Inventory Updated
  </div>

  <div className="bg-purple-600 px-6 py-4 rounded-2xl shadow-2xl">
    🤖 AI Report Generated
  </div>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Live Activity
  </h2>

  <div className="space-y-4">

    <div className="flex justify-between bg-slate-700 p-4 rounded-xl">
      <span>Ali Traders placed new order</span>
      <span className="text-green-400">2 min ago</span>
    </div>

    <div className="flex justify-between bg-slate-700 p-4 rounded-xl">
      <span>Inventory stock updated</span>
      <span className="text-blue-400">10 min ago</span>
    </div>

    <div className="flex justify-between bg-slate-700 p-4 rounded-xl">
      <span>Invoice generated successfully</span>
      <span className="text-purple-400">30 min ago</span>
    </div>

  </div>

</div>
<div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">

  <button className="bg-blue-600 hover:bg-blue-700 p-6 rounded-2xl text-xl font-bold">
    ➕ Add Product
  </button>

  <button className="bg-green-600 hover:bg-green-700 p-6 rounded-2xl text-xl font-bold">
    🧾 Create Invoice
  </button>

  <button className="bg-purple-600 hover:bg-purple-700 p-6 rounded-2xl text-xl font-bold">
    📊 Generate Report
  </button>

  <button className="bg-red-600 hover:bg-red-700 p-6 rounded-2xl text-xl font-bold">
    ⚠ Low Stock
  </button>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Employee Management
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Ali Khan
      </h3>

      <p className="text-gray-400 mt-2">
        Sales Manager
      </p>

      <p className="text-green-400 mt-4">
        Active
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Ahmed Raza
      </h3>

      <p className="text-gray-400 mt-2">
        Inventory Manager
      </p>

      <p className="text-yellow-400 mt-4">
        On Leave
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Usman Ali
      </h3>

      <p className="text-gray-400 mt-2">
        Accountant
      </p>

      <p className="text-green-400 mt-4">
        Active
      </p>
    </div>

  </div>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Finance & Accounts
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Total Revenue
      </h3>

      <p className="text-3xl font-bold text-green-400 mt-4">
        PKR 2.5M
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Expenses
      </h3>

      <p className="text-3xl font-bold text-red-400 mt-4">
        PKR 800K
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Profit
      </h3>

      <p className="text-3xl font-bold text-blue-400 mt-4">
        PKR 1.7M
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Pending Payments
      </h3>

      <p className="text-3xl font-bold text-yellow-400 mt-4">
        PKR 320K
      </p>
    </div>

  </div>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Production Management
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Daily Production
      </h3>

      <p className="text-4xl font-bold text-green-400 mt-4">
        12,500 Units
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Machine Status
      </h3>

      <p className="text-4xl font-bold text-blue-400 mt-4">
        Running
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Production Efficiency
      </h3>

      <p className="text-4xl font-bold text-purple-400 mt-4">
        92%
      </p>
    </div>

  </div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Dispatch & Logistics
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Vehicles Active
      </h3>

      <p className="text-4xl font-bold text-green-400 mt-4">
        12
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Deliveries Today
      </h3>

      <p className="text-4xl font-bold text-blue-400 mt-4">
        48
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Pending Dispatch
      </h3>

      <p className="text-4xl font-bold text-yellow-400 mt-4">
        7
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Freight Cost
      </h3>

      <p className="text-4xl font-bold text-red-400 mt-4">
        PKR 135K
      </p>
    </div>

  </div>

</div>
</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Supplier Management
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        AJ Paper Mills
      </h3>

      <p className="text-gray-400 mt-2">
        Raw Material Supplier
      </p>

      <p className="text-green-400 mt-4">
        Active Supplier
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Hassan Packaging
      </h3>

      <p className="text-gray-400 mt-2">
        Carton Material Supplier
      </p>

      <p className="text-blue-400 mt-4">
        Verified
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-2xl font-bold">
        Global Logistics
      </h3>

      <p className="text-gray-400 mt-2">
        Freight Partner
      </p>

      <p className="text-yellow-400 mt-4">
        Pending Renewal
      </p>
    </div>

  </div>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Customer Ledger
  </h2>

  <div className="space-y-4">

    <div className="bg-slate-700 p-5 rounded-2xl flex justify-between items-center">
      <div>
        <h3 className="text-2xl font-bold">
          Ashraf Sons Pharma
        </h3>

        <p className="text-gray-400 mt-2">
          Outstanding Balance
        </p>
      </div>

      <p className="text-3xl font-bold text-yellow-400">
        PKR 450K
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl flex justify-between items-center">
      <div>
        <h3 className="text-2xl font-bold">
          Nutra Pharma
        </h3>

        <p className="text-gray-400 mt-2">
          Paid Successfully
        </p>
      </div>

      <p className="text-3xl font-bold text-green-400">
        PKR 0
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl flex justify-between items-center">
      <div>
        <h3 className="text-2xl font-bold">
          Surgitex Pharma
        </h3>

        <p className="text-gray-400 mt-2">
          Pending Recovery
        </p>
      </div>

      <p className="text-3xl font-bold text-red-400">
        PKR 180K
      </p>
    </div>

  </div>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    GST & Tax Management
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        GST Collected
      </h3>

      <p className="text-3xl font-bold text-green-400 mt-4">
        PKR 580K
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        GST Paid
      </h3>

      <p className="text-3xl font-bold text-blue-400 mt-4">
        PKR 320K
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Tax Pending
      </h3>

      <p className="text-3xl font-bold text-yellow-400 mt-4">
        PKR 85K
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Filing Status
      </h3>

      <p className="text-3xl font-bold text-purple-400 mt-4">
        Updated
      </p>
    </div>

  </div>

</div>
<div className="mt-10 bg-slate-800 p-6 rounded-2xl">

  <h2 className="text-3xl font-bold mb-6">
    Paper & Raw Material
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Kraft Paper Stock
      </h3>

      <p className="text-3xl font-bold text-green-400 mt-4">
        12 Tons
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        GSM Average
      </h3>

      <p className="text-3xl font-bold text-blue-400 mt-4">
        180 GSM
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Raw Material Cost
      </h3>

      <p className="text-3xl font-bold text-yellow-400 mt-4">
        PKR 2.1M
      </p>
    </div>

    <div className="bg-slate-700 p-5 rounded-2xl">
      <h3 className="text-xl">
        Paper Wastage
      </h3>

      <p className="text-3xl font-bold text-red-400 mt-4">
        3%
      </p>
    </div>

  </div>

</div>
    </main>
  );
}