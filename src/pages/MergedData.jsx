import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Search, Settings2, FileX, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useMergeContext } from "../context/MergeContext";
import { exportToExcel } from "../lib/mergeEngine";

export function MergedData() {
  const { state } = useMergeContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Column Visibility
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState(new Set());

  if (!state.isProcessed) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <FileX className="w-16 h-16 text-slate-300 dark:text-slate-600" />
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No Data Processed</h2>
        <p className="text-slate-500">Please upload and map your files to view the merged results.</p>
        <Button onClick={() => navigate("/")}>Go to Upload</Button>
      </div>
    );
  }

  const { mergedData } = state;

  // Extract all unique columns dynamically
  const allColumns = Array.from(
    new Set(mergedData.flatMap(row => Object.keys(row)))
  ).filter(col => col !== "_sourceId");

  const toggleColumn = (col) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(col)) {
      newHidden.delete(col);
    } else {
      newHidden.add(col);
    }
    setHiddenColumns(newHidden);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let data = [...mergedData];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter(row => 
        Object.values(row).some(val => 
          String(val).toLowerCase().includes(lowerSearch)
        )
      );
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key] || "";
        const valB = b[sortConfig.key] || "";
        
        const numA = Number(valA);
        const numB = Number(valB);
        
        if (!isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "") {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [mergedData, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedData.length / rowsPerPage) || 1;
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const visibleColumns = allColumns.filter(col => !hiddenColumns.has(col));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Merged Data</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Showing {filteredAndSortedData.length} of {mergedData.length} records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => exportToExcel(filteredAndSortedData, "Merged_Results.xlsx")}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export View
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4 justify-between relative">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              className="pl-9 w-full" 
              placeholder="Search data..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="relative">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
            >
              <Settings2 className="w-4 h-4" />
              Columns
            </Button>
            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 p-2">
                <div className="text-xs font-semibold text-slate-500 mb-2 px-2 uppercase tracking-wider">Toggle Columns</div>
                {allColumns.map(col => (
                  <label key={col} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      checked={!hiddenColumns.has(col)}
                      onChange={() => toggleColumn(col)}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate" title={col}>{col}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          <Table className="relative min-w-max">
            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-sm">
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead key={col} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50" onClick={() => handleSort(col)}>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      {col}
                      {sortConfig.key === col && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row) => (
                <TableRow key={row._sourceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  {visibleColumns.map((col) => (
                    <TableCell key={col}>
                      <span className="truncate max-w-[200px] block" title={String(row[col] || "")}>
                        {row[col] !== undefined && row[col] !== "" ? String(row[col]) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {paginatedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="h-32 text-center text-slate-500">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} records
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-2">Page {currentPage} of {totalPages}</span>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
