from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import HTMLResponse
from config import DEMO_MODE, PUBLIC_BASE_URL
from email_service import render_email_template
from scheduler import check_sla_escalations

router = APIRouter(prefix="/api/dev", tags=["Dev & Demo Controls"])

TEMPLATE_METADATA = [
    {
        "id": "desk_new_case",
        "name": "New Case Dispatch",
        "recipient": "Department Desk Officer",
        "trigger": "New Master Issue is clustered and registered",
        "features": "AI Triage Summary, Qwen3 Municipal Action, OpenStreetMap link, SLA Countdown, 4 Magic Action Buttons"
    },
    {
        "id": "desk_impact_surge",
        "name": "Impact Surge Re-alert",
        "recipient": "Department Desk Officer",
        "trigger": "Merged citizen complaints cross 5, 10, 25, 50, or 100",
        "features": "Surge delta badge (e.g. 5 -> 25), automatic priority escalation, latest citizen quotes"
    },
    {
        "id": "desk_reminder",
        "name": "SLA Acknowledgment Reminder",
        "recipient": "Department Desk Officer",
        "trigger": "Unacknowledged past 1x SLA deadline (2m in demo)",
        "features": "Friendly-then-firm warning, remaining time before Commissioner escalation"
    },
    {
        "id": "desk_escalation",
        "name": "Level 2 Commissioner Escalation",
        "recipient": "Department Head & Municipal Commissioner",
        "trigger": "Still unacknowledged after 2x SLA deadline (4m in demo)",
        "features": "Urgent alert banner, priority escalation, direct bypass action links"
    },
    {
        "id": "citizen_resolved_review",
        "name": "Citizen Resolution & Review Request",
        "recipient": "Every merged citizen complainant (1-to-50 flip)",
        "trigger": "Department marks issue resolved with required after-photo",
        "features": "Qwen3 AI Resolution Receipt, before/after photo comparison, 5 star rating links, red 'still broken' button"
    },
    {
        "id": "desk_reopened",
        "name": "Citizens Disputed Fix Notice",
        "recipient": "Department Desk & Commissioner",
        "trigger": "Citizens submit low rating (<=2) or 2+ report still broken",
        "features": "Auto-reopen notice, Citizen verdict comments, Trust Score penalty warning"
    },
    {
        "id": "citizen_thanks",
        "name": "Citizen Rating Confirmation",
        "recipient": "Citizen",
        "trigger": "Citizen submits star rating or confirmation",
        "features": "Civic verification thank-you, status summary, live timeline tracking link"
    },
    {
        "id": "desk_daily_digest",
        "name": "Daily Morning Briefing (08:00 AM IST)",
        "recipient": "Department Desk Officer & Head",
        "trigger": "Scheduled morning cron at 08:00 AM IST",
        "features": "Live Department Trust Score gauge, active queue, overdue SLA cases, immediate attention list"
    }
]

def get_sample_context(template_name: str) -> dict:
    base = PUBLIC_BASE_URL.rstrip("/")
    mock_issue = {
        "id": 104,
        "title": "Hazardous Deep Pothole on Jubilee Hills Road No. 36",
        "category": "Roads & Pavements",
        "subcategory": "Deep Pothole",
        "priority": "Critical",
        "location_name": "Near Peddamma Temple Junction, Road 36, Hyderabad",
        "summary": "Large asphalt cavity across main vehicular lane causing severe traffic disruption and acute two-wheeler accident risk.",
        "safety_risk": True,
        "suggested_action": "Deploy rapid cold-mix asphalt patch team and place reflector barricades immediately.",
        "urgency_reason": "High-speed evening commuter corridor with repeated motorcycle near-misses.",
        "complaint_count": 8,
        "reopen_count": 1
    }

    mock_dept = {
        "id": 1,
        "name": "Public Works Department (GHMC)",
        "slug": "public_works",
        "desk_email": "sheshitejs@gmail.com",
        "trust_score": 86.4
    }

    mock_links = {
        "accept": f"{base}/desk/action/sample_token_accept",
        "assign": f"{base}/desk/action/sample_token_assign",
        "needs_info": f"{base}/desk/action/sample_token_info",
        "resolve": f"{base}/desk/resolve/sample_token_resolve",
        "star_1": f"{base}/review/sample_token?rating=1",
        "star_2": f"{base}/review/sample_token?rating=2",
        "star_3": f"{base}/review/sample_token?rating=3",
        "star_4": f"{base}/review/sample_token?rating=4",
        "star_5": f"{base}/review/sample_token?rating=5",
        "still_broken": f"{base}/review/sample_token?still_broken=1"
    }

    return {
        "subject": f"Preview: {template_name}",
        "issue": mock_issue,
        "department": mock_dept,
        "action_links": mock_links,
        "review_links": mock_links,
        "executive_summary": "Field sensors and citizen reports confirm an expanding road cavity near the temple junction. Emergency leveling and surface re-tarring are required to restore safe transit.",
        "osm_link": "https://www.openstreetmap.org/?mlat=17.4319&mlon=78.4073#map=17/17.4319/78.4073",
        "sla_minutes": 30,
        "surge_count": 8,
        "threshold": 5,
        "old_priority": "High",
        "new_priority": "Critical",
        "recent_complaints": [
            {"text": "My scooter front wheel hit this huge crater right before the turn, bent the rim!", "created_at": "10 mins ago"},
            {"text": "Dangerously deep pothole, cars swerving into oncoming traffic to dodge it.", "created_at": "25 mins ago"},
            {"text": "Road 36 pothole got bigger after the rain last night. Please fix ASAP.", "created_at": "40 mins ago"}
        ],
        "sla_remaining": "12 minutes remaining before Commissioner escalation",
        "elapsed_minutes": 64,
        "resolution_receipt": "The Public Works road maintenance crew deployed a quick-curing bitumen mix to fill and compact the 1.2m pothole on Road 36. Drainage edges were cleared and the patch was leveled with surrounding asphalt. The road was reopened to full vehicular traffic at 14:30.",
        "before_photo_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
        "after_photo_url": "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop&q=80",
        "rating": 5,
        "still_broken": False,
        "reviews": [
            {"rating": 1, "still_broken": True, "comment": "They just poured loose gravel that came out an hour later. Hole is still open!", "citizen_email": "ssheshitej96@gmail.com"},
            {"rating": 2, "still_broken": False, "comment": "Patch is very uneven and bumpy.", "citizen_email": "sheshitejs@gmail.com"}
        ],
        "open_count": 14,
        "overdue_count": 2,
        "reopened_count": 1,
        "urgent_cases": [
            {"id": 104, "title": "Hazardous Deep Pothole on Road 36", "priority": "Critical", "location_name": "Jubilee Hills", "desk_status": "EMAILED"},
            {"id": 98, "title": "Submerged Manhole Cover after Rainfall", "priority": "High", "location_name": "Madhapur", "desk_status": "ACKNOWLEDGED"}
        ]
    }

@router.get("/preview-emails")
async def list_preview_templates():
    """List available email templates for /admin/email-preview."""
    if not DEMO_MODE:
        raise HTTPException(status_code=403, detail="Email preview is only enabled in DEMO_MODE")
    return {"success": True, "templates": TEMPLATE_METADATA}

@router.get("/preview-email/{template}", response_class=HTMLResponse)
async def preview_email_endpoint(template: str):
    """Render full HTML email with mock context for browser inspection."""
    if not DEMO_MODE:
        raise HTTPException(status_code=403, detail="Email preview is only enabled in DEMO_MODE")

    valid_ids = [t["id"] for t in TEMPLATE_METADATA]
    if template not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Template '{template}' not recognized. Valid: {valid_ids}")

    context = get_sample_context(template)
    html, _ = render_email_template(template, context)
    return HTMLResponse(content=html, status_code=200)

@router.post("/tick")
async def manual_scheduler_tick():
    """Manually trigger the SLA escalation check for immediate demo demonstrations."""
    if not DEMO_MODE:
        raise HTTPException(status_code=403, detail="Manual tick is only permitted in DEMO_MODE")

    await check_sla_escalations()
    return {"success": True, "message": "SLA Escalation Ladder executed successfully"}
