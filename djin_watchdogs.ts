// Permissions needed: --allow-run --allow-read --allow-net --allow-write

const config = JSON.parse(await Deno.readTextFile('./config.json'));
const logDir = './logs';
await Deno.mkdir(logDir, { recursive: true });

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);

  if (config.log.enabled) {
    const logFile = `${logDir}/${new Date().toISOString().split('T')[0]}.jsonl`;
    Deno.writeTextFileSync(logFile, JSON.stringify({ timestamp, message }) + '\n', { append: true });
  }
}

function deleteOldLogs(persistDays: number) {
  for (const entry of Deno.readDirSync(logDir)) {
    const match = entry.name.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const logDate = new Date(match[1]);
      const diffDays = (Date.now() - logDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays > persistDays) {
        Deno.removeSync(`${logDir}/${entry.name}`);
        console.log(`Deleted old log: ${entry.name}`);
      }
    }
  }
}

async function runCommand(cmd: string) {
  const process = Deno.run({ cmd: ["sh", "-c", cmd], stdout: "piped" });
  const output = await process.output();
  process.close();
  return new TextDecoder().decode(output);
}

async function getCPUUsage(): Promise<number> {
  const text = await runCommand("top -bn1 | grep 'Cpu(s)'");
  const match = text.match(/(\d+\.?\d*)\s*id/);
  const idle = match ? parseFloat(match[1]) : 0;
  return Math.round((100 - idle) * 100) / 100;
}

async function getDiskUsage(): Promise<string> {
  const text = await runCommand("df -h /");
  const [, , , used] = text.trim().split("\n")[1].split(/\s+/);
  return used; // e.g., '2.0G'
}

async function getRAMUsage(): Promise<number> {
  const text = await runCommand("free -m");
  const line = text.split("\n").find(l => l.toLowerCase().startsWith("mem"));
  if (line) {
    const [, total, used] = line.trim().split(/\s+/).map(Number);
    return Math.round((used / total) * 100);
  }
  return 0;
}

async function getNetworkUsage(): Promise<string> {
  const output = await Deno.readTextFile("/proc/net/dev");
  const lines = output.split("\n").slice(2);
  let total = 0;
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length > 9) {
      total += parseInt(parts[1]) + parseInt(parts[9]); // recv + transmit
    }
  }
  return (total / 1024 / 1024).toFixed(1) + "MB";
}

function parseConstraintValue(val: string): number {
  const match = val.match(/(\d+\.?\d*)([KMG]B)/i);
  if (!match) return NaN;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multiplier = unit === 'KB' ? 1 : unit === 'MB' ? 1024 : 1024 * 1024;
  return num * multiplier;
}

function replacePlaceholders(obj: any, values: Record<string, string | number>): any {
  const json = JSON.stringify(obj);
  const replaced = json.replace(/\{(\w+?)\}/g, (_, key) => values[key]?.toString() ?? `{${key}}`);
  return JSON.parse(replaced);
}

async function monitor() {
  log("DJIN Watch Dogs started...");
  deleteOldLogs(config.log.persist);

  while (true) {
    const readings: Record<string, string | number> = {};
    const alerts: string[] = [];

    for (const res of config.resources) {
      if (res === "cpu" && config.constraints.cpu != null) {
        const cpu = await getCPUUsage();
        readings.cpu = cpu;
        if (cpu > config.constraints.cpu) alerts.push('cpu');
      } else if (res === "disk" && config.constraints.disk != null) {
        const disk = await getDiskUsage();
        readings.disk = disk;
        const usedBytes = parseConstraintValue(disk);
        const limitBytes = parseConstraintValue(config.constraints.disk);
        if (usedBytes > limitBytes) alerts.push('disk');
      } else if (res === "ram" && config.constraints.ram != null) {
        const ram = await getRAMUsage();
        readings.ram = ram;
        if (ram > config.constraints.ram) alerts.push('ram');
      } else if (res === "network" && config.constraints.network != null) {
        const net = await getNetworkUsage();
        readings.network = net;
        const usedBytes = parseConstraintValue(net);
        const limitBytes = parseConstraintValue(config.constraints.network);
        if (usedBytes > limitBytes) alerts.push('network');
      } else {
        log(`Configuration error: Resource "${res}" has no matching constraint.`);
      }
    }

    log(`Readings: ${JSON.stringify(readings)}`);

    if (alerts.length > 0) {
      const payload = replacePlaceholders(config.http_request.body, readings);
      try {
        const res = await fetch(config.http_request.url, {
          method: config.http_request.method,
          headers: config.http_request.headers,
          body: JSON.stringify(payload)
        });
        log(`Alert sent for: ${alerts.join(", ")} | Status: ${res.status}`);
      } catch (err) {
        log(`Failed to send alert: ${err.message}`);
      }
    }

    await new Promise(r => setTimeout(r, config.interval * 1000));
  }
}

await monitor();
