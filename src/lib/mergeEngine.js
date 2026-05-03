import * as XLSX from "xlsx";

/**
 * Normalizes a name string for fuzzy matching
 * - Lowercases
 * - Removes non-alphanumeric characters (except spaces)
 * - Trims
 * - Removes extra spaces
 */
export const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .trim()
    .replace(/\s+/g, " ");
};

/**
 * Normalizes an ID string for exact matching
 */
export const normalizeId = (id) => {
  if (!id) return "";
  return String(id).toLowerCase().trim();
};

/**
 * Compares two normalized names
 * Supports exact match, sorted word match, and subset match.
 * Returns { isMatch: boolean, reason: string }
 */
export const compareNames = (name1, name2) => {
  if (!name1 || !name2) return { isMatch: false, reason: "Missing Name" };

  if (name1 === name2) {
    return { isMatch: true, reason: "Exact Match" };
  }

  const words1 = name1.split(" ");
  const words2 = name2.split(" ");
  const sorted1 = [...words1].sort().join(" ");
  const sorted2 = [...words2].sort().join(" ");
  
  if (sorted1 === sorted2) {
    return { isMatch: true, reason: "Sorted Words Match" };
  }

  const isSubset = (subset, superset) => subset.every(w => superset.includes(w));
  
  if (words1.length >= 2 && words1.length < words2.length) {
    if (isSubset(words1, words2)) return { isMatch: true, reason: "Partial Match (File 1 name is subset)" };
  } else if (words2.length >= 2 && words2.length < words1.length) {
    if (isSubset(words2, words1)) return { isMatch: true, reason: "Partial Match (Other file name is subset)" };
  }

  return { isMatch: false, reason: "No Match" };
};

/**
 * Dynamically converts an Excel File object to a JSON array
 */
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // defval: "" ensures missing cells are populated with empty strings instead of being omitted
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

/**
 * Core engine to merge 3 arrays of objects accurately
 * Uses ID Match -> Name Match strategy
 */
export const processAndMerge = (data1, data2, data3, mappings) => {
  let mergedData = [];
  let unmatchedData = [];

  // Iterate over the primary file (data1)
  data1.forEach((row1) => {
    let matchType = "Unmatched";
    let matchedRows2 = [];
    let matchedRows3 = [];
    let matchDetails = {
      file2Reason: "Not matched",
      file3Reason: "Not matched",
      file2MatchedVal: null,
      file3MatchedVal: null
    };

    const id1 = mappings?.file1?.idKey && row1[mappings.file1.idKey] 
      ? normalizeId(row1[mappings.file1.idKey]) : null;
    const name1 = mappings?.file1?.nameKey && row1[mappings.file1.nameKey] 
      ? normalizeName(row1[mappings.file1.nameKey]) : null;

    // --- STEP 1: ID Match ---
    if (id1) {
      if (mappings?.file2?.idKey) {
        matchedRows2 = data2.filter(r => normalizeId(r[mappings.file2.idKey]) === id1);
        if (matchedRows2.length > 0) {
          matchDetails.file2Reason = `ID Match (${id1})`;
          matchDetails.file2MatchedVal = matchedRows2.length === 1 ? id1 : "Multiple IDs found";
        }
      }
      if (mappings?.file3?.idKey) {
        matchedRows3 = data3.filter(r => normalizeId(r[mappings.file3.idKey]) === id1);
        if (matchedRows3.length > 0) {
          matchDetails.file3Reason = `ID Match (${id1})`;
          matchDetails.file3MatchedVal = matchedRows3.length === 1 ? id1 : "Multiple IDs found";
        }
      }
      
      if (matchedRows2.length > 0 || matchedRows3.length > 0) {
        matchType = "ID Match";
      }
    }

    // --- STEP 2: Name Match (If ID match failed or IDs don't exist) ---
    if (matchType === "Unmatched" && name1) {
      if (mappings?.file2?.nameKey) {
        const potentialMatches = data2.map(r => {
          const n2 = normalizeName(r[mappings.file2.nameKey]);
          const comp = compareNames(name1, n2);
          return { row: r, n2, ...comp };
        }).filter(m => m.isMatch);
        
        matchedRows2 = potentialMatches.map(m => m.row);
        if (matchedRows2.length > 0) {
          matchDetails.file2Reason = `Name Match [${potentialMatches[0].reason}]`;
          matchDetails.file2MatchedVal = potentialMatches.length === 1 ? potentialMatches[0].n2 : "Multiple names found";
        }
      }

      if (mappings?.file3?.nameKey) {
        const potentialMatches = data3.map(r => {
          const n3 = normalizeName(r[mappings.file3.nameKey]);
          const comp = compareNames(name1, n3);
          return { row: r, n3, ...comp };
        }).filter(m => m.isMatch);
        
        matchedRows3 = potentialMatches.map(m => m.row);
        if (matchedRows3.length > 0) {
          matchDetails.file3Reason = `Name Match [${potentialMatches[0].reason}]`;
          matchDetails.file3MatchedVal = potentialMatches.length === 1 ? potentialMatches[0].n3 : "Multiple names found";
        }
      }

      if (matchedRows2.length > 0 || matchedRows3.length > 0) {
        matchType = "Name Match";
      }
    }

    // --- STEP 3: Conflict Detection ---
    if (matchedRows2.length > 1 || matchedRows3.length > 1) {
      matchType = "Conflict";
    }

    let finalRow2 = {};
    let finalRow3 = {};

    // If it's a conflict, we DO NOT force a merge to maintain accuracy.
    if (matchType !== "Conflict") {
      if (matchedRows2.length === 1) finalRow2 = matchedRows2[0];
      if (matchedRows3.length === 1) finalRow3 = matchedRows3[0];
    }

    // --- Combine Data ---
    const mergedRow = {
      ...row1,
      ...finalRow2,
      ...finalRow3,
      matchType,
      _sourceId: Math.random().toString(36).substr(2, 9),
      _matchDetails: {
        idSearched: id1,
        nameSearched: name1,
        ...matchDetails
      }
    };

    if (matchType === "Unmatched" || matchType === "Conflict") {
      unmatchedData.push(mergedRow);
    }
    
    mergedData.push(mergedRow);
  });

  return { mergedData, unmatchedData };
};

/**
 * Utility to export JSON array back to Excel
 */
export const exportToExcel = (data, filename = "Exported_Data.xlsx") => {
  // Remove the internal _sourceId before exporting
  const cleanData = data.map(({ _sourceId, ...rest }) => rest);
  
  const worksheet = XLSX.utils.json_to_sheet(cleanData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Data");
  XLSX.writeFile(workbook, filename);
};
