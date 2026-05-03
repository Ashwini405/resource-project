import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Search, AlertCircle, FileX } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useMergeContext } from "../context/MergeContext";
import { exportToExcel } from "../lib/mergeEngine";

export function UnmatchedData() {
  const { state } = useMergeContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  if (!state.isProcessed) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <FileX className="w-16 h-16 text-slate-300 dark:text-slate-600" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No Data Processed</h2>
        <p className="text-slate-500">Please upload your files to view the results.</p>
        <Button onClick={() => navigate("/")}>Go to Upload</Button>
      </div>
    );
  }

  const { unmatchedData } = state;

  // Extract columns dynamically
  const columns = Array.from(
    new Set(unmatchedData.flatMap(row => Object.keys(row)))
  ).filter(col => col !== "_sourceId" && col !== "matchType");

  const filteredData = unmatchedData.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Unmatched Records
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {unmatchedData.length}
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Rows from the base file that could not be matched via ID or Name.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => exportToExcel(unmatchedData, "Unmatched_Records.xlsx")}
            className="flex items-center gap-2"
            disabled={unmatchedData.length === 0}
          >
            <Download className="w-4 h-4" />
            Export Unmatched
          </Button>
        </div>
      </div>

      {unmatchedData.length > 0 ? (
        <Card className="overflow-hidden border-red-200 dark:border-red-900/50">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                className="pl-9 w-full" 
                placeholder="Search across all columns..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <Table className="relative min-w-max">
              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                <TableRow>
                  <TableHead className="sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 border-r border-slate-200 dark:border-slate-700">
                    Alert
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row) => (
                  <TableRow key={row._sourceId}>
                    <TableCell className="sticky left-0 bg-red-50/30 dark:bg-red-900/10 z-10 border-r border-red-100 dark:border-red-900/30">
                      <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col}>
                        <span className="truncate max-w-[200px] block" title={String(row[col] || "")}>
                          {row[col] !== undefined ? String(row[col]) : "-"}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-900/30">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-300">Perfect Merge!</h2>
          <p className="text-emerald-600 dark:text-emerald-400 mt-2">All records were successfully matched.</p>
        </Card>
      )}
    </div>
  );
}
