const stdData1 = [
  { fullName: "john", HR: "HR1", Email: "john@x" }
];
const stdData2 = [
  { fullName: "john", TS: "TS1", Hours: 5 },
  { fullName: "john", TS: "TS2", Hours: 8 },
  { fullName: "andrew", TS: "TS3", Hours: 4 }
];
const stdData3 = [
  { fullName: "john", FIN: "FIN1" },
  { fullName: "andrew", FIN: "FIN2" }
];

const groupBy = (data) => {
  const map = new Map();
  data.forEach(row => {
    if (!row.fullName || row.fullName === "unknown") return;
    if (!map.has(row.fullName)) map.set(row.fullName, []);
    map.get(row.fullName).push(row);
  });
  return map;
};

const map1 = groupBy(stdData1);
const map2 = groupBy(stdData2);
const map3 = groupBy(stdData3);

const allNames = new Set([...map1.keys(), ...map2.keys(), ...map3.keys()]);

const mergedData = [];

for (const name of allNames) {
  const rows1 = map1.get(name) || [];
  const rows2 = map2.get(name) || [];
  const rows3 = map3.get(name) || [];
  
  const maxRows = Math.max(rows1.length, rows2.length, rows3.length);
  
  for (let i = 0; i < maxRows; i++) {
    const r1 = rows1[i] || rows1[0] || {};
    const r2 = rows2[i] || rows2[0] || {};
    const r3 = rows3[i] || rows3[0] || {};
    
    // Create base row from the most detailed source
    let baseName = r1["Employee Name"] || r2["Employee Name"] || r3["Employee Name"] || name;
    
    const mergedRow = {
      fullName: name,
      "Employee Name": baseName,
      ...r1,
      ...r2,
      ...r3
    };
    
    mergedData.push(mergedRow);
  }
}

console.log(mergedData);
