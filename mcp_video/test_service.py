"""
Simple test script for MCP Video Service
"""

import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8002"

async def test_health():
    """Test health endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        print(f"Health Check: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
        return response.status_code == 200

async def test_animate():
    """Test animate endpoint"""
    payload = {
        "user_id": "test_user",
        "image_url": "https://example.com/test-image.jpg",
        "action": "turn",
        "duration_s": 4,
        "aspect": "9:16"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(f"{BASE_URL}/animate", json=payload)
            print(f"Animate Test: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(json.dumps(result, indent=2))
                return True
            else:
                print(f"Error: {response.text}")
                return False
        except Exception as e:
            print(f"Animate Test Failed: {str(e)}")
            return False

async def test_storyboard():
    """Test storyboard endpoint"""
    payload = {
        "image_url": "https://example.com/test-image.jpg",
        "product_attrs": {
            "type": "hoodie",
            "color": "black",
            "style": "casual"
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BASE_URL}/storyboard", json=payload)
            print(f"Storyboard Test: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(json.dumps(result, indent=2))
                return True
            else:
                print(f"Error: {response.text}")
                return False
        except Exception as e:
            print(f"Storyboard Test Failed: {str(e)}")
            return False

async def test_metrics():
    """Test metrics endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/metrics")
        print(f"Metrics Test: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(json.dumps(result, indent=2))
            return True
        else:
            print(f"Error: {response.text}")
            return False

async def main():
    """Run all tests"""
    print("=" * 50)
    print("MCP Video Service Test Suite")
    print("=" * 50)
    print(f"Testing service at: {BASE_URL}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print()
    
    tests = [
        ("Health Check", test_health),
        ("Storyboard", test_storyboard),
        ("Metrics", test_metrics),
        ("Animate", test_animate),  # Run this last as it may take longer
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"Running {test_name} test...")
        try:
            results[test_name] = await test_func()
        except Exception as e:
            print(f"{test_name} test failed with exception: {str(e)}")
            results[test_name] = False
        print("-" * 30)
    
    print("\nTest Results Summary:")
    print("=" * 30)
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"{test_name}: {status}")
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed!")
    else:
        print("❌ Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    asyncio.run(main())
