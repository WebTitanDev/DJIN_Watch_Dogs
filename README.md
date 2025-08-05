# DJIN Watch Dogs

[CLI] Deno + Linux Resource Monitoring + HTTP Alerts + JSONL Logging

**DJIN Watch Dogs** is a standalone Deno script that monitors system resources
(CPU, Disk, RAM, Network) and sends HTTP alerts when thresholds are breached. It
continuously logs system health in JSONL files for observability. Built to run
on Linux using native tools like `/proc`, `top`, `df`, and `free`.

---

## Features

- CPU, Disk, RAM, Network monitoring
- HTTP POST Alerts with dynamic placeholders
- Daily JSONL logs (auto-clean old files)
- Runs as a background daemon (systemd ready)
- Config-driven (No CLI args)
- Linux-only with minimal dependencies

---

## Project Structure

├── config.json            <br> 
├── djin_watchdogs.ts      <br> 
├── logs/                  <br> 
├── djin_watchdogs.service <br> 
└── README.md              <br>

---

## Getting Started

### 1. Install Dependencies (Linux Only)

```bash
sudo apt update
sudo apt install procps coreutils grep bash unzip curl
```

### 2. Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
```

### 3. Clone or Copy Project Files

```bash
git clone <your-repo-url>
cd DJIN_Watch_Dogs
```

### 4. Run Script

```bash
deno run --allow-all djin_watchdogs.ts
```

## 💡 How It Works

### 1. The script reads config.json for resource constraints and HTTP request settings.

### 2. At each interval, it reads:

- CPU usage via `top`
- Disk usage via `df`
- RAM usage via `free`
- Network I/O from `/proc/net/dev`

### 3. If any resource exceeds the defined threshold, it sends an HTTP POST request with placeholders like `{cpu}`, `{disk}` replaced by current values.

### 4. Every reading and alert outcome is logged in JSONL files under `./logs/YYYY-MM-DD.jsonl`.

## 🧪 Example HTTP Alert Payload:

```json
{
    "timestamp": "2025-08-05T18:46:18.457Z",
    "message": "Resource alert: CPU is 90%, Disk: 2GB, RAM: 90%, Network: 1GB"
}
```

## 🔧 Customization

### Resource Constraints (config.json)

```json
"constraints": {
  "cpu": 85,
  "disk": "2GB",
  "ram": 90,
  "network": "1GB"
}
```

### Alert Body Placeholders

Use `{cpu}`, `{disk}`, `{ram}`, `{network}` in the body and headers.

```json
"body": {
  "data": "CPU: {cpu}%, RAM: {ram}%, Disk: {disk}"
}
```

### Logging Retention

```json
"log": {
  "persist": 5, // Delete logs older than 5 days
  "enabled": true
}
```

## 🛠 Run as a systemd Service

### 1.Copy systemd file:
```bash
sudo cp djin_watchdogs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable djin_watchdogs
sudo systemctl start djin_watchdogs
```
### 2.Check Logs:

```bash
journalctl -u djin_watchdogs -f
```
### 3.Stop Service:
```bash
sudo systemctl stop djin_watchdogs
```
### 4.Remove Service:
```bash
sudo rm /etc/systemd/system/djin_watchdogs.service
sudo systemctl daemon-reload
```

## 📜 License

 MIT License © 2025 Brian Ryder
