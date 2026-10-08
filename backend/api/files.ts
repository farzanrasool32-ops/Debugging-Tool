import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Pre-configured realistic testing applications
  const sampleFiles = [
    {
      name: "ecommerce_cart.js (🛒 E-Commerce Cart)",
      content: `// Testing App 1: E-Commerce Cart Total Calculator
// Bug: TypeError due to incorrect property access on cart items and missing price validation

const cart = [
  { id: 1, name: "Wireless Headphones", price: 89.99, quantity: 2 },
  { id: 2, name: "Mechanical Keyboard", cost: 120.00, quantity: 1 }, // Note: has 'cost' instead of 'price'
  { id: 3, name: "Mousepad XXL", price: 25.50, quantity: 3 }
];

function calculateCartTotal(items) {
  let subtotal = 0;
  for (let i = 0; i <= items.length; i++) {
    // Bug 1: Loop off-by-one error (i <= items.length)
    // Bug 2: Accessing .price on item with .cost
    subtotal += items[i].price * items[i].quantity;
  }
  
  const taxRate = 0.08;
  const grandTotal = subtotal + (subtotal * taxRate);
  return grandTotal.toFixed(2);
}

const total = calculateCartTotal(cart);
console.log("Cart Grand Total: $" + total);
`,
    },
    {
      name: "auth_service.js (🔐 User Token Auth)",
      content: `// Testing App 2: User Authentication & JWT-like Token Parser
// Bug: Missing argument handling and JSON parsing unhandled syntax error

function parseUserSession(rawCookie) {
  const parts = rawCookie.split("; ");
  const tokenPair = parts.find(p => p.startsWith("session="));
  
  const encodedPayload = tokenPair.split("=")[1];
  
  // Bug: Trying to parse invalid JSON format (single quotes)
  const user = JSON.parse(encodedPayload); 
  
  if (user.role === "admin") {
    return "Access granted to admin: " + user.name;
  }
  return "Access granted to user: " + user.name;
}

// Simulated raw cookie with malformed payload string
const cookieString = "theme=dark; session={'id':101,'name':'Farzan','role':'admin'}";
console.log(parseUserSession(cookieString));
`,
    },
    {
      name: "weather_analytics.js (⛅ Weather Sensor Analytics)",
      content: `// Testing App 3: Weather Data Analytics & Temperature Aggregator
// Bug: ReferenceError calling undefined function and NaN calculation

const weeklyForecast = [
  { day: "Mon", temp: 28, humidity: 65 },
  { day: "Tue", temp: "30", humidity: 70 }, // String instead of number
  { day: "Wed", temp: 26, humidity: 80 },
  { day: "Thu", temp: null, humidity: 60 },  // Null value
  { day: "Fri", temp: 31, humidity: 55 }
];

function getAverageTemperature(readings) {
  let totalTemp = 0;
  let count = 0;
  
  readings.forEach(reading => {
    // Bug: Undefined helper function 'validateSensorData' called
    if (validateSensorData(reading)) {
      totalTemp += reading.temp;
      count++;
    }
  });

  return (totalTemp / count).toFixed(1);
}

const avg = getAverageTemperature(weeklyForecast);
console.log("Weekly Average Temperature: " + avg + "°C");
`,
    },
    {
      name: "pagination_helper.js (📄 Database Pagination Slicer)",
      content: `// Testing App 4: REST API Pagination & Cursor Slicer
// Bugs: Off-by-one slice and accessing .id on undefined index

const databaseRecords = [
  { id: 101, title: "Getting Started with AI", views: 1420 },
  { id: 102, title: "Node.js Concurrency Guide", views: 980 },
  { id: 103, title: "Mastering TypeScript Generics", views: 2310 },
  { id: 104, title: "Vercel Serverless Architecture", views: 1850 },
  { id: 105, title: "Building Autonomous Agents", views: 3200 }
];

function paginateResults(records, page, pageSize) {
  const startIndex = page * pageSize; 
  const endIndex = startIndex + pageSize;
  const pageItems = records.slice(startIndex, endIndex);

  // Bug: Accessing .id on pageItems[pageItems.length] (out of bounds)
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
`,
    },
    {
      name: "currency_converter.js (💳 Financial Payment Converter)",
      content: `// Testing App 5: Financial Currency Converter & Fee Calculator
// Bugs: Accessing properties of undefined conversion rates and null fee calculation

const exchangeRates = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  PKR: 278.50
};

function convertCurrency(amount, fromCurrency, toCurrency) {
  const fromRate = exchangeRates[fromCurrency.toUpperCase()];
  const toRate = exchangeRates[toCurrency.toUpperCase()];

  const amountInUSD = amount / fromRate;
  const convertedAmount = amountInUSD * toRate;

  // Bug: Accessing flatFee on undefined transactionConfig
  let transactionConfig;
  const finalCharge = convertedAmount + transactionConfig.flatFee;

  return finalCharge.toFixed(2);
}

const payment = convertCurrency(50, "usd", "pkr");
console.log("Converted Total with Fee: PKR " + payment);
`,
    },
  ];

  return res.status(200).json({ files: sampleFiles });
}
