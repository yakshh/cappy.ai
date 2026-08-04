import urllib.request
import json
import urllib.error

BASE = "https://cappy-ai-nine.vercel.app"

# 1. Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK!")

# Create a small valid PDF file content in memory
pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 150 >>\nstream\nBT /F1 12 Tf 50 700 Td (Internet of Things IoT Security Overview. MQTT protocol uses SSL TLS encryption and lightweight message brokering for smart devices. Sensor nodes send data securely to cloud brokers.) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000444 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n533\n%%EOF"

# 2. Upload file via /api/documents/upload
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = []
body.append(f"--{boundary}".encode())
body.append(b'Content-Disposition: form-data; name="files"; filename="Unit_7_IoT_Security_Notes.pdf"')
body.append(b'Content-Type: application/pdf\r\n')
body.append(pdf_content)
body.append(f"--{boundary}--".encode())
payload = b"\r\n".join(body)

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": f"multipart/form-data; boundary={boundary}",
}

req_up = urllib.request.Request(f"{BASE}/api/documents/upload", data=payload, headers=headers)
upload_res = json.loads(urllib.request.urlopen(req_up).read())
print("Upload response:", upload_res)
docs = upload_res.get("documents", [])
if docs:
    new_doc_id = docs[0]["id"]
    print(f"Uploaded successfully! Doc ID: {new_doc_id}")

    # 3. Test summary generation on newly uploaded document
    print(f"Testing summary generation on doc ID {new_doc_id}...")
    summary_data = json.dumps({"document_ids": [new_doc_id], "mode": "bullets"}).encode()
    req_sum = urllib.request.Request(
        f"{BASE}/api/summary/",
        data=summary_data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    )
    try:
        res = json.loads(urllib.request.urlopen(req_sum).read())
        print("SUMMARY GENERATED SUCCESSFULLY!")
        print("Chunks used:", res.get("chunks_used"))
        print("Summary content:\n", res.get("summary"))
    except urllib.error.HTTPError as e:
        print("Summary Error HTTP:", e.code)
        print("Body:", e.read().decode())
