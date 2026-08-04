import urllib.request
import json
import urllib.error

BASE = "https://cappy-ai-nine.vercel.app"

# 1. Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK!")

# 2. Get list of user documents
req_docs = urllib.request.Request(f"{BASE}/api/documents/", headers={"Authorization": f"Bearer {token}"})
docs = json.loads(urllib.request.urlopen(req_docs).read())
print(f"User has {len(docs)} documents.")

if docs:
    target_doc = docs[0]
    doc_id = target_doc['id']
    filename = target_doc['filename']
    print(f"Testing deletion of document ID {doc_id} ('{filename}')...")

    req_del = urllib.request.Request(
        f"{BASE}/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}"},
        method="DELETE"
    )
    try:
        res = urllib.request.urlopen(req_del)
        print("DELETE SUCCESS! Response code:", res.getcode())
        if res.read():
            print("Response body:", res.read().decode())
    except urllib.error.HTTPError as e:
        print("Delete Error HTTP:", e.code)
        print("Body:", e.read().decode())
