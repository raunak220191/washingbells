#!/usr/bin/env python3
"""
Start ngrok tunnel for the WashingBells backend and update config/dev.js
"""
import subprocess, time, json, re, os, sys
from urllib.request import urlopen

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV_CONFIG = os.path.join(PROJECT, "config", "dev.js")

def get_ngrok_url():
    try:
        data = json.loads(urlopen("http://127.0.0.1:4040/api/tunnels", timeout=3).read())
        for t in data.get("tunnels", []):
            if t.get("proto") == "https":
                return t["public_url"]
        return data["tunnels"][0]["public_url"] if data["tunnels"] else None
    except:
        return None

def update_config(url):
    with open(DEV_CONFIG, "r") as f:
        content = f.read()
    content = re.sub(
        r'const DEV_BACKEND_URL = "[^"]*";',
        f'const DEV_BACKEND_URL = "{url}";',
        content
    )
    with open(DEV_CONFIG, "w") as f:
        f.write(content)
    print(f"✅ Updated config/dev.js → {url}")

def restore_config():
    lan_ip = subprocess.getoutput("ipconfig getifaddr en0 || ipconfig getifaddr en1")
    url = f"http://{lan_ip.strip()}:8000"
    update_config(url)
    print(f"🔁 Restored config/dev.js → {url} (LAN mode)")

if __name__ == "__main__":
    # Kill any existing ngrok
    subprocess.run(["pkill", "-f", "ngrok http 8000"], capture_output=True)
    time.sleep(1)

    # Start ngrok
    print("🌐 Starting ngrok tunnel for backend port 8000...")
    proc = subprocess.Popen(
        ["ngrok", "http", "8000"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # Wait for ngrok to be ready
    for i in range(15):
        time.sleep(1)
        url = get_ngrok_url()
        if url:
            break
    
    if not url:
        print("❌ Could not get ngrok URL. Is ngrok installed? Run: brew install ngrok/ngrok/ngrok")
        proc.terminate()
        sys.exit(1)

    print(f"✅ Tunnel URL: {url}")
    update_config(url)
    
    print()
    print("─" * 60)
    print(f"  Backend API:  {url}/api/v1")
    print(f"  Ngrok dashboard: http://127.0.0.1:4040")
    print("─" * 60)
    print()
    print("📱 On your iPhone: shake to reload in Expo Go after this")
    print("Press Ctrl+C to stop tunnel (config will auto-restore)")
    print()

    try:
        proc.wait()
    except KeyboardInterrupt:
        print()
        proc.terminate()
        restore_config()
