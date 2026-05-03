import * as XLSX from "xlsx";

/**
 * Normalizes a name string for exact matching
 * - Lowercases
 * - Trims leading/trailing spaces
 * - Replaces multiple spaces with single space
 */
export const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase().trim().replace(/\s+/g, " ");
};

const standardizeData = (data, mapping) => {
  return data.map(row => {
    let rawName = "";
    const keys = Object.keys(row);
    
    let firstNameKey = keys.find(k => k.trim().toLowerCase() === "first name" || k.trim().toLowerCase() === "firstname");
    let lastNameKey = keys.find(k => k.trim().toLowerCase() === "last name" || k.trim().toLowerCase() === "lastname");
    
    // Check for common full name columns, prioritizing explicit "name" columns over just "employee"
    let fullNameKey = keys.find(k => {
      const lower = k.trim().toLowerCase();
      return ["full name", "fullname", "name", "employee name", "staff name", "resource name"].includes(lower);
    }) || keys.find(k => k.trim().toLowerCase() === "employee");

    if (firstNameKey && lastNameKey) {
      rawName = `${row[firstNameKey] || ""} ${row[lastNameKey] || ""}`.trim();
      row["FULL_NAME"] = rawName;
    } else if (fullNameKey) {
      rawName = row[fullNameKey];
    } else if (mapping && mapping.nameKey && row[mapping.nameKey]) {
      rawName = row[mapping.nameKey];
    }

    const normalized_name = normalizeName(String(rawName || ""));

    return {
      fullName: normalized_name,
      ...row
    };
  });
};

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 1. Read sheet as array of arrays to find the real header row
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
        
        if (rawData.length === 0) {
          resolve([]);
          return;
        }

        // 2. Identify the header row by finding the FIRST row with a significant number of columns
        // This handles metadata rows at the top while avoiding skipping headers if one or two column names are missing
        let headerRowIndex = 0;
        let maxCols = 0;
        const colsPerRow = [];

        // Check the first 20 rows to find the maximum columns
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
          const row = rawData[i];
          const filledCols = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== "").length;
          colsPerRow.push(filledCols);
          if (filledCols > maxCols) maxCols = filledCols;
        }

        // The header row is the first row that has at least 80% of the max columns (and > 1 column)
        const threshold = maxCols * 0.8;
        for (let i = 0; i < colsPerRow.length; i++) {
          if (colsPerRow[i] >= threshold && colsPerRow[i] > 1) {
            headerRowIndex = i;
            break;
          }
        }
        
        // 3. Parse properly starting from the detected header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "", raw: false });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const processAndMerge = (data1, data2, data3, mappings) => {
  const stdData1 = standardizeData(data1, mappings?.file1);
  const stdData2 = standardizeData(data2, mappings?.file2);
  const stdData3 = standardizeData(data3, mappings?.file3);

  const map2 = new Map();
  const headers2 = new Set();
  stdData2.forEach(row => {
    Object.keys(row).forEach(k => headers2.add(k));
    if (row.fullName && !map2.has(row.fullName)) {
      map2.set(row.fullName, row);
    }
  });

  const map3 = new Map();
  const headers3 = new Set();
  stdData3.forEach(row => {
    Object.keys(row).forEach(k => headers3.add(k));
    if (row.fullName && !map3.has(row.fullName)) {
      map3.set(row.fullName, row);
    }
  });

  const emptyRow2 = Array.from(headers2).reduce((acc, key) => {
    if (key !== "fullName") acc[key] = "";
    return acc;
  }, {});
  
  const emptyRow3 = Array.from(headers3).reduce((acc, key) => {
    if (key !== "fullName") acc[key] = "";
    return acc;
  }, {});

  let mergedData = [];
  
  stdData1.forEach(row1 => {
    const row2 = map2.get(row1.fullName) || {};
    const row3 = map3.get(row1.fullName) || {};

    const { fullName: fn1, ...file1Data } = row1;
    const { fullName: fn2, ...file2Data } = row2;
    const { fullName: fn3, ...file3Data } = row3;

    const mergedRow = {
      ...file1Data,
      ...emptyRow2,
      ...file2Data,
      ...emptyRow3,
      ...file3Data,
      _sourceId: Math.random().toString(36).substr(2, 9),
    };
    
    mergedData.push(mergedRow);
  });

  return { mergedData, unmatchedData: [] };
};

export const exportToExcel = (data, filename = "Exported_Data.xlsx") => {
  const cleanData = data.map(({ _sourceId, ...rest }) => rest);
  const worksheet = XLSX.utils.json_to_sheet(cleanData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Data");
  XLSX.writeFile(workbook, filename);
};
