import urllib.request
import json

BASE = "https://cappy-ai-nine.vercel.app"

# Check health first
try:
    resp = urllib.request.urlopen(f"{BASE}/api/health", timeout=10)
    print("Health:", resp.read().decode())
except Exception as e:
    print("Health check failed:", e)

# Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK")

# Test sample paper with minimal payload to isolate the crash
paper_data = json.dumps({
    "document_ids": [16, 18],
    "university_name": "GTU",
    "subject_code": "3160716",
    "subject_name": "IoT and Applications",
    "exam_term": "SUMMER 2025",
    "total_marks": 70
}).encode()

req3 = urllib.request.Request(
    f"{BASE}/api/sample-paper/",
    data=paper_data,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
)
try:
    resp3 = urllib.request.urlopen(req3, timeout=120)
    result = json.loads(resp3.read())
    print("SUCCESS!")
    print(json.dumps(result)[:300])
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}")
    print("Headers:", dict(e.headers))
    print("Body:", e.read().decode())
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
