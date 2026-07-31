import urllib.request
import json

BASE = "https://cappy-ai-nine.vercel.app"

# Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK")

# Test search for any word
for q in ["security", "iot", "application", "data", "sensor", "cloud", "protocol"]:
    search_data = json.dumps({"query": q, "n_results": 10}).encode()
    req2 = urllib.request.Request(
        f"{BASE}/api/search/",
        data=search_data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    res = json.loads(urllib.request.urlopen(req2).read())
    print(f"Query '{q}': total = {res.get('total_results')}")
