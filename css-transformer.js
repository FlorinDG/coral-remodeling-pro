const fs = require('fs');

const inputCSS = fs.readFileSync('../_temp_timetracker/src/index.css', 'utf8');

let outputCSS = `
/* TimeTracker Scoped Theme */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import url("https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:wght@400;700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap");

.time-tracker-theme {
`;

// Extract :root variables
const rootMatch = inputCSS.match(/:root\s*{([^}]*)}/);
if (rootMatch) {
  outputCSS += rootMatch[1];
}

outputCSS += `\n}\n\n.dark .time-tracker-theme, .time-tracker-theme.dark {\n`;

// Extract .dark variables
const darkMatch = inputCSS.match(/\.dark\s*{([^}]*)}/);
if (darkMatch) {
  outputCSS += darkMatch[1];
}

outputCSS += `\n}\n\n`;

// Extract base
outputCSS += `
.time-tracker-theme {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: 'Inter', sans-serif;
}
.time-tracker-theme .font-mono {
  font-family: 'JetBrains Mono', monospace;
}
`;

// Add components and utilities (scoped)
outputCSS += `
.time-tracker-theme .glass-card {
  background-color: hsl(var(--card) / 0.8);
  backdrop-filter: blur(4px);
  border: 1px solid hsl(var(--border) / 0.5);
}

.time-tracker-theme .timer-display {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.time-tracker-theme .link-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: all 0.3s;
}
.time-tracker-theme .link-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  border-color: hsl(var(--primary) / 0.2);
  transform: translateY(-0.25rem);
}

.time-tracker-theme .btn-clock-in {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
}
.time-tracker-theme .btn-clock-in:hover {
  filter: brightness(1.1);
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
}

.time-tracker-theme .btn-clock-out {
  background-color: hsl(var(--clock-out));
  color: white;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
}
.time-tracker-theme .btn-clock-out:hover {
  filter: brightness(1.1);
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
}

.time-tracker-theme .stat-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.3s;
}
.time-tracker-theme .stat-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }

.time-tracker-theme .animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.time-tracker-theme .animate-timer-glow {
  animation: timer-glow 2s ease-in-out infinite;
}

@keyframes timer-glow {
  0%, 100% { box-shadow: 0 0 20px hsl(var(--timer-glow) / 0.3); }
  50% { box-shadow: 0 0 40px hsl(var(--timer-glow) / 0.5); }
}

.time-tracker-theme .gradient-text {
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  background-image: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)));
}
`;

fs.writeFileSync('src/app/[locale]/admin/time-tracker/time-tracker.css', outputCSS);
console.log('Successfully created time-tracker.css!');
