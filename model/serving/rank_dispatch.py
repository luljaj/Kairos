"""Apply the exact fleet rubric to acuity predicted by the 4B dispatch adapter."""
from __future__ import annotations

import json

from starlette.responses import JSONResponse, Response

import rubric
from data.generate import REQ_V, RES_V, compact_reasons, reason_names_level

MODEL = "qwen3-4b-dispatch-lora"


def rank_candidates(req, resp):
    if not REQ_V.is_valid(req) or not RES_V.is_valid(resp) or resp["status"] != "ready":
        return resp
    candidates = req["candidates"]
    sent = sorted(c["ambulanceId"] for c in candidates)
    got = sorted(c["ambulanceId"] for c in resp["candidates"])
    acuity = resp["acuity"]
    if (sent != got or len(set(sent)) != len(sent) or resp["recommendedAmbulanceId"] not in sent
            or not reason_names_level(resp["acuityReason"], acuity)):
        return resp

    choice = rubric.recommend(candidates, acuity)
    order = sorted(candidates, key=lambda c: (c["ambulanceId"] != choice.recommended, rubric._arr(c), c["ambulanceId"]))
    ranked = {**resp, "recommendedAmbulanceId": choice.recommended, "candidates": [
        {"ambulanceId": c["ambulanceId"], "crewSuitable": choice.suitable[c["ambulanceId"]], "reason": ""}
        for c in order
    ]}
    compact_reasons(req, ranked, {"acuity": acuity, "kind": choice.kind,
                                  "recommendedAmbulanceId": choice.recommended,
                                  "fastestSuitable": choice.fastest_suitable})
    return ranked


async def rank_dispatch(request, call_next):
    if request.method != "POST" or request.url.path != "/v1/chat/completions":
        return await call_next(request)
    try:
        payload = await request.json()
        if not isinstance(payload, dict) or payload.get("model") != MODEL or payload.get("stream"):
            return await call_next(request)
        messages = payload.get("messages")
        if not isinstance(messages, list):
            return await call_next(request)
        content = next((m.get("content") for m in reversed(messages)
                        if isinstance(m, dict) and m.get("role") == "user"), None)
        req = json.loads(content)
    except (TypeError, ValueError):
        return await call_next(request)

    upstream = await call_next(request)
    if upstream.status_code != 200:
        return upstream
    body = b"".join([chunk async for chunk in upstream.body_iterator])
    headers = dict(upstream.headers)
    changed = False
    try:
        envelope = json.loads(body)
        for choice in envelope["choices"]:
            message = choice["message"]
            raw = json.loads(message["content"])
            ranked = rank_candidates(req, raw)
            if ranked != raw:
                message["content"] = json.dumps(ranked, separators=(",", ":"), ensure_ascii=False)
                changed = True
    except (KeyError, TypeError, ValueError):
        changed = False
    if changed:
        headers.pop("content-length", None)
        return JSONResponse(envelope, status_code=upstream.status_code, headers=headers)
    return Response(body, status_code=upstream.status_code, headers=headers)
