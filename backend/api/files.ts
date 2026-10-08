import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as fs from "fs";
import * as path from "path";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const sampleFiles = [
    {
      name: "example.js",
      content: `const items = [1, 2, 3];
let total = 0;
for (let i = 0; i <= items.length; i++) {
  total += items[i].value;
}
console.log(total);
`,
    },
    {
      name: "syntax_error.js",
      content: `function greet(name) {
  console.log("Hello, " + name
}
greet("World");
`,
    },
    {
      name: "undefined_var.js",
      content: `function calculateDiscount(price) {
  return price - discountRate * price;
}

const finalPrice = calculateDiscount(100);
console.log("Final price:", finalPrice);
`,
    },
  ];

  return res.status(200).json({ files: sampleFiles });
}
