import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, List
from config import DB_PATH, PUBLIC_BASE_URL
from db_migrations import run_migrations, SEEDED_DEPARTMENTS

DEMO_CITIZEN_EMAILS = [
    "sheshitejs@gmail.com",
    "ssheshitej96@gmail.com",
    "ssaicharan229@gmail.com",
    "anaalia696@gmail.com",
    "nandhinichakala@gmail.com"
]

def seed_accountability_desk_data(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Populates 12 realistic Hyderabad issues across all 6 departments:
    - Multiple desk_status values (EMAILED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED_PENDING_REVIEW, CLOSED, REOPENED)
    - Surges with threshold flags (5, 10, etc.)
    - Reopened issue with citizen reviews & disputes
    - Initialized audit events in desk_events
    - SUPPRESSES real emails during seed
    """
    # Ensure fresh baseline migrations
    run_migrations(conn)
    cursor = conn.cursor()

    # Clear previous seed content
    cursor.execute("DELETE FROM desk_events")
    cursor.execute("DELETE FROM action_tokens")
    cursor.execute("DELETE FROM email_log")
    cursor.execute("DELETE FROM reviews")
    cursor.execute("DELETE FROM complaints")
    cursor.execute("DELETE FROM issues")

    # Fetch departments map
    cursor.execute("SELECT id, slug, name, desk_email FROM departments")
    dept_map = {r["slug"]: dict(r) for r in cursor.fetchall()}

    now = datetime.utcnow()
    base_vec = [0.01 * (i % 10) for i in range(1024)]
    emb_json = json.dumps(base_vec)

    issues_spec = [
        # 1. Public Works (EMAILED, Surge >= 5)
        {
            "dept_slug": "public_works",
            "title": "Hazardous Deep Pothole on Jubilee Hills Road No. 36",
            "description": "Large road crater directly in path of oncoming two-wheelers and buses causing traffic disruption.",
            "category": "Roads",
            "subcategory": "Pothole",
            "priority": "Critical",
            "location": "Near Peddamma Temple Junction, Road 36, Jubilee Hills",
            "latitude": 17.4319,
            "longitude": 78.4073,
            "complaint_count": 6,
            "desk_status": "EMAILED",
            "escalation_level": 0,
            "last_surge_threshold": 5,
            "safety_risk": 1,
            "urgency_reason": "High-speed evening commuter corridor with repeated bike skid incidents.",
            "suggested_action": "Deploy rapid cold-mix asphalt patch team immediately.",
            "created_hours_ago": 0.5,
            "complaints": [
                "Massive pothole crater right before the temple junction turn.",
                "Hit this huge hole on Road 36 on my scooter, almost got knocked down by a car.",
                "Road 36 damaged asphalt is dangerous for two-wheelers.",
                "The pothole near Peddamma temple has become very deep after rains.",
                "Urgent repair needed on Road 36 Jubilee Hills, crater in middle lane.",
                "Another bike fell into the Road 36 pothole this morning!"
            ]
        },
        # 2. Public Works (ACKNOWLEDGED)
        {
            "dept_slug": "public_works",
            "title": "Broken Expansion Joint on Begumpet Flyover",
            "description": "Exposed steel teeth and crumbling concrete on northbound carriageway slowing flyover traffic.",
            "category": "Roads",
            "subcategory": "Bridge/Pavement",
            "priority": "High",
            "location": "Begumpet Flyover Northbound, near Prakash Nagar",
            "latitude": 17.4430,
            "longitude": 78.4725,
            "complaint_count": 3,
            "desk_status": "ACKNOWLEDGED",
            "escalation_level": 0,
            "last_surge_threshold": 0,
            "safety_risk": 1,
            "urgency_reason": "Risk of tire bursts and structural joint deterioration.",
            "suggested_action": "Install rubber joint seal and level transitions.",
            "created_hours_ago": 2.0,
            "ack_hours_ago": 1.5,
            "complaints": [
                "Iron strip on Begumpet flyover joint is jutting out, damaging car tires.",
                "Expansion gap on flyover has lost concrete, cars jolting violently.",
                "Dangerous gap in bridge joint at Begumpet."
            ]
        },
        # 3. Sanitation (IN_PROGRESS, Surge >= 5)
        {
            "dept_slug": "sanitation",
            "title": "Severe Market Waste Overflow & Sidewalk Spill",
            "description": "Three municipal dumper bins overflowing for four days onto pedestrian walkway near vegetable market.",
            "category": "Sanitation",
            "subcategory": "Overflowing Bin",
            "priority": "High",
            "location": "Madhapur 100ft Road Vegetable Market, Ayyappa Society",
            "latitude": 17.4485,
            "longitude": 78.3842,
            "complaint_count": 8,
            "desk_status": "IN_PROGRESS",
            "escalation_level": 0,
            "last_surge_threshold": 5,
            "safety_risk": 1,
            "urgency_reason": "Acute public health hazard, rodent infestation and offensive odor.",
            "suggested_action": "Deploy hydraulic compactor truck and apply bleaching powder.",
            "created_hours_ago": 5.0,
            "ack_hours_ago": 4.0,
            "complaints": [
                "Vegetable market garbage bins have not been cleared for 4 days.",
                "Rotting waste scattered all over Madhapur 100ft road sidewalk.",
                "Foul stench and stray cattle eating garbage bags on main street.",
                "Trash spilled onto driving lane near Ayyappa Society entrance.",
                "Unhygienic conditions in Madhapur market, flies everywhere.",
                "Garbage overflow blocking pedestrian access.",
                "Smell is unbearable for shop owners and pedestrians.",
                "Dumpster overflowing onto road near grocery center."
            ]
        },
        # 4. Sanitation (REOPENED with Disputes & Reviews)
        {
            "dept_slug": "sanitation",
            "title": "Raw Sewage Overflow in Laad Bazaar Heritage Alley",
            "description": "Drainage chamber blocked with heavy silt, spilling black foul effluent onto historic stone pavement.",
            "category": "Sanitation",
            "subcategory": "Drainage Overflow",
            "priority": "Critical",
            "location": "Laad Bazaar lane 4, Near Charminar, Old City",
            "latitude": 17.3616,
            "longitude": 78.4747,
            "complaint_count": 7,
            "desk_status": "REOPENED",
            "escalation_level": 1,
            "reopen_count": 1,
            "last_surge_threshold": 5,
            "safety_risk": 1,
            "urgency_reason": "High pedestrian density, heritage market contamination and tourist complaints.",
            "suggested_action": "Super-sucker machine desilting and pipeline jetting.",
            "created_hours_ago": 28.0,
            "ack_hours_ago": 26.0,
            "resolved_hours_ago": 10.0,
            "complaints": [
                "Sewage manhole overflowing right in front of bangle shops in Laad Bazaar.",
                "Drain water flooding the pedestrian street near Charminar.",
                "Black sewer water is stagnating in market lane, customers cannot walk.",
                "Filthy drain overflow spreading disease in Old City shopping alley.",
                "Foul sewage smell in Laad Bazaar lane 4.",
                "Drain choked and black water leaking continuously.",
                "Sanitation team claimed they cleared it yesterday but it flooded again today!"
            ],
            "reviews": [
                {"citizen_email": "ssheshitej96@gmail.com", "rating": 1, "comment": "Workers just opened the lid and left. Sewage is still gushing onto the stones!", "still_broken": 1},
                {"citizen_email": "sheshitejs@gmail.com", "rating": 2, "comment": "Not fixed properly at all. Still stagnant wastewater everywhere.", "still_broken": 1},
                {"citizen_email": "anaalia696@gmail.com", "rating": 1, "comment": "Fake completion receipt! Road is flooded as of this afternoon.", "still_broken": 1}
            ]
        },
        # 5. Water Supply (RESOLVED_PENDING_REVIEW)
        {
            "dept_slug": "water_supply",
            "title": "300mm Drinking Water Transmission Main Burst",
            "description": "Underground pipe joint snapped, creating a 3-meter geyser of potable water and washing away road ballast.",
            "category": "Water Works",
            "subcategory": "Broken Pipe",
            "priority": "High",
            "location": "Road No. 12, Banjara Hills, near Cancer Hospital",
            "latitude": 17.4126,
            "longitude": 78.4350,
            "complaint_count": 5,
            "desk_status": "RESOLVED_PENDING_REVIEW",
            "escalation_level": 0,
            "last_surge_threshold": 5,
            "safety_risk": 1,
            "urgency_reason": "Heavy loss of treated water and danger of road cave-in.",
            "suggested_action": "Isolation of sector valve, collar clamp installation, pressure test.",
            "created_hours_ago": 12.0,
            "ack_hours_ago": 10.0,
            "resolved_hours_ago": 1.0,
            "proof_photo_url": "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop&q=80",
            "resolution_note": "Replaced cracked ductile iron collar on 300mm transmission main. Backfilled excavation with compacted wet mix and restored water pressure.",
            "resolution_receipt": "The Water Supply Board technical wing isolated the feeder valve and replaced the damaged 300mm ductile iron joint on Banjara Hills Road 12. The pipeline underwent successful hydraulic pressure testing and full water supply was restored at 11:45. Citizens in Ward 12 are requested to verify their domestic pressure.",
            "complaints": [
                "Clean drinking water pipeline has burst, massive fountain of water on Road 12.",
                "Thousands of liters of drinking water pouring down Banjara Hills slope.",
                "Water supply pipeline burst near cancer hospital junction.",
                "Road flooded with tap water since early morning.",
                "Pipeline leak washing away road asphalt on Road 12."
            ]
        },
        # 6. Water Supply (EMAILED)
        {
            "dept_slug": "water_supply",
            "title": "Low Pressure & Discolored Water Supply in KPHB Colony",
            "description": "Muddy turbid tap water reaching residential overhead tanks across Phase 3.",
            "category": "Water Works",
            "subcategory": "Contamination",
            "priority": "Medium",
            "location": "KPHB Colony Phase 3, Kukatpally, Ward 118",
            "latitude": 17.4938,
            "longitude": 78.3980,
            "complaint_count": 2,
            "desk_status": "EMAILED",
            "escalation_level": 0,
            "last_surge_threshold": 0,
            "safety_risk": 1,
            "urgency_reason": "Health risk if contaminated water consumed.",
            "suggested_action": "Flush distribution terminal lines and collect chlorine residual samples.",
            "created_hours_ago": 1.0,
            "complaints": [
                "Water coming out of taps in KPHB Phase 3 is yellowish and smells like mud.",
                "Contaminated dirty water supply in our residential apartments."
            ]
        },
        # 7. Electricity (CLOSED with High Ratings)
        {
            "dept_slug": "electricity",
            "title": "Non-Functional High-Mast Lighting at Cyber Towers Junction",
            "description": "Six 400W LED fixtures dark on central high-mast mast, causing hazardous blind spots at IT corridor flyover turn.",
            "category": "Electricity",
            "subcategory": "Streetlight",
            "priority": "High",
            "location": "Cyber Towers Junction, Hitec City",
            "latitude": 17.4504,
            "longitude": 78.3808,
            "complaint_count": 4,
            "desk_status": "CLOSED",
            "status": "resolved",
            "escalation_level": 0,
            "last_surge_threshold": 0,
            "safety_risk": 1,
            "urgency_reason": "Extremely busy tech commute junction in complete darkness.",
            "suggested_action": "Replace phase breaker and install new driver modules.",
            "created_hours_ago": 48.0,
            "ack_hours_ago": 46.0,
            "resolved_hours_ago": 24.0,
            "closed_hours_ago": 20.0,
            "proof_photo_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
            "resolution_note": "Replaced blown MCB controller in base control cubicle and re-lamped high-mast LEDs. All 6 luminaires fully operational.",
            "resolution_receipt": "Electricity Department linemen replaced the tri-phase breaker unit and tested all luminaire connections at Cyber Towers junction. High-mast illumination was fully recommissioned and verified on site.",
            "complaints": [
                "Cyber towers junction high-mast light is completely off, very dark at night.",
                "Dangerous dark spot right where flyover merges near Cyber Towers.",
                "Street lights not working near Hitec City main crossing.",
                "Please fix the big light pole at Cyber Gateway roundabout."
            ],
            "reviews": [
                {"citizen_email": "sheshitejs@gmail.com", "rating": 5, "comment": "Bright and working perfectly tonight. Very fast turnaround!", "still_broken": 0},
                {"citizen_email": "ssaicharan229@gmail.com", "rating": 5, "comment": "Crucial junction is well-lit now. Great work.", "still_broken": 0},
                {"citizen_email": "nandhinichakala@gmail.com", "rating": 4, "comment": "Lights are back on. Thank you CivicPulse team.", "still_broken": 0}
            ]
        },
        # 8. Electricity (ACKNOWLEDGED, Surge >= 5)
        {
            "dept_slug": "electricity",
            "title": "Exposed High-Voltage Distribution Cable near Gachibowli Bus Stop",
            "description": "Armored underground electrical cable unearthed by construction grader left exposed near waiting passengers.",
            "category": "Electricity",
            "subcategory": "Live Wire",
            "priority": "Critical",
            "location": "Gachibowli Outer Ring Road Bus Shelter, near Stadium",
            "latitude": 17.4401,
            "longitude": 78.3489,
            "complaint_count": 7,
            "desk_status": "ACKNOWLEDGED",
            "escalation_level": 0,
            "last_surge_threshold": 5,
            "safety_risk": 1,
            "urgency_reason": "Extreme electrocution risk to pedestrians during wet weather.",
            "suggested_action": "Immediately de-energize and encase in protective PVC conduit.",
            "created_hours_ago": 3.0,
            "ack_hours_ago": 2.5,
            "complaints": [
                "Heavy electric wire lying open right next to bus stop bench.",
                "High voltage cable exposed on footpath in Gachibowli, sparks visible.",
                "Exposed electrical cable near stadium bus stand, danger to commuters.",
                "Someone could get electrocuted near Gachibowli bus shelter.",
                "Live wire exposed after digging on pavement.",
                "Please send electricity board team to Gachibowli bus stop immediately.",
                "Open electric line dangerous for schoolchildren waiting for buses."
            ]
        },
        # 9. Traffic Safety (IN_PROGRESS, Surge >= 10)
        {
            "dept_slug": "traffic_safety",
            "title": "Malfunctioning 4-Way Traffic Signals at Secunderabad Clock Tower",
            "description": "All phase signal heads stuck on blinking yellow, causing four-way vehicular gridlock across commercial hub.",
            "category": "Traffic",
            "subcategory": "Traffic Signal",
            "priority": "Critical",
            "location": "Clock Tower Major Intersection, Secunderabad",
            "latitude": 17.4399,
            "longitude": 78.4983,
            "complaint_count": 11,
            "desk_status": "IN_PROGRESS",
            "escalation_level": 0,
            "last_surge_threshold": 10,
            "safety_risk": 1,
            "urgency_reason": "Major intersection gridlock, ambulances delayed, collision risk.",
            "suggested_action": "Manual traffic officer deployment and micro-controller motherboard swap.",
            "created_hours_ago": 4.0,
            "ack_hours_ago": 3.5,
            "complaints": [
                "Clock Tower traffic lights are broken and blinking yellow, massive traffic jam.",
                "Vehicles stuck in all four directions at Secunderabad Clock Tower.",
                "Signal controller broken, no traffic police present to manage traffic.",
                "Chaos at Clock Tower junction, buses unable to move.",
                "Blinking yellow light causing near-collisions at Clock Tower.",
                "Heavy traffic pileup reaching railway station road.",
                "Clock tower signal timing completely corrupted.",
                "Cars and autorickshaws blocking intersection from all sides.",
                "Traffic signals offline at main Secunderabad junction.",
                "Gridlock at Clock Tower, ambulance caught in jam.",
                "Urgent traffic police required to take manual control of signals."
            ]
        },
        # 10. Traffic Safety (EMAILED)
        {
            "dept_slug": "traffic_safety",
            "title": "Faded Zebra Crossing & Missing Speed Humps near Women's College",
            "description": "Pedestrian road markings completely worn off on 4-lane arterial road with rapid vehicle speeds.",
            "category": "Traffic",
            "subcategory": "Pedestrian Safety",
            "priority": "Medium",
            "location": "Koti Women's College Gate, Koti, Hyderabad",
            "latitude": 17.3850,
            "longitude": 78.4867,
            "complaint_count": 3,
            "desk_status": "EMAILED",
            "escalation_level": 0,
            "last_surge_threshold": 0,
            "safety_risk": 1,
            "urgency_reason": "College students struggling to cross busy carriageway safely.",
            "suggested_action": "Apply reflective thermoplastic zebra markings and install rubber speed breakers.",
            "created_hours_ago": 0.8,
            "complaints": [
                "Students cannot cross road safely near Koti Women's College.",
                "Zebra crossing markings have completely vanished on main Koti road.",
                "Buses speed through college gate area without stopping for pedestrians."
            ]
        },
        # 11. Parks & Environment (RESOLVED_PENDING_REVIEW)
        {
            "dept_slug": "parks_environment",
            "title": "Fallen Heavy Banyan Limb Blocking KBR Park Jogging Track",
            "description": "Storm damage dislodged a 1-ton tree trunk completely obstructing the outer pedestrian walking track.",
            "category": "Parks",
            "subcategory": "Fallen Tree",
            "priority": "Medium",
            "location": "KBR National Park Outer Walking Track, Gate 2, Jubilee Hills",
            "latitude": 17.4262,
            "longitude": 78.4208,
            "complaint_count": 4,
            "desk_status": "RESOLVED_PENDING_REVIEW",
            "escalation_level": 0,
            "last_surge_threshold": 0,
            "safety_risk": 0,
            "urgency_reason": "Blocks hundreds of daily senior morning and evening walkers.",
            "suggested_action": "Dispatch motorized chainsaw crew and tractor trailer for wood clearing.",
            "created_hours_ago": 18.0,
            "ack_hours_ago": 16.0,
            "resolved_hours_ago": 3.0,
            "proof_photo_url": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80",
            "resolution_note": "Urban forestry team sectioned the fallen banyan branch using heavy chainsaws and cleared all foliage from jogging track.",
            "resolution_receipt": "The Parks & Urban Environment department deployed forestry personnel to clear the obstructed path at KBR Park Gate 2. The fallen branch was removed and the jogging surface swept clean. Regular pedestrian transit is restored.",
            "complaints": [
                "Large tree branch fallen across KBR park outer walking path.",
                "Joggers have to climb over a heavy tree limb near Gate 2.",
                "Path blocked by broken banyan tree after yesterday's windstorm.",
                "Tree trunk lying across walking track in KBR park."
            ]
        },
        # 12. Parks & Environment (CLOSED with Verification)
        {
            "dept_slug": "parks_environment",
            "title": "Damaged Security Perimeter Fence at Sanjeevaiah Children's Park",
            "description": "Collapsed chain-link fence allowing stray animals into the children's play area near Hussain Sagar lake.",
            "category": "Parks",
            "subcategory": "Park Infrastructure",
            "priority": "Low",
            "location": "Sanjeevaiah Park Children's Play Zone, Necklace Road",
            "latitude": 17.4332,
            "longitude": 78.4870,
            "complaint_count": 3,
            "desk_status": "CLOSED",
            "status": "resolved",
            "escalation_level": 0,
            "last_surge_threshold": 0,
            "safety_risk": 0,
            "urgency_reason": "Safety of young children playing on slides and swings.",
            "suggested_action": "Erect galvanized steel posts and re-tension chain link mesh.",
            "created_hours_ago": 60.0,
            "ack_hours_ago": 55.0,
            "resolved_hours_ago": 30.0,
            "closed_hours_ago": 24.0,
            "proof_photo_url": "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&auto=format&fit=crop&q=80",
            "resolution_note": "Welded steel angle supports and replaced 15 meters of heavy-gauge perimeter chain fencing.",
            "resolution_receipt": "Parks maintenance staff replaced the collapsed fence section around the play zone at Sanjeevaiah Park. The enclosure has been secured and painted.",
            "complaints": [
                "Park fence is broken near children's playground on Necklace Road.",
                "Stray dogs entering children play area through broken fence.",
                "Damaged wire mesh boundary at Sanjeevaiah park."
            ],
            "reviews": [
                {"citizen_email": "ssheshitej96@gmail.com", "rating": 5, "comment": "Brand new fence installed and safe for kids now. Thank you!", "still_broken": 0},
                {"citizen_email": "sheshitejs@gmail.com", "rating": 4, "comment": "Good sturdy fencing put up.", "still_broken": 0}
            ]
        }
    ]

    complaint_idx = 1
    seeded_issues_count = 0

    for item in issues_spec:
        dept = dept_map.get(item["dept_slug"])
        if not dept:
            continue

        created_dt = (now - timedelta(hours=item.get("created_hours_ago", 1.0))).isoformat()
        ack_dt = (now - timedelta(hours=item["ack_hours_ago"])).isoformat() if "ack_hours_ago" in item else None
        res_dt = (now - timedelta(hours=item["resolved_hours_ago"])).isoformat() if "resolved_hours_ago" in item else None
        cls_dt = (now - timedelta(hours=item["closed_hours_ago"])).isoformat() if "closed_hours_ago" in item else None

        cursor.execute("""
            INSERT INTO issues (
                department_id, title, description, category, subcategory, priority, department,
                location, latitude, longitude, complaint_count, confirmed_count, status, desk_status,
                assigned_officer_email, ack_at, resolved_at, closed_at, reopen_count,
                last_surge_threshold, escalation_level, proof_photo_url, resolution_note,
                resolution_receipt, safety_risk, urgency_reason, suggested_action, embedding,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            dept["id"],
            item["title"],
            item["description"],
            item["category"],
            item["subcategory"],
            item["priority"],
            dept["name"],
            item["location"],
            item["latitude"],
            item["longitude"],
            item["complaint_count"],
            item.get("status", "active"),
            item["desk_status"],
            dept["desk_email"],
            ack_dt,
            res_dt,
            cls_dt,
            item.get("reopen_count", 0),
            item.get("last_surge_threshold", 0),
            item.get("escalation_level", 0),
            item.get("proof_photo_url"),
            item.get("resolution_note"),
            item.get("resolution_receipt"),
            item["safety_risk"],
            item["urgency_reason"],
            item["suggested_action"],
            emb_json,
            created_dt,
            created_dt
        ))
        issue_id = cursor.lastrowid
        seeded_issues_count += 1

        # Seed initial desk_events
        cursor.execute("""
            INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
            VALUES (?, 'EMAIL_SENT', 'System', ?, ?)
        """, (issue_id, json.dumps({"to": dept["desk_email"], "template": "desk_new_case"}), created_dt))

        if ack_dt:
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, 'ACKNOWLEDGED', ?, ?, ?)
            """, (issue_id, dept["desk_email"], json.dumps({"action": "accept"}), ack_dt))

        if item.get("last_surge_threshold", 0) > 0:
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, 'IMPACT_SURGE', 'System', ?, ?)
            """, (issue_id, json.dumps({"threshold": item["last_surge_threshold"]}), created_dt))

        if res_dt:
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, 'RESOLVED', ?, ?, ?)
            """, (issue_id, dept["desk_email"], json.dumps({"receipt": item.get("resolution_receipt", "")}), res_dt))

        if item.get("reopen_count", 0) > 0:
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, 'REOPENED', 'Citizen Verdict Engine', ?, ?)
            """, (issue_id, json.dumps({"reason": "Citizens disputed proof-of-fix"}), now.isoformat()))

        if cls_dt:
            cursor.execute("""
                INSERT INTO desk_events (issue_id, event_type, actor, detail_json, created_at)
                VALUES (?, 'CLOSED_BY_CITIZENS', 'Citizen Verdict Engine', ?, ?)
            """, (issue_id, json.dumps({"verdict": "Completed & verified"}), cls_dt))

        # Seed underlying complaints with citizen emails cycling
        c_list = item.get("complaints", [item["description"]])
        for i, c_text in enumerate(c_list):
            t_id = f"CP-2026-{complaint_idx:05d}"
            c_email = DEMO_CITIZEN_EMAILS[complaint_idx % len(DEMO_CITIZEN_EMAILS)]
            c_time = (now - timedelta(hours=item.get("created_hours_ago", 1.0) - (i * 0.05))).isoformat()

            cursor.execute("""
                INSERT INTO complaints (
                    tracking_id, citizen_email, text, category, subcategory, priority, department,
                    location, latitude, longitude, summary, issue_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                t_id,
                c_email,
                c_text,
                item["category"],
                item["subcategory"],
                item["priority"],
                dept["name"],
                item["location"],
                item["latitude"],
                item["longitude"],
                c_text,
                issue_id,
                c_time
            ))
            comp_id = cursor.lastrowid
            complaint_idx += 1

            # Seed specific reviews if provided
            if "reviews" in item and i < len(item["reviews"]):
                rev_spec = item["reviews"][i]
                cursor.execute("""
                    INSERT INTO reviews (
                        issue_id, complaint_id, citizen_email, rating, comment, still_broken, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    issue_id,
                    comp_id,
                    rev_spec["citizen_email"],
                    rev_spec["rating"],
                    rev_spec["comment"],
                    rev_spec.get("still_broken", 0),
                    now.isoformat()
                ))

    conn.commit()

    # Recalculate trust scores for all 6 departments based on seed data
    from review_service import recalculate_department_trust_score
    for d_slug, d_obj in dept_map.items():
        recalculate_department_trust_score(d_obj["id"])

    return {
        "success": True,
        "message": f"Successfully seeded {seeded_issues_count} Master Issues across all 6 departments with realistic Hyderabad locations.",
        "issues_seeded": seeded_issues_count,
        "complaints_seeded": complaint_idx - 1,
        "emails_suppressed": True
    }
