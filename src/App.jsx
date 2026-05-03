import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { UploadFiles } from "./pages/UploadFiles";
import { MergedData } from "./pages/MergedData";
import { UnmatchedData } from "./pages/UnmatchedData";
import { Reports } from "./pages/Reports";
import { MergeProvider } from "./context/MergeContext";

export default function App() {
  return (
    <MergeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<UploadFiles />} />
            <Route path="merged" element={<MergedData />} />
            <Route path="unmatched" element={<UnmatchedData />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MergeProvider>
  );
}
