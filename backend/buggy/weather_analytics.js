// Example 3: Weather Data Analytics & Temperature Aggregator
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
    // Bug 1: Undefined helper function 'validateSensorData' called
    if (validateSensorData(reading)) {
      totalTemp += reading.temp;
      count++;
    }
  });

  return (totalTemp / count).toFixed(1);
}

const avg = getAverageTemperature(weeklyForecast);
console.log("Weekly Average Temperature: " + avg + "°C");
