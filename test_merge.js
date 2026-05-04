import { processAndMerge } from './src/lib/mergeEngine.js';

const data1 = [
  {
    "fullName": "Sakthi Rengaswamy",
    "EmployeeEmailAddress": "sakthi@example.com",
    "Manager Name": "Annemarie Panderis",
    "Project": "55020295-007",
    "Maconomy ID": "5491006"
  }
];

const data2 = [
  {
    "fullName": "Sakthi R.", // DIFFERENT NAME!
    "Maconomy ID": "5491006", // SAME ID
    "Hours": 8
  }
];

const result = processAndMerge(data1, data2, { file1: {}, file2: {} });
console.log(JSON.stringify(result.mergedData[0], null, 2));
