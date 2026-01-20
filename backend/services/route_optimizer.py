import math
from typing import List, Dict, Tuple, Optional
from datetime import datetime

class Location:
    """Represents a geographical location"""
    def __init__(self, lat: float, lon: float, name: str = ""):
        self.lat = lat
        self.lon = lon
        self.name = name
    
    def distance_to(self, other: 'Location') -> float:
        """Calculate Haversine distance between two points in kilometers"""
        R = 6371  # Earth's radius in km
        
        lat1, lon1 = math.radians(self.lat), math.radians(self.lon)
        lat2, lon2 = math.radians(other.lat), math.radians(other.lon)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c

class WasteCollectionPoint:
    """Represents a bin/waste collection point"""
    def __init__(self, bin_id: str, location: Location, fill_level: int, 
                 priority: int = 1, estimated_time: int = 10):
        self.bin_id = bin_id
        self.location = location
        self.fill_level = fill_level
        self.priority = priority  # 1=low, 2=medium, 3=high
        self.estimated_time = estimated_time  # minutes to collect
        
    def urgency_score(self) -> float:
        """Calculate urgency score based on fill level and priority"""
        # Higher fill level and priority = higher urgency
        return (self.fill_level * 0.7) + (self.priority * 10)

class RouteOptimizer:
    """Optimizes waste collection routes using various algorithms"""
    
    def __init__(self):
        self.depot_location = None
        
    def set_depot(self, location: Location):
        """Set the starting depot/base location"""
        self.depot_location = location
    
    def greedy_nearest_neighbor(self, points: List[WasteCollectionPoint], 
                                start_location: Location) -> Dict:
        """
        Greedy algorithm: Always visit the nearest unvisited point.
        Fast but not optimal.
        """
        if not points:
            return {"route": [], "total_distance": 0, "total_time": 0}
        
        unvisited = points.copy()
        route = []
        current_location = start_location
        total_distance = 0
        total_time = 0
        
        while unvisited:
            # Find nearest unvisited point
            nearest = min(unvisited, 
                         key=lambda p: current_location.distance_to(p.location))
            
            distance = current_location.distance_to(nearest.location)
            total_distance += distance
            total_time += (distance / 30 * 60) + nearest.estimated_time  # Assume 30 km/h
            
            route.append(nearest)
            unvisited.remove(nearest)
            current_location = nearest.location
        
        # Return to depot
        if self.depot_location:
            total_distance += current_location.distance_to(self.depot_location)
            total_time += current_location.distance_to(self.depot_location) / 30 * 60
        
        return {
            "route": route,
            "total_distance": round(total_distance, 2),
            "total_time": round(total_time, 2),
            "algorithm": "greedy_nearest_neighbor"
        }
    
    def priority_based(self, points: List[WasteCollectionPoint], 
                      start_location: Location) -> Dict:
        """
        Priority-based algorithm: Visit bins based on urgency score.
        Prioritizes full bins and high-priority locations.
        """
        if not points:
            return {"route": [], "total_distance": 0, "total_time": 0}
        
        # Sort by urgency score (highest first)
        sorted_points = sorted(points, key=lambda p: p.urgency_score(), reverse=True)
        
        route = []
        current_location = start_location
        total_distance = 0
        total_time = 0
        
        for point in sorted_points:
            distance = current_location.distance_to(point.location)
            total_distance += distance
            total_time += (distance / 30 * 60) + point.estimated_time
            
            route.append(point)
            current_location = point.location
        
        # Return to depot
        if self.depot_location:
            total_distance += current_location.distance_to(self.depot_location)
            total_time += current_location.distance_to(self.depot_location) / 30 * 60
        
        return {
            "route": route,
            "total_distance": round(total_distance, 2),
            "total_time": round(total_time, 2),
            "algorithm": "priority_based"
        }
    
    def hybrid_optimized(self, points: List[WasteCollectionPoint], 
                        start_location: Location) -> Dict:
        """
        Hybrid algorithm: Combines priority and distance optimization.
        Groups high-priority bins and finds efficient routes within groups.
        """
        if not points:
            return {"route": [], "total_distance": 0, "total_time": 0}
        
        # Separate into priority groups
        high_priority = [p for p in points if p.urgency_score() >= 70]
        medium_priority = [p for p in points if 40 <= p.urgency_score() < 70]
        low_priority = [p for p in points if p.urgency_score() < 40]
        
        route = []
        current_location = start_location
        total_distance = 0
        total_time = 0
        
        # Process each priority group with nearest neighbor
        for group in [high_priority, medium_priority, low_priority]:
            unvisited = group.copy()
            
            while unvisited:
                nearest = min(unvisited, 
                            key=lambda p: current_location.distance_to(p.location))
                
                distance = current_location.distance_to(nearest.location)
                total_distance += distance
                total_time += (distance / 30 * 60) + nearest.estimated_time
                
                route.append(nearest)
                unvisited.remove(nearest)
                current_location = nearest.location
        
        # Return to depot
        if self.depot_location:
            total_distance += current_location.distance_to(self.depot_location)
            total_time += current_location.distance_to(self.depot_location) / 30 * 60
        
        return {
            "route": route,
            "total_distance": round(total_distance, 2),
            "total_time": round(total_time, 2),
            "algorithm": "hybrid_optimized"
        }
    
    def two_opt_optimization(self, initial_route: List[WasteCollectionPoint], 
                            start_location: Location) -> Dict:
        """
        2-opt algorithm: Improves a route by removing crossing paths.
        Takes an initial route and optimizes it.
        """
        if len(initial_route) < 2:
            return {"route": initial_route, "total_distance": 0, "total_time": 0}
        
        def calculate_route_distance(route: List[WasteCollectionPoint]) -> float:
            dist = start_location.distance_to(route[0].location)
            for i in range(len(route) - 1):
                dist += route[i].location.distance_to(route[i + 1].location)
            if self.depot_location:
                dist += route[-1].location.distance_to(self.depot_location)
            return dist
        
        route = initial_route.copy()
        improved = True
        
        while improved:
            improved = False
            best_distance = calculate_route_distance(route)
            
            for i in range(1, len(route) - 1):
                for j in range(i + 1, len(route)):
                    # Reverse segment between i and j
                    new_route = route[:i] + route[i:j+1][::-1] + route[j+1:]
                    new_distance = calculate_route_distance(new_route)
                    
                    if new_distance < best_distance:
                        route = new_route
                        best_distance = new_distance
                        improved = True
                        break
                if improved:
                    break
        
        # Calculate final stats
        current_location = start_location
        total_distance = 0
        total_time = 0
        
        for point in route:
            distance = current_location.distance_to(point.location)
            total_distance += distance
            total_time += (distance / 30 * 60) + point.estimated_time
            current_location = point.location
        
        if self.depot_location:
            total_distance += current_location.distance_to(self.depot_location)
            total_time += current_location.distance_to(self.depot_location) / 30 * 60
        
        return {
            "route": route,
            "total_distance": round(total_distance, 2),
            "total_time": round(total_time, 2),
            "algorithm": "two_opt_optimized"
        }
    
    def optimize(self, points: List[WasteCollectionPoint], 
                start_location: Location, 
                algorithm: str = "hybrid") -> Dict:
        """
        Main optimization function. Choose algorithm and return optimized route.
        
        Args:
            points: List of collection points to visit
            start_location: Starting location (crew location)
            algorithm: Algorithm to use (greedy, priority, hybrid, two_opt)
        
        Returns:
            Dictionary with route, distance, time, and metadata
        """
        if algorithm == "greedy":
            return self.greedy_nearest_neighbor(points, start_location)
        elif algorithm == "priority":
            return self.priority_based(points, start_location)
        elif algorithm == "two_opt":
            # First get greedy route, then optimize with 2-opt
            initial = self.greedy_nearest_neighbor(points, start_location)
            return self.two_opt_optimization(initial["route"], start_location)
        else:  # hybrid (default)
            return self.hybrid_optimized(points, start_location)
    
    def compare_algorithms(self, points: List[WasteCollectionPoint], 
                          start_location: Location) -> List[Dict]:
        """
        Compare all algorithms and return results for each.
        Useful for analysis and choosing the best route.
        """
        algorithms = ["greedy", "priority", "hybrid", "two_opt"]
        results = []
        
        for algo in algorithms:
            result = self.optimize(points, start_location, algo)
            results.append(result)
        
        return results