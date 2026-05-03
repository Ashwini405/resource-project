import { useNavigate } from "react-router-dom";
import { FileX, PieChart as PieChartIcon, TrendingUp, AlertTriangle, Clock, DollarSign, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useMergeContext } from "../context/MergeContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function Reports() {
  const { state } = useMergeContext();
  const navigate = useNavigate();

  if (!state.isProcessed) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <FileX className="w-16 h-16 text-slate-300 dark:text-slate-600" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No Data Processed</h2>
        <p className="text-slate-500">Please upload and map your files to view reports.</p>
        <Button onClick={() => navigate("/")}>Go to Upload</Button>
      </div>
    );
  }

  const { mergedData, unmatchedData, mappings } = state;

  const totalProcessed = mergedData.length + unmatchedData.length;
  const matchRate = totalProcessed > 0 ? ((mergedData.length / totalProcessed) * 100).toFixed(1) : 0;

  const idMatches = mergedData.filter(d => d.matchType === "ID Match").length;
  const nameMatches = mergedData.filter(d => d.matchType === "Name Match").length;
  const conflicts = unmatchedData.filter(d => d.matchType === "Conflict").length;
  const unmapped = unmatchedData.filter(d => d.matchType === "Unmatched").length;

  const pieData = [
    { name: 'ID Match', value: idMatches },
    { name: 'Name Match', value: nameMatches },
    { name: 'Conflict', value: conflicts },
    { name: 'Unmatched', value: unmapped },
  ];

  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

  // Reports should use only validated data (ID Match or Name Match)
  const validData = mergedData.filter(d => d.matchType === "ID Match" || d.matchType === "Name Match");

  let totalHours = 0;
  let totalBilling = 0;
  let statusCounts = {};
  
  const { hoursKey, statusKey, billingKey } = mappings?.reports || {};

  validData.forEach(row => {
    if (hoursKey && row[hoursKey]) {
      const h = parseFloat(row[hoursKey]);
      if (!isNaN(h)) totalHours += h;
    }
    if (billingKey && row[billingKey]) {
      // remove currency symbols and commas before parsing
      const b = parseFloat(String(row[billingKey]).replace(/[^0-9.-]+/g, ""));
      if (!isNaN(b)) totalBilling += b;
    }
    if (statusKey && row[statusKey]) {
      const status = String(row[statusKey]).trim();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  });

  const statusChartData = Object.keys(statusCounts).map(key => ({
    name: key,
    count: statusCounts[key]
  }));

  // Create Bar chart data for top 10 employees by hours
  let employeeHours = {};
  validData.forEach(row => {
    // Assuming file1 has the main name mapping
    const nameCol = mappings?.file1?.nameKey || Object.keys(row).find(k => k.toLowerCase().includes("name"));
    const name = nameCol ? row[nameCol] : "Unknown";
    if (hoursKey && row[hoursKey]) {
      const h = parseFloat(row[hoursKey]);
      if (!isNaN(h)) {
        employeeHours[name] = (employeeHours[name] || 0) + h;
      }
    }
  });

  const employeeHoursData = Object.keys(employeeHours)
    .map(name => ({ name, hours: employeeHours[name] }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10); // Top 10

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Merge Summary & Insights</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          High-level insights based on validated (successfully matched) data.
        </p>
      </div>

      {/* Top row: Match KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Rows</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalProcessed}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Match Accuracy</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{matchRate}%</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={unmatchedData.length > 0 ? "border-amber-200 dark:border-amber-900/50" : ""}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Failed / Unmatched</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{unmapped}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={conflicts > 0 ? "border-red-200 dark:border-red-900/50" : ""}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Conflicts</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{conflicts}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/50 flex items-center justify-center">
              <FileX className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle row: Business Metrics extracted from mappings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800 border-indigo-100 dark:border-indigo-900/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                <Clock className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-600/80 dark:text-indigo-400/80 uppercase tracking-wider">Total Valid Hours</p>
                <p className="text-4xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">
                  {hoursKey ? totalHours.toLocaleString() : "N/A"}
                </p>
                <p className="text-xs text-indigo-500 mt-1">Based on column: {hoursKey || "Not mapped"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 border-emerald-100 dark:border-emerald-900/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                <DollarSign className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">Total Billing</p>
                <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                  {billingKey ? `$${totalBilling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                </p>
                <p className="text-xs text-emerald-500 mt-1">Based on column: {billingKey || "Not mapped"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Match Strategy Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {statusKey && statusChartData.length > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Approval Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {hoursKey && employeeHoursData.length > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Top 10 Employees by Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeHoursData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 12 }} />
                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="hours" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
