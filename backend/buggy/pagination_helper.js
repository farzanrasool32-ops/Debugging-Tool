// Testing App 4: REST API Pagination & Cursor Slicer
// Scenario: Pagination generator for database query records
// Bugs: Off-by-one slice, missing boundary check, and undefined ID access

const databaseRecords = [
  { id: 101, title: "Getting Started with AI", views: 1420 },
  { id: 102, title: "Node.js Concurrency Guide", views: 980 },
  { id: 103, title: "Mastering TypeScript Generics", views: 2310 },
  { id: 104, title: "Vercel Serverless Architecture", views: 1850 },
  { id: 105, title: "Building Autonomous Agents", views: 3200 }
];

function paginateResults(records, page, pageSize) {
  // Bug 1: Calculate startIndex with 1-based index error
  const startIndex = page * pageSize; 
  // Bug 2: endIndex exceeds length and throws or slices incorrectly
  const endIndex = startIndex + pageSize;
  
  const pageItems = records.slice(startIndex, endIndex);

  // Bug 3: Accessing .id on potentially empty slice item
  const nextCursor = pageItems[pageItems.length].id;

  return {
    page,
    itemsCount: pageItems.length,
    nextCursor,
    data: pageItems
  };
}

const page1 = paginateResults(databaseRecords, 1, 3);
console.log("Pagination Result:", JSON.stringify(page1));
