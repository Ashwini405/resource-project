import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Play, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useMergeContext } from "../context/MergeContext";
import * as mergeEngine from "../lib/mergeEngine";

export function UploadFiles() {
  const { dispatch } = useMergeContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [files, setFiles] = useState({
    file1: null,
    file2: null,
    file3: null,
  });

  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns
  const [extractedData, setExtractedData] = useState(null);
  const [headers, setHeaders] = useState({ file1: [], file2: [], file3: [], all: [] });

  const [mappings, setMappings] = useState({
    file1: { nameKey: "" },
    file2: { nameKey: "" },
    file3: { nameKey: "" },
    reports: { hoursKey: "", statusKey: "", billingKey: "" }
  });

  const handleFileChange = (key, file) => {
    if (file && !file.name.match(/\.(xlsx|xls)$/)) {
      setError("Please upload only Excel files (.xlsx, .xls)");
      return;
    }
    setError(null);
    setFiles(prev => ({ ...prev, [key]: file }));
  };

  const handleExtract = async () => {
    if (!files.file1 || !files.file2 || !files.file3) {
      setError("Please upload all 3 files before processing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data1 = await mergeEngine.parseExcelFile(files.file1);
      const data2 = await mergeEngine.parseExcelFile(files.file2);
      const data3 = await mergeEngine.parseExcelFile(files.file3);

      if (!data1.length || !data2.length || !data3.length) {
        throw new Error("One or more uploaded files are empty.");
      }

      setExtractedData({ data1, data2, data3 });

      const h1 = Object.keys(data1[0] || {});
      const h2 = Object.keys(data2[0] || {});
      const h3 = Object.keys(data3[0] || {});
      const allHeaders = Array.from(new Set([...h1, ...h2, ...h3]));

      setHeaders({ file1: h1, file2: h2, file3: h3, all: allHeaders });
      
      // Try to auto-guess for convenience
      const guess = (hdrs, keywords) => hdrs.find(h => keywords.some(k => h.toLowerCase().includes(k))) || "";
      
      setMappings({
        file1: { nameKey: guess(h1, ["name", "emp"]) },
        file2: { nameKey: guess(h2, ["name", "emp"]) },
        file3: { nameKey: guess(h3, ["name", "emp"]) },
        reports: {
          hoursKey: guess(allHeaders, ["hour", "time"]),
          statusKey: guess(allHeaders, ["status", "state", "appr"]),
          billingKey: guess(allHeaders, ["bill", "amount", "total", "price"])
        }
      });

      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred while reading the files.");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = () => {
    setLoading(true);
    // Add small delay to allow UI to update loading state
    setTimeout(() => {
      try {
        const { mergedData, unmatchedData } = mergeEngine.processAndMerge(
          extractedData.data1,
          extractedData.data2,
          extractedData.data3,
          mappings
        );

        dispatch({ type: "SET_FILES", payload: files });
        dispatch({ 
          type: "SET_MERGED_RESULTS", 
          payload: { mergedData, unmatchedData, mappings } 
        });

        navigate("/merged");
      } catch (err) {
        console.error(err);
        setError("Error during merging process.");
        setLoading(false);
      }
    }, 100);
  };

  const UploadZone = ({ id, title, description }) => (
    <div className="relative group rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
      <input
        type="file"
        accept=".xlsx,.xls"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={(e) => handleFileChange(id, e.target.files[0])}
      />
      <div className="p-6 text-center space-y-4">
        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
          files[id] ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400"
        }`}>
          {files[id] ? <CheckCircle className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {files[id] ? files[id].name : title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {files[id] ? "File ready" : description}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload & Map Files</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Upload your files, then verify column mappings to ensure 100% accurate merges.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UploadZone id="file1" title="1. Detailed Timesheet" description="Drag & drop .xlsx file here" />
            <UploadZone id="file2" title="2. Line Status" description="Drag & drop .xlsx file here" />
            <UploadZone id="file3" title="3. Summary / Billing" description="Drag & drop .xlsx file here" />
          </div>

          <Card className="bg-slate-50 dark:bg-slate-800/50 border-none">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Ready to extract?</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    We will read the columns to let you map them accurately.
                  </p>
                </div>
              </div>

              <Button 
                size="lg" 
                onClick={handleExtract} 
                disabled={loading || !files.file1 || !files.file2 || !files.file3}
                className="w-full sm:w-auto flex items-center gap-2"
              >
                {loading ? "Extracting..." : "Extract Columns"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["file1", "file2", "file3"].map((fileKey, idx) => (
              <Card key={fileKey}>
                <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 py-4">
                  <CardTitle className="text-base">File {idx + 1} Mapping</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name Column (Fallback)</label>
                    <p className="text-xs text-slate-500 mb-2">Used if automatic Name detection fails.</p>
                    <select 
                      className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      value={mappings[fileKey].nameKey}
                      onChange={(e) => setMappings(prev => ({...prev, [fileKey]: { ...prev[fileKey], nameKey: e.target.value }}))}
                    >
                      <option value="">-- Auto-detect --</option>
                      {headers[fileKey].map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-indigo-100 dark:border-indigo-900/50">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/30 py-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-base text-indigo-900 dark:text-indigo-100">Reporting Metrics Mapping</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hours Column</label>
                <select 
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  value={mappings.reports.hoursKey}
                  onChange={(e) => setMappings(prev => ({...prev, reports: { ...prev.reports, hoursKey: e.target.value }}))}
                >
                  <option value="">-- None --</option>
                  {headers.all.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status Column</label>
                <select 
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  value={mappings.reports.statusKey}
                  onChange={(e) => setMappings(prev => ({...prev, reports: { ...prev.reports, statusKey: e.target.value }}))}
                >
                  <option value="">-- None --</option>
                  {headers.all.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Billing/Amount Column</label>
                <select 
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  value={mappings.reports.billingKey}
                  onChange={(e) => setMappings(prev => ({...prev, reports: { ...prev.reports, billingKey: e.target.value }}))}
                >
                  <option value="">-- None --</option>
                  {headers.all.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button 
              size="lg" 
              onClick={handleMerge} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? "Processing..." : <><Play className="w-4 h-4 fill-current" /> Confirm & Merge</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
