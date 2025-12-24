import requests

try:
    resp = requests.post(
        "http://localhost:8000/api/v1/playground/save",
        json={"title": "test_doc", "content": "# Hello World"}
    )
    print(resp.status_code)
    print(resp.json())
except Exception as e:
    print(e)
