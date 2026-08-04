import urllib.request
import json

BASE = "https://cappy-ai-nine.vercel.app"

# 1. Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK!")

# 2. Get user documents
req_docs = urllib.request.Request(f"{BASE}/api/documents/", headers={"Authorization": f"Bearer {token}"})
docs = json.loads(urllib.request.urlopen(req_docs).read())
print(f"Found {len(docs)} documents in user collection:")
doc_ids = []
for d in docs:
    print(f"  - Doc ID {d['id']}: {d['filename']} (status: {d['status']}, chunks: {d.get('chunk_count')})")
    doc_ids.append(d['id'])

if doc_ids:
    print(f"Testing summary for document IDs {doc_ids[:3]}...")
    summary_data = json.dumps({"document_ids": doc_ids[:3], "mode": "bullets"}).encode()
    req_sum = urllib.request.Request(
        f"{BASE}/api/summary/",
        data=summary_data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    try:
        res = json.loads(urllib.request.urlopen(req_sum).read())
        print("SUMMARY GENERATED SUCCESSFULLY!")
        print("Chunks used:", res.get("chunks_used"))
        print("Summary preview:", res.get("summary", "")[:200])
    except urllib.error.HTTPError as e:
        print("Summary Error HTTP:", e.code)
        print("Body:", e.read().decode())
