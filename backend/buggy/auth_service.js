// Example 2: User Authentication & JWT-like Token Parser
// Bug: Missing argument handling and JSON parsing unhandled syntax error

function parseUserSession(rawCookie) {
  // Bug 1: Calling split on undefined without check
  const parts = rawCookie.split("; ");
  const tokenPair = parts.find(p => p.startsWith("session="));
  
  const encodedPayload = tokenPair.split("=")[1];
  
  // Bug 2: Trying to parse base64 without decoding or bad JSON format
  const user = JSON.parse(encodedPayload); 
  
  if (user.role === "admin") {
    return "Access granted to admin: " + user.name;
  }
  return "Access granted to user: " + user.name;
}

// Simulated raw cookie with malformed payload string
const cookieString = "theme=dark; session={'id':101,'name':'Farzan','role':'admin'}";
console.log(parseUserSession(cookieString));
