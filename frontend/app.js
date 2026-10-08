document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const sampleSelect = document.getElementById("sampleSelect");
  const codeEditor = document.getElementById("codeEditor");
  const currentFileName = document.getElementById("currentFileName");
  const btnStartDebugging = document.getElementById("btnStartDebugging");
  const btnResetCode = document.getElementById("btnResetCode");
  const btnClearLogs = document.getElementById("btnClearLogs");
  const btnRefreshMemory = document.getElementById("btnRefreshMemory");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const eventsFeed = document.getElementById("eventsFeed");
  const emptyFeedState = document.getElementById("emptyFeedState");
  const memoryList = document.getElementById("memoryList");
  const memoryCount = document.getElementById("memoryCount");
  const terminalConsole = document.getElementById("terminalConsole");
  const debugSpinner = document.getElementById("debugSpinner");
  const btnText = document.getElementById("btnText");

  // Determine API base url (if backend is deployed separately)
  const API_BASE = window.BACKEND_API_URL || "";

  // Trackers
  const stepObserve = document.getElementById("step-observe");
  const stepThink = document.getElementById("step-think");
  const stepAct = document.getElementById("step-act");
  const stepLearn = document.getElementById("step-learn");

  let sampleFiles = [];
  let originalPresetCode = "";

  // 1. Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const targetTab = document.getElementById(btn.getAttribute("data-tab"));
      if (targetTab) targetTab.classList.add("active");
    });
  });

  // Pre-configured Default Demo Applications (Always available instantly)
  const defaultApps = [
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
`
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
`
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
`
    },
    {
      name: "example.js (Basic Array Loop)",
      content: `const items = [1, 2, 3];
let total = 0;
for (let i = 0; i <= items.length; i++) {
  total += items[i].value;
}
console.log(total);
`
    }
  ];

  // 2. Fetch or load sample buggy files
  async function loadSampleFiles() {
    sampleFiles = defaultApps;
    renderSampleDropdown();

    try {
      const res = await fetch(`${API_BASE}/api/files`);
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          sampleFiles = data.files;
          renderSampleDropdown();
        }
      }
    } catch (err) {
      // Retain instant defaultApps gracefully
    }
  }

  function renderSampleDropdown() {
    sampleSelect.innerHTML = `<option value="">-- Choose Buggy File --</option>`;
    sampleFiles.forEach((file) => {
      const opt = document.createElement("option");
      opt.value = file.name;
      opt.textContent = file.name;
      sampleSelect.appendChild(opt);
    });

    const defaultFile = sampleFiles[0];
    if (defaultFile && !codeEditor.value.trim()) {
      sampleSelect.value = defaultFile.name;
      codeEditor.value = defaultFile.content;
      currentFileName.textContent = defaultFile.name.split(" ")[0];
      originalPresetCode = defaultFile.content;
    }
  }

  // 3. Preset selector change
  sampleSelect.addEventListener("change", (e) => {
    const selected = sampleFiles.find((f) => f.name === e.target.value);
    if (selected) {
      codeEditor.value = selected.content;
      originalPresetCode = selected.content;
      currentFileName.textContent = `buggy/${selected.name}`;
      appendTerminal(`Loaded preset file buggy/${selected.name}`, "info");
    }
  });

  // Reset button
  btnResetCode.addEventListener("click", () => {
    if (originalPresetCode) {
      codeEditor.value = originalPresetCode;
      appendTerminal("Reset code editor to preset code.", "system");
    }
  });

  // 4. Load memory lessons
  async function loadMemoryLessons() {
    try {
      const res = await fetch(`${API_BASE}/api/memory`);
      const data = await res.json();
      const lessons = data.lessons || [];
      memoryCount.textContent = lessons.length;

      if (lessons.length === 0) {
        memoryList.innerHTML = `<div class="empty-state">No lessons recorded yet. Successful fixes will append rules here.</div>`;
        return;
      }

      memoryList.innerHTML = "";
      lessons.forEach((l) => {
        const item = document.createElement("div");
        item.className = "memory-item";
        const dateMatch = l.match(/^(\d{4}-\d{2}-\d{2}):\s*(.*)$/);
        const date = dateMatch ? dateMatch[1] : "Rule";
        const text = dateMatch ? dateMatch[2] : l;

        item.innerHTML = `
          <div class="memory-icon">🧠</div>
          <div class="memory-detail">
            <div class="memory-date">${date}</div>
            <div class="memory-text">${text}</div>
          </div>
        `;
        memoryList.appendChild(item);
      });
    } catch (err) {
      appendTerminal("Could not fetch memory: " + err.message, "error");
    }
  }

  btnRefreshMemory.addEventListener("click", loadMemoryLessons);

  // Helper functions
  function setAgentStatus(status, text) {
    statusText.textContent = text;
    if (status === "busy") {
      statusDot.className = "status-dot active";
    } else {
      statusDot.className = "status-dot";
    }
  }

  function appendTerminal(line, type = "system") {
    const el = document.createElement("div");
    el.className = `terminal-line ${type}`;
    const time = new Date().toLocaleTimeString();
    el.textContent = `[${time}] ${line}`;
    terminalConsole.appendChild(el);
    terminalConsole.scrollTop = terminalConsole.scrollHeight;
  }

  function resetTrackerSteps() {
    [stepObserve, stepThink, stepAct, stepLearn].forEach((s) => {
      s.classList.remove("active", "done");
    });
  }

  function activateStep(stepName) {
    resetTrackerSteps();
    if (stepName === "observe") stepObserve.classList.add("active");
    if (stepName === "think") {
      stepObserve.classList.add("done");
      stepThink.classList.add("active");
    }
    if (stepName === "act") {
      stepObserve.classList.add("done");
      stepThink.classList.add("done");
      stepAct.classList.add("active");
    }
    if (stepName === "learn") {
      stepObserve.classList.add("done");
      stepThink.classList.add("done");
      stepAct.classList.add("done");
      stepLearn.classList.add("active");
    }
  }

  function addFeedCard(type, title, tag, body, snippet = "") {
    if (emptyFeedState) emptyFeedState.style.display = "none";

    const card = document.createElement("div");
    card.className = `event-card card-${type}`;

    card.innerHTML = `
      <div class="event-header">
        <div class="event-title">${title}</div>
        <div class="event-tag">${tag}</div>
      </div>
      <div class="event-body">${body}</div>
      ${snippet ? `<pre class="event-code-snippet ${type === "success" ? "success-snippet" : ""}">${escapeHtml(snippet)}</pre>` : ""}
    `;
    eventsFeed.appendChild(card);
    eventsFeed.scrollTop = eventsFeed.scrollHeight;
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  btnClearLogs.addEventListener("click", () => {
    eventsFeed.innerHTML = "";
    if (emptyFeedState) {
      emptyFeedState.style.display = "block";
      eventsFeed.appendChild(emptyFeedState);
    }
    terminalConsole.innerHTML = `<div class="terminal-line system">[SYSTEM] Console cleared.</div>`;
  });

  // 5. Start Debugging with SSE
  btnStartDebugging.addEventListener("click", async () => {
    const code = codeEditor.value.trim();
    if (!code) {
      alert("Code cannot be empty.");
      return;
    }

    const fileName = sampleSelect.value || "sandbox_run.js";

    // UI state
    btnStartDebugging.disabled = true;
    debugSpinner.style.display = "inline-block";
    btnText.textContent = "Agent In Loop...";
    setAgentStatus("busy", "Autonomous Loop Active");
    resetTrackerSteps();
    appendTerminal(`Triggered agent session for ${fileName}...`, "info");

    try {
      const response = await fetch(`${API_BASE}/api/debug-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          fileName,
        }),
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop(); // keep remainder

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const lines = rawEvent.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: ")) eventData = line.slice(6).trim();
          }

          if (eventData) {
            handleServerEvent(eventType, JSON.parse(eventData));
          }
        }
      }
    } catch (err) {
      appendTerminal("Agent run error: " + err.message, "error");
      addFeedCard("error", "Agent Failure", "Error", err.message);
    } finally {
      btnStartDebugging.disabled = false;
      debugSpinner.style.display = "none";
      btnText.textContent = "Launch Autonomous Debugger";
      setAgentStatus("idle", "Agent Ready");
      loadMemoryLessons(); // update count and list
    }
  });

  function handleServerEvent(type, data) {
    switch (type) {
      case "status":
        appendTerminal(data.message, "info");
        break;

      case "iteration_start":
        appendTerminal(`--- Attempt ${data.iteration} of ${data.maxIterations} ---`, "system");
        activateStep("observe");
        break;

      case "step":
        activateStep(data.step);
        appendTerminal(`[Agent ${data.step.toUpperCase()}] ${data.message}`, "system");
        break;

      case "observed_error":
        addFeedCard(
          "error",
          `⚠️ Runtime Error Detected (Attempt ${data.iteration})`,
          `Exit ${data.exitCode}`,
          "Node.js executed the code and crashed with an error trace:",
          data.error
        );
        appendTerminal(`Exit ${data.exitCode}: ${data.error.slice(0, 150)}...`, "error");
        break;

      case "explanation":
        activateStep("act");
        addFeedCard(
          "think",
          `💡 Gemini AI Reasoning (Attempt ${data.iteration})`,
          "Analysis",
          data.explanation
        );
        appendTerminal(`Gemini Analysis: ${data.explanation}`, "info");
        break;

      case "patch_applied":
        codeEditor.value = data.newCode; // real-time code update in UI!
        appendTerminal(`Patch applied into code editor for attempt ${data.iteration}`, "system");
        break;

      case "success":
        activateStep("learn");
        [stepObserve, stepThink, stepAct, stepLearn].forEach((s) => s.classList.add("done"));
        addFeedCard(
          "success",
          `🎉 Bug Resolved Successfully!`,
          "Exit 0",
          `The program executed without any runtime errors in attempt ${data.iteration}.`,
          `Program Output:\n${data.stdout}`
        );
        appendTerminal(`Execution verified successfully with output: ${data.stdout.trim()}`, "success");
        break;

      case "lesson_added":
        addFeedCard(
          "lesson",
          `🧠 New Lesson Synthesized`,
          "memory.md",
          `The agent recorded this key takeaway to avoid repeating it:`,
          data.lesson
        );
        appendTerminal(`Lesson stored: "${data.lesson}"`, "info");
        break;

      case "failed":
        addFeedCard("error", `❌ Process Terminated`, "Limit Reached", data.message);
        appendTerminal(data.message, "error");
        break;

      case "done":
        appendTerminal("Agent session closed.", "system");
        break;
    }
  }

  // Initial loads
  loadSampleFiles();
  loadMemoryLessons();
});
