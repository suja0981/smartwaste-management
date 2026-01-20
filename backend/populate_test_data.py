"""
Populate the database with realistic test data for demonstration.
Run this to quickly set up a demo environment.
"""

import requests
import random
from datetime import datetime, timedelta

API_BASE = "http://localhost:8000"

# Nagpur locations with real coordinates
NAGPUR_LOCATIONS = [
    {"name": "Sitabuldi Main Square", "lat": 21.1497, "lon": 79.0860},
    {"name": "Dharampeth Church Square", "lat": 21.1346, "lon": 79.0669},
    {"name": "Sadar Bazaar", "lat": 21.1520, "lon": 79.0877},
    {"name": "Railway Station", "lat": 21.1520, "lon": 79.0850},
    {"name": "Civil Lines", "lat": 21.1575, "lon": 79.0746},
    {"name": "Empress Mall", "lat": 21.1456, "lon": 79.0883},
    {"name": "Gandhi Sagar Lake", "lat": 21.1389, "lon": 79.0921},
    {"name": "Futala Lake", "lat": 21.1261, "lon": 79.0583},
    {"name": "Ambazari Lake", "lat": 21.1124, "lon": 79.0333},
    {"name": "Kasturchand Park", "lat": 21.1508, "lon": 79.0904},
    {"name": "Variety Square", "lat": 21.1469, "lon": 79.0846},
    {"name": "Shankar Nagar Square", "lat": 21.1175, "lon": 79.0745},
    {"name": "Medical Square", "lat": 21.1343, "lon": 79.0850},
    {"name": "Congress Nagar", "lat": 21.1088, "lon": 79.0542},
    {"name": "Mankapur Square", "lat": 21.1258, "lon": 79.0992},
    {"name": "Jaripatka", "lat": 21.1697, "lon": 79.0967},
    {"name": "Khamla Square", "lat": 21.1047, "lon": 79.0542},
    {"name": "Lakadganj", "lat": 21.1496, "lon": 79.0783},
    {"name": "Dhantoli", "lat": 21.1362, "lon": 79.0794},
    {"name": "Seminary Hills", "lat": 21.1167, "lon": 79.0500},
]

def create_bins():
    """Create realistic bins across Nagpur"""
    print("\n📍 Creating bins...")
    
    bin_types = [
        {"capacity": 100, "type": "residential"},
        {"capacity": 150, "type": "commercial"},
        {"capacity": 200, "type": "industrial"},
        {"capacity": 120, "type": "public"},
    ]
    
    created = 0
    for i, location in enumerate(NAGPUR_LOCATIONS[:15], 1):  # Create 15 bins
        bin_type = random.choice(bin_types)
        fill_level = random.randint(20, 98)
        
        bin_data = {
            "id": f"bin{i:02d}",
            "location": location["name"],
            "capacity_liters": bin_type["capacity"],
            "fill_level_percent": fill_level,
            "latitude": location["lat"],
            "longitude": location["lon"]
        }
        
        try:
            response = requests.post(f"{API_BASE}/bins/", json=bin_data)
            if response.status_code in [201, 409]:
                created += 1
                status = "🔵" if fill_level < 70 else "🟡" if fill_level < 90 else "🔴"
                print(f"  {status} {bin_data['id']}: {location['name']} ({fill_level}%)")
            else:
                print(f"  ❌ Failed to create bin {bin_data['id']}: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"  ❌ Error creating {bin_data['id']}: {e}")
    
    print(f"✅ Created/Updated {created} bins")
    return created

def create_crews():
    """Create waste collection crews"""
    print("\n👥 Creating crews...")
    
    crews = [
        {
            "id": "crew1",
            "name": "Alpha Team",
            "leader": "Rajesh Kumar",
            "members_count": 3,
            "phone": "+91-9876543210",
            "email": "alpha@nagpurwaste.in",
            "current_latitude": 21.1458,
            "current_longitude": 79.0882
        },
        {
            "id": "crew2",
            "name": "Beta Team",
            "leader": "Priya Sharma",
            "members_count": 4,
            "phone": "+91-9876543211",
            "email": "beta@nagpurwaste.in",
            "current_latitude": 21.1346,
            "current_longitude": 79.0669
        },
        {
            "id": "crew3",
            "name": "Gamma Team",
            "leader": "Amit Deshmukh",
            "members_count": 3,
            "phone": "+91-9876543212",
            "email": "gamma@nagpurwaste.in",
            "current_latitude": 21.1520,
            "current_longitude": 79.0850
        },
    ]
    
    created = 0
    for crew in crews:
        try:
            response = requests.post(f"{API_BASE}/crews/", json=crew)
            if response.status_code in [201, 409]:
                created += 1
                print(f"  👤 {crew['name']} (Leader: {crew['leader']})")
            else:
                print(f"  ❌ Failed to create crew {crew['id']}: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"  ❌ Error creating {crew['id']}: {e}")
    
    print(f"✅ Created/Updated {created} crews")
    return created

def create_ai_alerts():
    """Create some AI alerts for demonstration"""
    print("\n🚨 Creating AI alerts...")
    
    alert_types = [
        {"type": "fire", "desc": "Smoke detected near bin"},
        {"type": "vandalism", "desc": "Suspicious activity detected"},
        {"type": "overflow", "desc": "Waste overflow detected"},
        {"type": "illegal_dumping", "desc": "Unauthorized dumping observed"},
    ]
    
    critical_bins = ["bin01", "bin05", "bin08", "bin12"]
    
    created = 0
    for bin_id in critical_bins:
        alert = random.choice(alert_types)
        
        alert_data = {
            "bin_id": bin_id,
            "alert_type": alert["type"],
            "description": alert["desc"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        try:
            response = requests.post(f"{API_BASE}/ai_alerts/", json=alert_data)
            if response.status_code == 202:
                created += 1
                emoji = "🔥" if alert["type"] == "fire" else "⚠️"
                print(f"  {emoji} {alert['type']} at {bin_id}")
        except Exception as e:
            print(f"  ❌ Error creating alert: {e}")
    
    print(f"✅ Created {created} AI alerts")
    return created

def create_sample_routes():
    """Create and optimize some sample routes"""
    print("\n🗺️  Creating sample routes...")
    
    route_scenarios = [
        {
            "name": "Morning Collection - High Priority",
            "bins": ["bin01", "bin05", "bin08", "bin12"],
            "crew": "crew1",
            "algorithm": "priority"
        },
        {
            "name": "Afternoon Collection - Efficient Route",
            "bins": ["bin02", "bin06", "bin09", "bin13"],
            "crew": "crew2",
            "algorithm": "hybrid"
        },
        {
            "name": "Evening Collection - Optimized",
            "bins": ["bin03", "bin07", "bin10", "bin14"],
            "crew": "crew3",
            "algorithm": "two_opt"
        },
    ]
    
    created = 0
    for scenario in route_scenarios:
        try:
            response = requests.post(f"{API_BASE}/routes/optimize", json={
                "bin_ids": scenario["bins"],
                "crew_id": scenario["crew"],
                "algorithm": scenario["algorithm"],
                "save_route": True
            })
            
            if response.status_code == 200:
                result = response.json()
                created += 1
                print(f"  🚛 {scenario['name']}")
                print(f"     Algorithm: {result['algorithm']}")
                print(f"     Distance: {result['total_distance_km']} km")
                print(f"     Time: {result['estimated_time_minutes']:.1f} min")
                print(f"     Efficiency: {result['efficiency_score']:.3f} bins/km")
        except Exception as e:
            print(f"  ❌ Error creating route: {e}")
    
    print(f"✅ Created {created} optimized routes")
    return created

def create_tasks():
    """Create some tasks for crews"""
    print("\n📋 Creating tasks...")
    
    tasks = [
        {
            "id": "task001",
            "title": "Emergency Collection - Fire Alert",
            "description": "Urgent collection required due to fire alert at Sitabuldi",
            "priority": "high",
            "location": "Sitabuldi Main Square",
            "bin_id": "bin01",
            "estimated_time_minutes": 30
        },
        {
            "id": "task002",
            "title": "Routine Collection - Commercial Area",
            "description": "Regular scheduled collection for Sadar Bazaar area",
            "priority": "medium",
            "location": "Sadar Bazaar",
            "bin_id": "bin04",
            "estimated_time_minutes": 45
        },
        {
            "id": "task003",
            "title": "Maintenance Check - Sensor Issues",
            "description": "Check bin sensors at Railway Station",
            "priority": "low",
            "location": "Railway Station",
            "bin_id": "bin03",
            "estimated_time_minutes": 20
        },
    ]
    
    created = 0
    for task in tasks:
        try:
            response = requests.post(f"{API_BASE}/tasks/", json=task)
            if response.status_code in [201, 409]:
                created += 1
                priority_emoji = "🔴" if task["priority"] == "high" else "🟡" if task["priority"] == "medium" else "🟢"
                print(f"  {priority_emoji} {task['title']}")
        except Exception as e:
            print(f"  ❌ Error creating task: {e}")
    
    print(f"✅ Created {created} tasks")
    return created

def simulate_telemetry():
    """Send some telemetry data"""
    print("\n📡 Sending telemetry data...")
    
    bins = [f"bin{i:02d}" for i in range(1, 16)]
    
    sent = 0
    for bin_id in bins[:10]:  # Send telemetry for first 10 bins
        telemetry = {
            "bin_id": bin_id,
            "fill_level_percent": random.randint(40, 95),
            "battery_percent": random.randint(60, 100),
            "temperature_c": round(random.uniform(20, 35), 1),
            "humidity_percent": random.randint(40, 80)
        }
        
        try:
            response = requests.post(f"{API_BASE}/telemetry/", json=telemetry)
            if response.status_code == 202:
                sent += 1
        except Exception as e:
            print(f"  ❌ Error sending telemetry: {e}")
    
    print(f"✅ Sent telemetry for {sent} bins")
    return sent

def show_statistics():
    """Display current system statistics"""
    print("\n📊 System Statistics:")
    
    try:
        # Dashboard stats
        stats = requests.get(f"{API_BASE}/stats/stats").json()
        print(f"\n  Total Bins: {stats['total_bins']}")
        print(f"  Bins Online: {stats['bins_online']}")
        print(f"  Bins Full: {stats['bins_full']}")
        print(f"  Active Alerts: {stats['active_alerts']}")
        print(f"  Average Fill Level: {stats['average_fill_level']}%")
        
        # Route analytics
        route_stats = requests.get(f"{API_BASE}/routes/analytics/performance").json()
        if route_stats['total_routes_completed'] > 0:
            print(f"\n  Routes Completed: {route_stats['total_routes_completed']}")
            print(f"  Total Distance: {route_stats['total_distance_km']} km")
            print(f"  Avg Efficiency: {route_stats['average_efficiency']:.3f} bins/km")
    except Exception as e:
        print(f"  ❌ Error fetching stats: {e}")

def main():
    """Main population script"""
    print("╔════════════════════════════════════════════════════════════╗")
    print("║   SMART WASTE MANAGEMENT - TEST DATA POPULATION           ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Check if server is running
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print("\n❌ Backend server is not responding!")
            return
    except Exception as e:
        print(f"\n❌ Cannot connect to backend server at {API_BASE}")
        print("   Make sure the server is running: uvicorn main:app --reload")
        return
    
    print("\n✅ Backend server is online!")
    print("\nPopulating database with test data...\n")
    
    # Create all test data
    bins = create_bins()
    crews = create_crews()
    alerts = create_ai_alerts()
    tasks = create_tasks()
    routes = create_sample_routes()
    telemetry = simulate_telemetry()
    
    # Show summary
    print("\n" + "="*60)
    print("📈 POPULATION COMPLETE")
    print("="*60)
    
    show_statistics()
    
    print("\n" + "="*60)
    print("\n🎉 Your Smart Waste Management system is ready for demo!")
    print("\n📝 Next steps:")
    print("   1. Open http://localhost:8000/docs for API documentation")
    print("   2. Test route optimization with: python test_routes.py")
    print("   3. Start IoT simulation: python simulate_iot.py")
    print("   4. Start AI alerts simulation: python simulate_ai_alerts.py")
    print("\n✨ Happy testing!\n")

if __name__ == "__main__":
    main()