const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.resolve(__dirname, "../memory.md");
const TITLE = "# Agent Memory\n";
const MAX_LESSONS = 20;

/**
 * Loads the content of memory.md.
 * If the file is missing, creates it with the title "# Agent Memory".
 */
function loadMemory(filePath = MEMORY_FILE) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, TITLE, "utf-8");
    return TITLE;
  }
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Appends a lesson to memory.md in the format: "- YYYY-MM-DD: <text>"
 * Keeps only the last 20 lessons.
 */
function addLesson(text, filePath = MEMORY_FILE) {
  const currentContent = loadMemory(filePath);

  const lines = currentContent.split(/\r?\n/);
  const lessons = [];
  const nonLessonLines = [];

  for (const line of lines) {
    if (line.trim().startsWith("- ")) {
      lessons.push(line.trim());
    } else if (line.trim().length > 0) {
      nonLessonLines.push(line);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const newLesson = `- ${today}: ${text.trim()}`;
  lessons.push(newLesson);

  const keptLessons = lessons.slice(-MAX_LESSONS);
  const header = nonLessonLines.length > 0 ? nonLessonLines.join("\n") + "\n\n" : TITLE + "\n";
  const updatedContent = header + keptLessons.join("\n") + "\n";

  fs.writeFileSync(filePath, updatedContent, "utf-8");
}

module.exports = {
  loadMemory,
  addLesson,
  MEMORY_FILE,
};
