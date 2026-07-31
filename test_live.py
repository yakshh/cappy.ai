import urllib.request
import json

# Test with a simple auth check first
try:
    req = urllib.request.Request(
        'https://cappy-ai-nine.vercel.app/api/documents/',
        headers={'Authorization': 'Bearer invalid_token'}
    )
    urllib.request.urlopen(req)
except Exception as e:
    if hasattr(e, 'read'):
        print("API response:", e.read().decode())
    else:
        print("Error:", e)
