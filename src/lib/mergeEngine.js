import * as XLSX from "xlsx";

/**
 * Normalizes a name string for exact matching
 * - Lowercases
 * - Trims leading/trailing spaces
 * - Replaces multiple spaces with single space
 */
export const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  let cleanName = name.toLowerCase().trim().replace(/\s+/g, " ");
  
  // Handle "Lastname, Firstname" format by flipping it
  if (cleanName.includes(",")) {
    const parts = cleanName.split(",").map(p => p.trim());
    if (parts.length === 2) {
      cleanName = `${parts[1]} ${parts[0]}`;
    } else {
      cleanName = cleanName.replace(/,/g, "");
    }
  }
  return cleanName;
};

const standardizeData = (data, mapping) => {
  return data.map(row => {
    let rawName = "";
    const keys = Object.keys(row);
    
    let firstNameKey = keys.find(k => k.trim().toLowerCase() === "first name" || k.trim().toLowerCase() === "firstname");
    let lastNameKey = keys.find(k => k.trim().toLowerCase() === "last name" || k.trim().toLowerCase() === "lastname");
    
    // Check for common full name columns using aggressive cleaning (removes numbers, spaces, newlines)
    let fullNameKey = keys.find(k => {
      const cleanKey = k.toLowerCase().replace(/[^a-z]/g, "");
      return ["fullname", "name", "employeename", "staffname", "resourcename", "employee"].includes(cleanKey);
    });

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

  const groupBy = (data, headersSet) => {
    const map = new Map();
    data.forEach(row => {
      Object.keys(row).forEach(k => headersSet.add(k));
      const fn = row.fullName;
      if (!fn || fn === "unknown") return;
      if (!map.has(fn)) map.set(fn, []);
      map.get(fn).push(row);
    });
    return map;
  };

  const headers1 = new Set();
  const headers2 = new Set();
  const headers3 = new Set();

  const map1 = groupBy(stdData1, headers1);
  const map2 = groupBy(stdData2, headers2);
  const map3 = groupBy(stdData3, headers3);

  let mergedData = [];
  const allNames = new Set([...map1.keys(), ...map2.keys(), ...map3.keys()]);

  for (const name of allNames) {
    const rows1 = map1.get(name) || [];
    const rows2 = map2.get(name) || [];
    const rows3 = map3.get(name) || [];

    const maxRows = Math.max(rows1.length, rows2.length, rows3.length, 1);

    for (let i = 0; i < maxRows; i++) {
      // If a file only has 1 row (like HR data), repeat it for every timesheet row
      const r1 = rows1[i] || rows1[0] || {};
      const r2 = rows2[i] || rows2[0] || {};
      const r3 = rows3[i] || rows3[0] || {};

      // Start with base data
      let baseName = r1["Employee Name"] || r1["Employee"] || 
                     r2["Employee Name"] || r2["Employee"] || 
                     r3["Employee Name"] || r3["Employee"] || name;

      const mergedRow = { 
        fullName: name, 
        "Employee Name": baseName,
        _sourceId: Math.random().toString(36).substr(2, 9) 
      };

      // Helper to safely add columns without destroying existing data
      const safeAddColumns = (sourceData, headers, suffix) => {
        headers.forEach(k => {
          if (k === "fullName" || k === "Employee Name") return;
          
          let finalKey = k;
          if (finalKey in mergedRow && mergedRow[finalKey] !== "") {
            // Only append suffix if there is a real collision (different data)
            if (sourceData[k] && sourceData[k] !== mergedRow[finalKey]) {
              finalKey = `${k} ${suffix}`;
            }
          }
          
          mergedRow[finalKey] = (sourceData && sourceData[k] !== undefined) ? sourceData[k] : (mergedRow[finalKey] || "");
        });
      };

      safeAddColumns(r1, Array.from(headers1), "(File 1)");
      safeAddColumns(r2, Array.from(headers2), "(File 2)");
      safeAddColumns(r3, Array.from(headers3), "(File 3)");

      mergedData.push(mergedRow);
    }
  }

  // --- NEW LOGIC: GROUP AND AGGREGATE ---
  const groupedMap = new Map();

  // Helper to find a value in a row using fuzzy key matching
  const findValue = (row, keywords) => {
    const keys = Object.keys(row);
    for (const key of keys) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, ""); // strip spaces/symbols
      if (keywords.some(kw => lowerKey.includes(kw))) {
        if (row[key]) return row[key];
      }
    }
    return "";
  };

  mergedData.forEach(row => {
    const fn = row.fullName || "Unknown Employee";
    if (!groupedMap.has(fn)) {
      // Create a properly formatted Display Name (flip comma names, capitalize words)
      let rawName = row["Employee Name"] || row["Employee"] || row["FULL_NAME"] || fn;
      if (typeof rawName === "string" && rawName.includes(",")) {
        const parts = rawName.split(",").map(p => p.trim());
        if (parts.length === 2) rawName = `${parts[1]} ${parts[0]}`;
      }
      const displayName = String(rawName).split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      groupedMap.set(fn, {
        "Employee Name": displayName,
        "Total Hours": 0,
        "Total Amount": 0,
        "Total Cost FL": 0,
        "Total Cost BL": 0,
        "Projects": new Set(),
        "Clients": new Set(),
        "Statuses": new Set(),
        "Email": row["EmployeeEmailAddress"] || row["Email"] || "",
        "Manager": row["Manager Name"] || row["Manager"] || "",
        "Department": row["Department"] || row["Practice"] || "",
        "Maconomy ID": row["Maconomy ID"] || row["ID"] || row["Employee No."] || "",
        _details: []
      });
    }

    const group = groupedMap.get(fn);
    
    // Aggregate Hours & Costs
    const hrs = parseFloat(row["Hours"] || row["Total Qty"] || row["Qty"] || 0);
    if (!isNaN(hrs)) group["Total Hours"] += hrs;

    const amt = parseFloat(row["Total Amount"] || row["Total Cost"] || row["Amount"] || 0);
    if (!isNaN(amt)) group["Total Amount"] += amt;

    const costFL = parseFloat(row["TS Total Cost FL"] || row["Total Cost FL"] || 0);
    if (!isNaN(costFL)) group["Total Cost FL"] += costFL;

    const costBL = parseFloat(row["TS Total Cost BL"] || row["Total Cost BL"] || 0);
    if (!isNaN(costBL)) group["Total Cost BL"] += costBL;

    // Aggregate Arrays using flexible lookup
    const project = findValue(row, ["project", "jobtitle", "job#", "brand"]);
    if (project) group["Projects"].add(project);

    const client = findValue(row, ["client", "customer"]);
    if (client) group["Clients"].add(client);

    const status = findValue(row, ["status", "reason", "remark"]);
    if (status) group["Statuses"].add(status);

    // If single values were missing, try to fill them
    if (!group["Email"]) group["Email"] = findValue(row, ["email"]);
    if (!group["Manager"]) group["Manager"] = findValue(row, ["manager", "lead", "supervisor", "director"]);
    if (!group["Department"]) group["Department"] = findValue(row, ["department", "practice", "dept", "function", "group"]);
    if (!group["Maconomy ID"]) group["Maconomy ID"] = findValue(row, ["maconomy", "employeeid", "employeeno", "staffid", "resourceno", "id"]);

    // Save row details (removing fullName and keeping internal tracking)
    const { fullName, ...cleanRow } = row;
    group._details.push(cleanRow);
  });

  const finalGroupedData = Array.from(groupedMap.values()).map(group => ({
    ...group,
    "Total Hours": Number(group["Total Hours"].toFixed(2)),
    "Total Amount": Number(group["Total Amount"].toFixed(2)),
    "Total Cost FL": Number(group["Total Cost FL"].toFixed(2)),
    "Total Cost BL": Number(group["Total Cost BL"].toFixed(2)),
    "Projects": Array.from(group["Projects"]),
    "Clients": Array.from(group["Clients"]),
    "Statuses": Array.from(group["Statuses"]),
    _sourceId: Math.random().toString(36).substr(2, 9),
  }));

  return { mergedData: finalGroupedData, unmatchedData: [] };
};

export const exportToExcel = (data, filename = "Exported_Data.xlsx") => {
  // Strip out internal properties before export
  const cleanData = data.map(row => {
    const { _sourceId, _details, ...rest } = row;
    
    // Convert arrays to strings for Excel
    const formattedRow = {};
    Object.keys(rest).forEach(k => {
      if (Array.isArray(rest[k])) {
        formattedRow[k] = rest[k].join(", ");
      } else {
        formattedRow[k] = rest[k];
      }
    });
    
    return formattedRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(cleanData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Results");
  XLSX.writeFile(workbook, filename);
};

export const exportDetailedExcel = (groupedData, filename = "Exported_Detailed_Data.xlsx") => {
  const flatData = [];
  
  groupedData.forEach(group => {
    if (group._details && group._details.length > 0) {
      group._details.forEach(detailRow => {
        // detailRow has the raw timesheet data (already stripped of _sourceId/fullName inside merge engine)
        // Let's ensure no internal keys leak
        const { _sourceId, ...cleanDetail } = detailRow;
        
        // Re-inject the formatted Employee Name so the exported row has a clean name
        flatData.push({
          "Employee Name": group["Employee Name"],
          ...cleanDetail
        });
      });
    }
  });

  if (flatData.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(flatData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed Results");
  XLSX.writeFile(workbook, filename);
};
