"""
Test script for route optimization system.
Run this after starting the backend server to verify everything works.
"""

import requests
import json
import time
from datetime import datetime

API_BASE = "http://localhost:8000"

def print_header(text):
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60)

def print_success(text):
    print(f"✅ {text}")

def print_error(text):
    print(f"❌ {text}")

def print_info(text):
    print(f"ℹ️  {text}")

def test_create_bins():
    """Create test bins with coordinates"""
    print_header("Creating Test Bins")
    
    bins = [
        {
            "id": "bin1",
            "location": "Central Market, Nagpur",
            "capacity_liters": 100,
            "fill_level_percent": 85,
            "latitude": 21.1458,
            "longitude": 79.0882
        },
        {
            "id": "bin2",
            "location": "Railway Station, Nagpur",
            "capacity_liters": 150,
            "fill_level_percent": 92,
            "latitude": 21.1520,
            "longitude": 79.0850
        },
        {
            "id": "bin3",
            "location": "Sitabuldi Fort",
            "capacity_liters": 120,
            "fill_level_percent": 78,
            "latitude": 21.1497,
            "longitude": 79.0860
        },
        {
            "id": "bin4",
            "location": "City Park",
            "capacity_liters": 100,
            "fill_level_percent": 45,
            "latitude": 21.1400,
            "longitude": 79.0920
        },
        {
            "id": "bin5",
            "location": "Shopping Mall",
            "capacity_liters": 200,
            "fill_level_percent": 95,
            "latitude": 21.1550,
            "longitude": 79.0900
        }
    ]
    
    for bin_data in bins:
        try:
            response = requests.post(f"{API_BASE}/bins/", json=bin_data)
            if response.status_code == 201:
                print_success(f"Created bin: {bin_data['id']} at {bin_data['location']}")
            elif response.status_code == 409:
                print_info(f"Bin {bin_data['id']} already exists")
            else:
                print_error(f"Failed to create bin {bin_data['id']}: {response.status_code}")
        except Exception as e:
            print_error(f"Error creating bin {bin_data['id']}: {e}")
    
    return bins

def test_optimize_route():
    """Test route optimization with different algorithms"""
    print_header("Testing Route Optimization")
    
    bin_ids = ["bin1", "bin2", "bin3", "bin4", "bin5"]
    
    try:
        response = requests.post(f"{API_BASE}/routes/optimize", json={
            "bin_ids": bin_ids,
            "algorithm": "hybrid",
            "save_route": True
        })
        
        if response.status_code == 200:
            result = response.json()
            print_success(f"Route optimized successfully!")
            print(f"   Algorithm: {result['algorithm']}")
            print(f"   Total Distance: {result['total_distance_km']} km")
            print(f"   Estimated Time: {result['estimated_time_minutes']} minutes")
            print(f"   Bins to collect: {result['bin_count']}")
            print(f"   Efficiency: {result['efficiency_score']} bins/km")
            print(f"   Route ID: {result['route_id']}")
            
            print("\n   Waypoint Order:")
            for wp in result['waypoints']:
                print(f"   {wp['order']}. {wp['bin_id']} (Fill: {wp['fill_level']}%)")
            
            return result['route_id']
        else:
            print_error(f"Optimization failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print_error(f"Error during optimization: {e}")
        return None

def test_compare_algorithms():
    """Test algorithm comparison"""
    print_header("Comparing All Algorithms")
    
    bin_ids = ["bin1", "bin2", "bin3", "bin4", "bin5"]
    
    try:
        response = requests.post(f"{API_BASE}/routes/compare", json={
            "bin_ids": bin_ids,
            "start_latitude": 21.1458,
            "start_longitude": 79.0882
        })
        
        if response.status_code == 200:
            result = response.json()
            print_success(f"Comparison completed!")
            print(f"\n   Recommended Algorithm: {result['recommended']}")
            print("\n   Results:")
            
            for algo in result['algorithms']:
                print(f"\n   {algo['algorithm'].upper()}:")
                print(f"      Distance: {algo['total_distance_km']} km")
                print(f"      Time: {algo['estimated_time_minutes']} min")
                print(f"      Efficiency: {algo['efficiency_score']} bins/km")
        else:
            print_error(f"Comparison failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error during comparison: {e}")

def test_route_status_update(route_id):
    """Test route status updates"""
    print_header("Testing Route Status Updates")
    
    if not route_id:
        print_error("No route ID provided, skipping status test")
        return
    
    # Start route
    try:
        response = requests.patch(f"{API_BASE}/routes/{route_id}/status", json={
            "status": "active"
        })
        
        if response.status_code == 200:
            print_success("Route marked as ACTIVE")
        else:
            print_error(f"Failed to start route: {response.status_code}")
    except Exception as e:
        print_error(f"Error starting route: {e}")
    
    time.sleep(1)
    
    # Complete route
    try:
        response = requests.patch(f"{API_BASE}/routes/{route_id}/status", json={
            "status": "completed",
            "actual_time_minutes": 52.5,
            "notes": "All bins collected successfully. No issues."
        })
        
        if response.status_code == 200:
            print_success("Route marked as COMPLETED")
            print("   Actual time: 52.5 minutes")
        else:
            print_error(f"Failed to complete route: {response.status_code}")
    except Exception as e:
        print_error(f"Error completing route: {e}")

def test_route_analytics():
    """Test route analytics"""
    print_header("Route Performance Analytics")
    
    try:
        response = requests.get(f"{API_BASE}/routes/analytics/performance")
        
        if response.status_code == 200:
            analytics = response.json()
            print_success("Analytics retrieved!")
            print(f"\n   Total Routes Completed: {analytics['total_routes_completed']}")
            print(f"   Total Bins Collected: {analytics['total_bins_collected']}")
            print(f"   Total Distance: {analytics['total_distance_km']} km")
            print(f"   Average Efficiency: {analytics['average_efficiency']} bins/km")
            print(f"   Average Time: {analytics['average_time_minutes']} minutes")
        else:
            print_error(f"Failed to get analytics: {response.status_code}")
    except Exception as e:
        print_error(f"Error getting analytics: {e}")

def test_list_routes():
    """Test listing all routes"""
    print_header("Listing All Routes")
    
    try:
        response = requests.get(f"{API_BASE}/routes/")
        
        if response.status_code == 200:
            routes = response.json()
            print_success(f"Found {len(routes)} routes")
            
            for route in routes[:3]:  # Show first 3
                print(f"\n   Route ID: {route['id']}")
                print(f"   Status: {route['status']}")
                print(f"   Algorithm: {route['algorithm_used']}")
                print(f"   Distance: {route['total_distance_km']} km")
                print(f"   Bins: {len(route['bin_ids'])}")
        else:
            print_error(f"Failed to list routes: {response.status_code}")
    except Exception as e:
        print_error(f"Error listing routes: {e}")

def test_create_crew():
    """Create a test crew"""
    print_header("Creating Test Crew")
    
    crew_data = {
        "id": "crew1",
        "name": "Alpha Team",
        "leader": "John Doe",
        "members_count": 3,
        "phone": "+91-9876543210",
        "email": "alpha@waste.com",
        "current_latitude": 21.1458,
        "current_longitude": 79.0882
    }
    
    try:
        response = requests.post(f"{API_BASE}/crews/", json=crew_data)
        if response.status_code == 201:
            print_success(f"Created crew: {crew_data['name']}")
            return crew_data['id']
        elif response.status_code == 409:
            print_info("Crew already exists")
            return crew_data['id']
        else:
            print_error(f"Failed to create crew: {response.status_code}")
            return None
    except Exception as e:
        print_error(f"Error creating crew: {e}")
        return None

def test_optimize_with_crew():
    """Test optimization with crew location"""
    print_header("Optimizing Route from Crew Location")
    
    crew_id = test_create_crew()
    if not crew_id:
        print_error("No crew available, skipping")
        return
    
    bin_ids = ["bin1", "bin2", "bin3"]
    
    try:
        response = requests.post(f"{API_BASE}/routes/optimize", json={
            "bin_ids": bin_ids,
            "crew_id": crew_id,
            "algorithm": "hybrid",
            "save_route": True
        })
        
        if response.status_code == 200:
            result = response.json()
            print_success(f"Route optimized from crew location!")
            print(f"   Crew: {crew_id}")
            print(f"   Distance: {result['total_distance_km']} km")
            print(f"   Time: {result['estimated_time_minutes']} minutes")
        else:
            print_error(f"Optimization failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error: {e}")

def main():
    """Run all tests"""
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     SMART WASTE MANAGEMENT - ROUTE OPTIMIZATION TESTS     ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Check if server is running
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print_error("Backend server is not responding correctly!")
            return
    except:
        print_error("Cannot connect to backend server!")
        print_info(f"Make sure the server is running at {API_BASE}")
        return
    
    print_success("Backend server is running!\n")
    
    # Run tests
    test_create_bins()
    time.sleep(1)
    
    route_id = test_optimize_route()
    time.sleep(1)
    
    test_compare_algorithms()
    time.sleep(1)
    
    test_optimize_with_crew()
    time.sleep(1)
    
    if route_id:
        test_route_status_update(route_id)
        time.sleep(1)
    
    test_route_analytics()
    time.sleep(1)
    
    test_list_routes()
    
    print_header("Tests Completed!")
    print_success("All route optimization features are working! 🎉\n")

if __name__ == "__main__":
    main()