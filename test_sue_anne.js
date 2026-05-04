import { processAndMerge } from './src/lib/mergeEngine.js';

const masterData = [
  {
    "Employee Name": "Sue Anne Dolo Molintas",
    "EmployeeEmailAddress": "sue.anne@example.com",
    "Manager Name": "Lauren Longman",
    "Department": "Office Services",
    "Maconomy ID": "5501007",
    "Job Title": "Office Services",
    "Office": "Dubai",
    "Country": "UAE"
  }
];

const sourceData = [
  {
    "Employee Name": "Sue Anne Dolo",
    "Hours": "264",
    "Project": "55020005-014, H+K Admin - Dubai",
    "Client": "55010236, H&K GHK Internal Client",
    "Status": "Approved"
  }
];

const result = processAndMerge(masterData, sourceData, { file1: {}, file2: {} });
const sueAnne = result.mergedData.find(row => row["Employee Name"] === "Sue Anne Dolo Molintas");

console.log(JSON.stringify({
  rows: result.mergedData.length,
  employeeName: sueAnne?.["Employee Name"],
  email: sueAnne?.Email,
  manager: sueAnne?.Manager,
  department: sueAnne?.Department,
  maconomyId: sueAnne?.["Maconomy ID"],
  statuses: sueAnne?.Statuses
}, null, 2));

if (!sueAnne) throw new Error("Sue Anne record was not merged.");
if (sueAnne.Statuses.includes("Missing Source Data")) {
  throw new Error("Sue Anne was incorrectly marked as Missing Source Data.");
}
