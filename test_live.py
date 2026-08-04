import urllib.request
import urllib.error
import json

url = "https://cappy-ai-nine.vercel.app/api/auth/login"
data = json.dumps({"email": "yakshvaidya428@gmail.com", "password": "yaksh@1234"}).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    res = urllib.request.urlopen(req)
    print("SUCCESS:", res.read().decode())
except urllib.error.HTTPError as e:
    print("STATUS:", e.code)
    print("BODY:", e.read().decode())
except Exception as e:
    print("ERROR:", e)
