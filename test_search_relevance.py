import urllib.request
import json

BASE = "https://cappy-ai-nine.vercel.app"

# 1. Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK!")

# 2. Test search for "hii"
search_data = json.dumps({"query": "hii", "n_results": 15}).encode()
req_search = urllib.request.Request(
    f"{BASE}/api/search/",
    data=search_data,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
)
res_hii = json.loads(urllib.request.urlopen(req_search).read())
print(f"Results for 'hii': {len(res_hii['results'])} matches found.")
for r in res_hii['results'][:3]:
    print(f"  - Doc {r['document_name']}: Score {r['score']}")

# 3. Test search for "MQTT protocol"
search_data_mqtt = json.dumps({"query": "MQTT protocol", "n_results": 15}).encode()
req_search_mqtt = urllib.request.Request(
    f"{BASE}/api/search/",
    data=search_data_mqtt,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
)
res_mqtt = json.loads(urllib.request.urlopen(req_search_mqtt).read())
print(f"\nResults for 'MQTT protocol': {len(res_mqtt['results'])} matches found.")
for r in res_mqtt['results'][:3]:
    print(f"  - Doc {r['document_name']}: Score {r['score']} ({round(r['score']*100)}%)")
