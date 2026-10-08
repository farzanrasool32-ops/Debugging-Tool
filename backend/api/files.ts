import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Pre-configured realistic sample applications for live demo
  const sampleFiles = [
    {
      name: "ecommerce_cart.js (E-Commerce Store)",
      content: `// Example 1: E-Commerce Cart Total Calculator
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
      name: "auth_service.js (User Token Auth)",
      content: `// Example 2: User Authentication & JWT-like Token Parser
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
      name: "weather_analytics.js (Weather API Aggregator)",
      content: `// Example 3: Weather Data Analytics & Temperature Aggregator
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
      name: "example.js (Basic Array Loop)",
      content: `const items = [1, 2, 3];
let total = 0;
for (let i = 0; i <= items.length; i++) {
  total += items[i].value;
}
console.log(total);
`,
    },
  ];

  return res.status(200).json({ files: sampleFiles });
}
