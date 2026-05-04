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

const namesHaveStrongPrefixMatch = (nameParts, existingParts, levenshtein) => {
  const shorter = nameParts.length <= existingParts.length ? nameParts : existingParts;
  const longer = nameParts.length <= existingParts.length ? existingParts : nameParts;

  if (shorter.length < 2 || longer.length - shorter.length > 2) return false;

  return shorter.every((part, index) => {
    const other = longer[index];
    const maxLen = Math.max(part.length, other.length);
    return part === other || (maxLen >= 4 && levenshtein(part, other) <= Math.floor(maxLen * 0.25));
  });
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

export const processAndMerge = (data1, data2, mappings) => {
  const stdData1 = standardizeData(data1, mappings?.file1);
  const stdData2 = standardizeData(data2, mappings?.file2);

  const headers1 = new Set();
  const headers2 = new Set();
  
  stdData1.forEach(r => Object.keys(r).forEach(k => headers1.add(k)));
  stdData2.forEach(r => Object.keys(r).forEach(k => headers2.add(k)));

  // --- ENTITY RESOLUTION ALGORITHM ---
  // Match rows across files using ID, Email, or Name to prevent broken links
  const extractID = (row) => {
    // Priority 1: exact column named "Maconomy ID" or "Employee No."
    for (const key of Object.keys(row)) {
      const trimKey = key.trim();
      if (trimKey === "Maconomy ID" || trimKey === "Employee No." || trimKey === "Employee No") {
        const val = String(row[key] || "").trim();
        if (val && val !== "-" && /\d{5,8}/.test(val)) return val.match(/\d{5,8}/)[0];
      }
    }
    // Priority 2: fuzzy keyword match, but only if value looks like an ID (numeric)
    for (const key of Object.keys(row)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (["maconomy", "employeeid", "employeeno", "staffid", "resourceno"].some(kw => cleanKey.includes(kw))) {
        const val = String(row[key] || "").trim();
        if (val && val !== "-" && /^\d{5,8}$/.test(val)) return val;
      }
    }
    return null;
  };

  const extractEmail = (row) => {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes("email") || key.toLowerCase().includes("mail")) {
        const val = String(row[key]).trim();
        if (val.includes("@")) return val.toLowerCase();
      }
    }
    // Aggressive fallback
    for (const key of Object.keys(row)) {
      const val = String(row[key]).trim();
      if (val.includes("@") && val.includes(".") && !val.includes(" ")) return val.toLowerCase();
    }
    return null;
  };

  // Levenshtein distance for fuzzy name matching
  const levenshtein = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[a.length][b.length];
  };

  const entities = [];
  const unmatchedData = [];

  // 1. Process Master List (File 1)
  stdData1.forEach(row => {
    const name = row.fullName && row.fullName !== "unknown" ? row.fullName : null;
    const id = extractID(row);
    const email = extractEmail(row);

    let entity = entities.find(e => {
      if (id && e.ids.has(id)) return true;
      if (email && e.emails.has(email)) return true;
      if (name && e.names.has(name)) return true;
      
      // Fuzzy name fallback (handles substrings and swapped "Last, First" orders)
      if (name) {
        const cleanName = name.replace(/[^a-z]/g, "");
        const nameParts = name.toLowerCase().replace(/[^a-z ]/g, " ").split(" ").filter(p => p.length > 1);
        
        for (const existingName of e.names) {
           const cleanExisting = existingName.replace(/[^a-z]/g, "");
           const existingParts = existingName.toLowerCase().replace(/[^a-z ]/g, " ").split(" ").filter(p => p.length > 1);
           
           // Direct substring match — only if lengths are close (within 20%) to avoid "Sue Anne Dolo" matching "Sue Anne Dolo Molintas"
           if (cleanName.length >= 4 && cleanExisting.length >= 4) {
             const lenRatio = Math.min(cleanName.length, cleanExisting.length) / Math.max(cleanName.length, cleanExisting.length);
             if (lenRatio >= 0.8 && (cleanExisting.includes(cleanName) || cleanName.includes(cleanExisting))) return true;
           }
           
           // Word reordering match — require ALL parts from BOTH sides to match (strict bidirectional)
           if (nameParts.length > 0 && existingParts.length > 0) {
             const allPartsMatch1 = nameParts.every(p => existingName.toLowerCase().includes(p));
             const allPartsMatch2 = existingParts.every(p => name.toLowerCase().includes(p));
             if (allPartsMatch1 && allPartsMatch2) return true;
           }

           // High-confidence omitted trailing surname match:
           // "Sue Anne Dolo" should match "Sue Anne Dolo Molintas".
           if (namesHaveStrongPrefixMatch(nameParts, existingParts, levenshtein)) return true;

           // Levenshtein tolerance for short typos / spacing differences
           const maxLen = Math.max(cleanName.length, cleanExisting.length);
           if (maxLen >= 6 && levenshtein(cleanName, cleanExisting) <= Math.floor(maxLen * 0.15)) return true;

           // Partial word fuzzy match: subset match
           if (nameParts.length >= 2 && existingParts.length >= 2) {
             const fuzzyWordMatch = (partsA, partsB) =>
               partsA.every(pa => partsB.some(pb => {
                 const ml = Math.max(pa.length, pb.length);
                 return pa === pb || (ml >= 4 && levenshtein(pa, pb) <= Math.floor(ml * 0.25));
               }));
             
             const shorterParts = nameParts.length <= existingParts.length ? nameParts : existingParts;
             const longerParts = nameParts.length <= existingParts.length ? existingParts : nameParts;

             if (fuzzyWordMatch(shorterParts, longerParts)) return true;
           }

        }
      }
      return false;
    });

    if (entity) {
      if (name) entity.names.add(name);
      if (id) entity.ids.add(id);
      if (email) entity.emails.add(email);
      entity.rows1.push(row);
    } else {
      entities.push({
        ids: new Set(id ? [id] : []),
        emails: new Set(email ? [email] : []),
        names: new Set(name ? [name] : []),
        rows1: [row],
        rows2: []
      });
    }
  });

  // 2. Process Additional Data (File 2)
  stdData2.forEach(row => {
    const name = row.fullName && row.fullName !== "unknown" ? row.fullName : null;
    const id = extractID(row);
    const email = extractEmail(row);

    let entity = entities.find(e => {
      if (id && e.ids.has(id)) return true;
      if (email && e.emails.has(email)) return true;
      if (name && e.names.has(name)) return true;
      
      // Fuzzy name fallback
      if (name) {
        const cleanName = name.replace(/[^a-z]/g, "");
        const nameParts = name.toLowerCase().replace(/[^a-z ]/g, " ").split(" ").filter(p => p.length > 1);
        
        for (const existingName of e.names) {
           const cleanExisting = existingName.replace(/[^a-z]/g, "");
           const existingParts = existingName.toLowerCase().replace(/[^a-z ]/g, " ").split(" ").filter(p => p.length > 1);
           
           if (cleanName.length >= 4 && cleanExisting.length >= 4) {
             const lenRatio = Math.min(cleanName.length, cleanExisting.length) / Math.max(cleanName.length, cleanExisting.length);
             if (lenRatio >= 0.8 && (cleanExisting.includes(cleanName) || cleanName.includes(cleanExisting))) return true;
           }
           
           if (nameParts.length > 0 && existingParts.length > 0) {
             const allPartsMatch1 = nameParts.every(p => existingName.toLowerCase().includes(p));
             const allPartsMatch2 = existingParts.every(p => name.toLowerCase().includes(p));
             if (allPartsMatch1 && allPartsMatch2) return true;
           }

           // High-confidence omitted trailing surname match:
           // "Sue Anne Dolo" should match "Sue Anne Dolo Molintas".
           if (namesHaveStrongPrefixMatch(nameParts, existingParts, levenshtein)) return true;

           // Levenshtein tolerance for short typos / spacing differences
           const maxLen = Math.max(cleanName.length, cleanExisting.length);
           if (maxLen >= 6 && levenshtein(cleanName, cleanExisting) <= Math.floor(maxLen * 0.15)) return true;

           // Partial word fuzzy match: subset match
           if (nameParts.length >= 2 && existingParts.length >= 2) {
             const fuzzyWordMatch = (partsA, partsB) =>
               partsA.every(pa => partsB.some(pb => {
                 const ml = Math.max(pa.length, pb.length);
                 return pa === pb || (ml >= 4 && levenshtein(pa, pb) <= Math.floor(ml * 0.25));
               }));
             
             const shorterParts = nameParts.length <= existingParts.length ? nameParts : existingParts;
             const longerParts = nameParts.length <= existingParts.length ? existingParts : nameParts;

             if (fuzzyWordMatch(shorterParts, longerParts)) return true;
           }
        }
      }
      return false;
    });

    if (entity) {
      if (name) entity.names.add(name);
      if (id) entity.ids.add(id);
      if (email) entity.emails.add(email);
      entity.rows2.push(row);
    } else {
      // No HR match found — create a stub entity so this employee still appears in results
      entities.push({
        ids: new Set(id ? [id] : []),
        emails: new Set(email ? [email] : []),
        names: new Set(name ? [name] : []),
        rows1: [], // no HR data
        rows2: [row]
      });
    }
  });

  let mergedData = [];

  // DEBUG: log unmatched entity names to help diagnose missing data
  if (typeof import.meta.env === "undefined" || import.meta.env.DEV) {
    const missingHR = entities.filter(e => e.rows2.length === 0);
    if (missingHR.length > 0) {
      console.warn('[MergeEngine] Employees in timesheet with NO HR master match:', 
        missingHR.map(e => Array.from(e.names).join(' / ')));
    }
  }

  // 3. Zip rows for each entity
  for (const entity of entities) {
    const maxRows = Math.max(entity.rows1.length, entity.rows2.length, 1);
    
    // Pick the best display name for this entity
    let primaryName = Array.from(entity.names)[0] || "Unknown Employee";

    for (let i = 0; i < maxRows; i++) {
      const r1 = entity.rows1[i] || {};
      const r2 = entity.rows2[i] || {};

      let baseName = r1["Employee Name"] || r1["Employee"] ||
        r2["Employee Name"] || r2["Employee"] || primaryName;

      const mergedRow = {
        fullName: primaryName,
        "Employee Name": baseName,
        _sourceId: Math.random().toString(36).substr(2, 9)
      };

      const safeAddColumns = (sourceData, headers, suffix) => {
        headers.forEach(k => {
          if (k === "fullName" || k === "Employee Name") return;
          let finalKey = k;
          if (finalKey in mergedRow && mergedRow[finalKey] !== "") {
            if (sourceData[k] && sourceData[k] !== mergedRow[finalKey]) {
              finalKey = `${k} ${suffix}`;
            }
          }
          mergedRow[finalKey] = (sourceData && sourceData[k] !== undefined) ? sourceData[k] : (mergedRow[finalKey] || "");
        });
      };

      safeAddColumns(r1, Array.from(headers1), "(File 1)");
      safeAddColumns(r2, Array.from(headers2), "(File 2)");

      mergedData.push(mergedRow);
    }
  }

  // --- NEW LOGIC: GROUP AND AGGREGATE ---
  const groupedMap = new Map();

  // Helper to find a value in a row using fuzzy key matching
  const findValue = (row, keywords) => {
    const keys = Object.keys(row).filter(k => k !== "_sourceId" && k !== "_details");
    for (const key of keys) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, ""); // strip spaces/symbols
      if (keywords.some(kw => lowerKey.includes(kw))) {
        const val = row[key];
        if (val && String(val).trim() !== "" && String(val).trim() !== "-") return val;
      }
    }
    return "";
  };

  // Helper to find all valid values across all matching columns
  const findAllValues = (row, keywords) => {
    const keys = Object.keys(row).filter(k => k !== "_sourceId" && k !== "_details");
    const values = [];
    for (const key of keys) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (keywords.some(kw => lowerKey.includes(kw))) {
        const val = row[key];
        if (val && String(val).trim() !== "" && String(val).trim() !== "-") {
          values.push(val);
        }
      }
    }
    return values;
  };

  // Aggressive value-based fallback for Email
  const findEmailAnywhere = (row) => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    for (const key of Object.keys(row)) {
      if (key === "_sourceId" || key === "_details") continue;
      const val = String(row[key]);
      const match = val.match(emailRegex);
      if (match) {
        return match[0];
      }
    }
    return "";
  };

  // Aggressive value-based fallback for Maconomy ID (7 digit number)
  const findMaconomyAnywhere = (row) => {
    for (const key of Object.keys(row)) {
      if (key === "_sourceId" || key === "_details") continue;
      const val = String(row[key]).trim();
      if (/^\d{7}$/.test(val)) {
        return val;
      }
    }
    return "";
  };

  mergedData.forEach(row => {
    const fn = row.fullName || "Unknown Employee";
    if (!groupedMap.has(fn)) {
      // Build display name — prefer Employee Name from timesheet (may be "Last, First")
      let rawName = row["Employee Name"] || row["Employee"] || row["FULL_NAME"] || fn;
      if (typeof rawName === "string" && rawName.includes(",")) {
        const parts = rawName.split(",").map(p => p.trim());
        if (parts.length === 2) rawName = `${parts[1]} ${parts[0]}`;
      }
      const displayName = String(rawName).split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      // Pre-fill from this first row so stub entities get timesheet fields immediately
      const initEmail   = findValue(row, ["email", "employeeemailaddress", "mail"]) || findEmailAnywhere(row);
      const initManager = findValue(row, ["manager", "lead", "supervisor", "director", "managername"]);
      const initDept    = findValue(row, ["department", "practice", "dept", "function"]);
      const initTitle   = findValue(row, ["jobtitle", "title", "role", "designation", "position"]);
      const initOffice  = findValue(row, ["office", "location", "branch", "city"]);
      const initCountry = findValue(row, ["country", "region"]);
      const initValidation = findValue(row, ["validation"]);
      const rawId       = findValue(row, ["maconomy", "employeeid", "employeeno", "staffid", "resourceno"]);
      const initID      = (rawId && /^\d{5,8}$/.test(String(rawId).trim())) ? String(rawId).trim() : findMaconomyAnywhere(row);

      groupedMap.set(fn, {
        "Employee Name": displayName,
        "Total Hours": 0,
        "Total Amount": 0,
        "Total Cost FL": 0,
        "Total Cost BL": 0,
        "Projects": new Set(),
        "Clients": new Set(),
        "Statuses": new Set(),
        "Email":       initEmail,
        "Manager":     initManager,
        "Department":  initDept,
        "Maconomy ID": initID,
        "Job Title":   initTitle,
        "Office":      initOffice,
        "Country":     initCountry,
        "Validation":  initValidation,
        _details: []
      });
    }

    const group = groupedMap.get(fn);

    // Aggregate Hours & Costs from ALL matching columns to prevent missing data
    findAllValues(row, ["hours", "totalqty", "qty"]).forEach(v => {
      const num = parseFloat(v);
      if (!isNaN(num)) group["Total Hours"] += num;
    });

    findAllValues(row, ["totalamount", "totalcost", "amount"]).forEach(v => {
      const num = parseFloat(v);
      if (!isNaN(num)) group["Total Amount"] += num;
    });

    findAllValues(row, ["tstotalcostfl", "totalcostfl"]).forEach(v => {
      const num = parseFloat(v);
      if (!isNaN(num)) group["Total Cost FL"] += num;
    });

    findAllValues(row, ["tstotalcostbl", "totalcostbl"]).forEach(v => {
      const num = parseFloat(v);
      if (!isNaN(num)) group["Total Cost BL"] += num;
    });

    // Aggregate Arrays using flexible lookup
    const projects = findAllValues(row, ["project", "jobtitle", "job#", "brand"]);
    projects.forEach(p => group["Projects"].add(p));

    const clients = findAllValues(row, ["client", "customer"]);
    clients.forEach(c => group["Clients"].add(c));

    const statuses = findAllValues(row, ["status", "reason", "remark"]);
    statuses.forEach(s => group["Statuses"].add(s));

    // If single values were missing, try to fill them using headers
    const isValid = (v) => v && String(v).trim() !== "" && String(v).trim() !== "-";
    if (!isValid(group["Email"])) group["Email"] = findValue(row, ["email", "employeeemailaddress", "mail"]);
    if (!isValid(group["Manager"])) group["Manager"] = findValue(row, ["manager", "lead", "supervisor", "director", "managername"]);
    if (!isValid(group["Department"])) group["Department"] = findValue(row, ["department", "practice", "dept", "function"]);
    if (!isValid(group["Maconomy ID"])) {
      // Only accept numeric values for Maconomy ID
      const rawId = findValue(row, ["maconomy", "employeeid", "employeeno", "staffid", "resourceno"]);
      if (isValid(rawId) && /^\d{5,8}$/.test(String(rawId).trim())) group["Maconomy ID"] = String(rawId).trim();
    }
    if (!isValid(group["Job Title"])) group["Job Title"] = findValue(row, ["jobtitle", "title", "role", "designation", "position"]);
    if (!isValid(group["Office"])) group["Office"] = findValue(row, ["office", "location", "branch", "city"]);
    if (!isValid(group["Country"])) group["Country"] = findValue(row, ["country", "region"]);
    if (!isValid(group["Validation"])) group["Validation"] = findValue(row, ["validation"]);

    // Aggressive value-based fallbacks if headers failed completely
    if (!isValid(group["Email"])) group["Email"] = findEmailAnywhere(row);
    if (!isValid(group["Maconomy ID"])) group["Maconomy ID"] = findMaconomyAnywhere(row);

    // Save row details (removing fullName and keeping internal tracking)
    const cleanRow = { ...row };
    delete cleanRow.fullName;
    group._details.push(cleanRow);
  });

  // --- CROSS-ROW PROPAGATION: fill missing fields from any detail row in the group ---
  Array.from(groupedMap.values()).forEach(group => {
    const isValid = (v) => v && String(v).trim() !== "" && String(v).trim() !== "-";
    const fieldDefs = [
      { key: "Email",       keywords: ["email", "employeeemailaddress", "mail"] },
      { key: "Manager",     keywords: ["manager", "lead", "supervisor", "director", "managername"] },
      { key: "Department",  keywords: ["department", "practice", "dept", "function"] },
      { key: "Maconomy ID", keywords: ["maconomy", "employeeid", "employeeno", "staffid", "resourceno"] },
      { key: "Job Title",   keywords: ["jobtitle", "title", "role", "designation", "position"] },
      { key: "Office",      keywords: ["office", "location", "branch", "city"] },
      { key: "Country",     keywords: ["country", "region"] },
      { key: "Validation",  keywords: ["validation"] }
    ];
    group._details.forEach(detailRow => {
      fieldDefs.forEach(({ key, keywords }) => {
        if (isValid(group[key])) return;
        const val = findValue(detailRow, keywords);
        if (isValid(val)) group[key] = val;
      });
    });
  });

  // --- PROPAGATE MASTER DATA TO DETAILS ---
  Array.from(groupedMap.values()).forEach(group => {
    const masterFields = [
      { key: "Email", keywords: ["email", "employeeemailaddress"] },
      { key: "Manager", keywords: ["manager", "managername", "lead", "supervisor", "director"] },
      { key: "Department", keywords: ["department", "practice", "dept", "function"] },
      { key: "Maconomy ID", keywords: ["maconomy", "employeeid", "employeeno", "staffid", "resourceno"] },
      { key: "Job Title", keywords: ["jobtitle", "title", "role", "designation", "position"] },
      { key: "Office", keywords: ["office", "location", "branch", "city"] },
      { key: "Country", keywords: ["country", "region"] },
      { key: "Validation", keywords: ["validation"] }
    ];

    group._details.forEach(detailRow => {
      masterFields.forEach(({ key, keywords }) => {
        const masterValue = group[key];
        if (!masterValue) return;

        let hasInjected = false;
        
        for (const detailKey of Object.keys(detailRow)) {
          if (detailKey === "_sourceId" || detailKey === "_details") continue;
          const lowerDetailKey = detailKey.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (keywords.some(kw => lowerDetailKey.includes(kw))) {
             const val = detailRow[detailKey];
             if (!val || String(val).trim() === "" || String(val).trim() === "-") {
               detailRow[detailKey] = masterValue; // Fill empty field
             }
             hasInjected = true; // We found at least one matching column
          }
        }

        // If the row completely lacked this column, add it
        if (!hasInjected) {
          detailRow[key] = masterValue;
        }
      });
    });

    // --- FINAL VALIDATION ---
    const isMissingCritical = !group["Email"] || !group["Manager"] || !group["Department"] || !group["Maconomy ID"];
    if (isMissingCritical) {
      group["Statuses"].add("Missing Source Data");
      group._details.forEach(row => {
         let statusKey = Object.keys(row).find(k => k.toLowerCase().includes("status")) || "Status";
         if (row[statusKey] && row[statusKey] !== "" && row[statusKey] !== "-") {
            if (!String(row[statusKey]).includes("Missing Source Data")) {
               row[statusKey] = `${row[statusKey]}, Missing Source Data`;
            }
         } else {
            row[statusKey] = "Missing Source Data";
         }
      });
    }
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

  return { mergedData: finalGroupedData, unmatchedData };
};

export const exportToExcel = (data, filename = "Exported_Data.xlsx") => {
  // Strip out internal properties before export
  const cleanData = data.map(row => {
    const rest = Object.fromEntries(
      Object.entries(row).filter(([key]) => !["_sourceId", "_details"].includes(key))
    );

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
        const cleanDetail = Object.fromEntries(
          Object.entries(detailRow).filter(([key]) => key !== "_sourceId")
        );

        // Re-inject the formatted Employee Name and metadata so the exported row has clean comprehensive info
        flatData.push({
          "Employee Name": group["Employee Name"],
          "Email": group["Email"] || "",
          "Manager": group["Manager"] || "",
          "Department": group["Department"] || "",
          "Maconomy ID": group["Maconomy ID"] || "",
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
