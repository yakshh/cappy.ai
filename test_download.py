import urllib.request

url = "https://cappy-uploads.public.blob.vercel-storage.com/Unit-5.pdf" # I'll use a placeholder or public blob url if I had one
# Let's just try to hit any vercel blob URL to see if it blocks urllib.
try:
    req = urllib.request.Request("https://vercel.com", headers={'User-Agent': 'Python-urllib/3.12'})
    resp = urllib.request.urlopen(req)
    print("SUCCESS")
except Exception as e:
    print("ERROR:", e)
