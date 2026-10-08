// Example 1: E-Commerce Cart Total Calculator
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
