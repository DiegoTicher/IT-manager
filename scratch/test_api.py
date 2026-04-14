import requests, hashlib

BASE = "http://localhost:5004/api"

def test():
    # 1. Login
    res = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin"})
    print("Login status:", res.status_code)
    data = res.json()
    if not data["success"]:
        print("Login failed:", data["message"])
        return
    token = data["data"]["token"]
    print("Token:", token)

    # 2. Create Asset
    headers = {"Authorization": token, "Content-Type": "application/json"}
    asset = {
        "name": "Ativo Teste Automatizado",
        "category": "Computador",
        "department_id": "" # Simulando o que o frontend manda
    }
    res = requests.post(f"{BASE}/assets", json=asset, headers=headers)
    print("Create Asset status:", res.status_code)
    print("Response:", res.text)

if __name__ == "__main__":
    test()
