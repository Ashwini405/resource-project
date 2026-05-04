import { processAndMerge } from './src/lib/mergeEngine.js';

const data1 = [
  {
    "fullName": "sakthi rengaswamy",
    "Employee Name": "Sakthi Rengaswamy",
    "EmployeeEmailAddress": "sakthi@example.com",
    "Manager Name": "Annemarie Panderis",
    "Department": "Energy & Industrials"
  }
];

const data2 = [
  {
    "fullName": "sakthi r.",
    "Employee Name": "Sakthi R.",
    "Maconomy ID": "5491006",
    "Hours": 8
  }
];

// mock stdData
const result = processAndMerge(data1, data2, { file1: {}, file2: {} });
console.log("Merged Rows:", result.mergedData.length);
console.log("Sakthi's Merged Data:", JSON.stringify(result.mergedData[0], null, 2));
