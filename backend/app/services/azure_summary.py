import json

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.models.schemas import MatchSummaryRequest, MatchSummaryResponse


async def create_match_summary(payload: MatchSummaryRequest) -> MatchSummaryResponse:
    if not settings.has_azure_openai:
        return MatchSummaryResponse(
            summary="Azure AI summary is not configured yet. Add AZURE_OPENAI_RESPONSES_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_MODEL.",
            generated_by="not-configured",
            configured=False,
        )

    body = {
        "model": settings.azure_openai_model,
        "input": [
            {
                "role": "system",
                "content": (
                    "You write concise CS2 FACEIT pre-match scouting summaries. "
                    "Use only the provided calculated stats. Do not invent numbers. "
                    "Do not claim certainty. Focus on practical match preparation."
                ),
            },
            {
                "role": "user",
                "content": build_prompt(payload),
            },
        ],
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": settings.azure_openai_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(settings.azure_openai_responses_endpoint, headers=headers, json=body)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:800]
        raise HTTPException(status_code=502, detail=f"Azure AI summary failed: {detail}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Azure AI summary request failed: {exc}") from exc

    summary = extract_response_text(response.json())
    return MatchSummaryResponse(
        summary=summary or "Azure AI returned an empty summary.",
        generated_by=settings.azure_openai_model or "azure-openai",
        configured=True,
    )


def build_prompt(payload: MatchSummaryRequest) -> str:
    analysis = payload.analysis
    compact = {
        "match_id": payload.match_id,
        "team_names": payload.team_names,
        "win_probability": analysis.win_probability.model_dump(),
        "friendly": {
            "score": analysis.friendly.score,
            "grade": analysis.friendly.grade,
            "component_scores": {
                "roles": analysis.friendly.role_balance_score,
                "firepower": analysis.friendly.firepower_score,
                "form": analysis.friendly.form_score,
                "utility": analysis.friendly.utility_score,
                "clutch": analysis.friendly.clutch_score,
            },
            "roles": [
                {
                    "nickname": role.nickname,
                    "role": role.role,
                    "confidence": role.confidence,
                    "signals": role.signals,
                }
                for role in analysis.friendly.roles
            ],
            "strengths": analysis.friendly.strengths,
            "risks": analysis.friendly.risks,
            "recommendations": analysis.friendly.recommendations,
        },
        "enemy": {
            "score": analysis.enemy.score,
            "grade": analysis.enemy.grade,
            "roles": [
                {
                    "nickname": role.nickname,
                    "role": role.role,
                    "confidence": role.confidence,
                    "signals": role.signals,
                }
                for role in analysis.enemy.roles
            ],
            "scouting": analysis.scouting.model_dump(),
        },
    }
    return (
        "Create a compact report with these sections: Match read, Friendly plan, Enemy threats, "
        "Who to enable, Who to contain, and Practical calls. Keep it under 220 words.\n\n"
        f"Calculated data:\n{json.dumps(compact, indent=2)}"
    )


def extract_response_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"].strip()

    chunks: list[str] = []
    for output in data.get("output", []) or []:
        for content in output.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunk.strip() for chunk in chunks if chunk.strip()).strip()
