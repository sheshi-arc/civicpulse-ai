import pytest
import math
from main import (
    calculate_distance_km,
    evaluate_cluster_match,
    calculate_cosine_similarity
)

# =====================================================================
# City Memory 2.0 Test Suite: Hybrid Semantic + Geographic Clustering
# =====================================================================

def test_haversine_distance_calculations():
    """Verify Haversine formula distance calculation accuracy and edge cases."""
    # 1. Identical coordinates -> 0.0 km
    assert calculate_distance_km(17.4435, 78.3850, 17.4435, 78.3850) == 0.0

    # 2. Nearby points ~100 meters apart
    dist_nearby = calculate_distance_km(17.4435, 78.3850, 17.4442, 78.3855)
    assert dist_nearby is not None
    assert 0.05 <= dist_nearby <= 0.15  # ~95 meters

    # 3. Known cross-town distance in Hyderabad:
    # Hitech City (17.4435, 78.3850) to Charminar (17.3616, 78.4747) is ~13-14 km straight line
    dist_cross_town = calculate_distance_km(17.4435, 78.3850, 17.3616, 78.4747)
    assert dist_cross_town is not None
    assert 12.0 <= dist_cross_town <= 15.0

    # 4. Missing coordinates handling (safe fallback)
    assert calculate_distance_km(None, 78.3850, 17.4435, 78.3850) is None
    assert calculate_distance_km(17.4435, None, 17.4435, 78.3850) is None
    assert calculate_distance_km(17.4435, 78.3850, None, 78.3850) is None
    assert calculate_distance_km(17.4435, 78.3850, 17.4435, None) is None
    assert calculate_distance_km(None, None, None, None) is None


def test_city_memory_case_1_same_problem_nearby():
    """
    Test 1: Same or very similar problem within immediate vicinity (<= 1.0 km).
    Principle: High Similarity + Nearby Location -> MERGE into existing Master Issue.
    """
    sim = 0.88
    dist_km = 0.15  # 150 meters away
    is_match, is_geo_match, reason = evaluate_cluster_match(sim, dist_km)

    assert is_match is True
    assert is_geo_match is True
    assert "Matched existing issue" in reason
    assert "close proximity" in reason


def test_city_memory_case_2_similar_problem_far_away():
    """
    Test 2: High semantic similarity but far away (> 3.0 km).
    Principle: High Similarity + Far Location -> DO NOT MERGE (Distinct real-world issues).
    """
    sim = 0.94  # Extremely similar language (e.g. identical pothole complaint text)
    dist_km = 8.5  # 8.5 km across the city
    is_match, is_geo_match, reason = evaluate_cluster_match(sim, dist_km)

    assert is_match is False
    assert is_geo_match is False
    assert "Created new issue" in reason
    assert "> 3.0 km threshold" in reason


def test_city_memory_case_3_different_problem_nearby():
    """
    Test 3: Different problem reported in the exact same location.
    Principle: Low Similarity + Nearby Location -> DO NOT MERGE (Different issue types).
    """
    sim = 0.42  # Streetlight complaint vs Water pipe leak
    dist_km = 0.05  # Same street corner (50 meters)
    is_match, is_geo_match, reason = evaluate_cluster_match(sim, dist_km)

    assert is_match is False
    assert "below the clustering threshold" in reason


def test_city_memory_case_4_missing_coordinates_fallback():
    """
    Test 4: Reports with missing coordinates.
    Principle: Safe fallback without crash. If similarity >= 0.75, merge; if < 0.75, reject.
    """
    # High confidence semantic match without coordinates
    sim_high = 0.82
    is_match_high, is_geo_high, reason_high = evaluate_cluster_match(sim_high, None)
    assert is_match_high is True
    assert is_geo_high is False
    assert "non-spatial threshold" in reason_high

    # Moderate/low similarity without coordinates
    sim_mod = 0.72
    is_match_mod, is_geo_mod, reason_mod = evaluate_cluster_match(sim_mod, None)
    assert is_match_mod is False
    assert is_geo_mod is False
    assert "without geographic coordinate verification" in reason_mod


def test_city_memory_case_5_neighborhood_radius():
    """
    Test 5: Strong similarity within neighborhood corridor (1.0 km - 3.0 km).
    Similarity >= 0.80 within 3.0 km should merge as part of the local zone.
    """
    sim = 0.84
    dist_km = 2.1  # 2.1 km away
    is_match, is_geo_match, reason = evaluate_cluster_match(sim, dist_km)

    assert is_match is True
    assert is_geo_match is True
    assert "neighborhood radius" in reason


def test_cosine_similarity_edge_cases():
    """Verify cosine similarity helper handles zero vectors and identical vectors."""
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert calculate_cosine_similarity(v1, v2) == 1.0

    v_ortho = [0.0, 1.0, 0.0]
    assert calculate_cosine_similarity(v1, v_ortho) == 0.0

    v_zero = [0.0, 0.0, 0.0]
    assert calculate_cosine_similarity(v1, v_zero) == 0.0
