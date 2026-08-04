import urllib.request
import json
import io

BASE = "https://cappy-ai-nine.vercel.app"

# 1. Login
login_data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print("Logged in OK!")

# Create a small dummy 1-page PDF file in memory
pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 12 Tf 50 700 Td (Internet of Things IoT Security Overview. MQTT protocol uses SSL TLS encryption and lightweight message brokering for smart devices.) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000414 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n503\n%%EOF"

# 2. Upload chunk
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = []
body.append(f"--{boundary}".encode())
body.append(b'Content-Disposition: form-data; name="file"; filename="Test_IoT_Notes.pdf"')
body.append(b'Content-Type: application/pdf\r\n')
body.append(pdf_content)
body.append(f"--{boundary}--".encode())
payload = b"\r\n".join(body)

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": f"multipart/form-data; boundary={boundary}",
    "upload_id": "test_upload_123",
    "chunk_index": "0",
    "total_chunks": "1",
    "original_filename": "Test_IoT_Notes.pdf",
}

req_up = urllib.request.Request(f"{BASE}/api/documents/upload-chunk", data=payload, headers=headers)
upload_res = json.loads(urllib.request.urlopen(req_up).read())
print("Uploaded document OK! Doc ID:", upload_res.get("doc_id"))
new_doc_id = upload_res.get("doc_id")

# 3. Test summary on newly uploaded document
if new_doc_id:
    print(f"Testing summary for new document ID {new_doc_id}...")
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
        print("Summary result:\n", res.get("summary"))
    except urllib.error.HTTPError as e:
        print("Summary Error HTTP:", e.code)
        print("Body:", e.read().decode())
