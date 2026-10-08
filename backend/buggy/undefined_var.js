function calculateDiscount(price, discountRate = 0.1) {
  return price - discountRate * price;
}

const finalPrice = calculateDiscount(100);
console.log("Final price:", finalPrice);
