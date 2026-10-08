// Testing App 5: Financial Currency Converter & Fee Calculator
// Scenario: Multi-currency conversion for checkout payments
// Bugs: Accessing properties of undefined conversion rates and null fee calculation

const exchangeRates = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  PKR: 278.50
};

function convertCurrency(amount, fromCurrency, toCurrency) {
  // Bug 1: fromRate is undefined if case mismatch or missing
  const fromRate = exchangeRates[fromCurrency.toUpperCase()];
  const toRate = exchangeRates[toCurrency.toUpperCase()];

  // Bug 2: TypeError or NaN if rate is not found
  const amountInUSD = amount / fromRate;
  const convertedAmount = amountInUSD * toRate;

  // Bug 3: Accessing .fee on undefined service charge object
  let transactionConfig;
  const finalCharge = convertedAmount + transactionConfig.flatFee;

  return finalCharge.toFixed(2);
}

const payment = convertCurrency(50, "usd", "pkr");
console.log("Converted Total with Fee: PKR " + payment);
