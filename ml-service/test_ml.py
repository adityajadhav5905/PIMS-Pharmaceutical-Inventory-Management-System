from fastapi.testclient import TestClient
from app.main import app

def run_ml_tests():
    client = TestClient(app)
    
    # 1. Health check
    health = client.get("/health")
    assert health.status_code == 200, f"Health check failed with {health.status_code}"
    print(f"[PASS] ML Service Health Check passed: {health.json()}")

    # 2. Test predictions for all supported periods
    for periods in [7, 14, 30, 60, 90]:
        res = client.post("/predict", json={"medicine_id": "6ab80182ff3abc8bee2c7378", "periods": periods})
        assert res.status_code == 200, f"Prediction failed for period {periods}: {res.text}"
        data = res.json()
        assert len(data["predicted_demand"]) == periods, f"Expected {periods} daily demands"
        assert data["total_demand"] > 0, "Expected positive total demand"
        assert 0.0 < data["confidence"] <= 1.0, "Confidence score out of range"
        print(f"[PASS] ML Prediction ({periods} days) -> Total demand: {data['total_demand']}, Confidence: {data['confidence']}")

    print("\nALL ML SERVICE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_ml_tests()
