import urllib.request
import json
req = urllib.request.Request('https://cappy-ai-nine.vercel.app/api/upload-token', data=b'{}', headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    print("SUCCESS", resp.read().decode('utf-8'))
except Exception as e:
    print("ERROR", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
