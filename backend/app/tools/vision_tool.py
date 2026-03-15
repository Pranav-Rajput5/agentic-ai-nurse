"""
app/tools/vision_tool.py

WoundVisionTool — uses Gemini's multimodal vision capability to
analyze wound images uploaded by the patient.

Returns a structured assessment with a healing status, infection
indicators, and a recommended action (MONITOR / FLAG / ALERT).
"""

import base64
import os
from typing import Any, Dict

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage


VISION_PROMPT = """
You are an expert post-operative care nurse reviewing a wound image.
Analyze the image and provide a structured assessment.

EVALUATE:
1. Healing status (healing well / delayed healing / not healing)
2. Signs of infection: redness, swelling, warmth, purulent discharge, odour (describe what you see)
3. Wound closure integrity (intact / partial dehiscence / fully open)
4. Overall recommendation: MONITOR | FLAG | ALERT

FORMAT YOUR RESPONSE EXACTLY AS:
STATUS: <healing well | delayed | not healing>
INFECTION_SIGNS: <none | describe what you observe>
CLOSURE: <intact | partial | open>
RECOMMENDATION: <MONITOR | FLAG | ALERT>
NOTES: <1-2 sentence clinical summary for the nurse>
"""


class WoundVisionTool:
    """
    Submits a wound image to Gemini Flash (vision-capable) and parses
    the structured response into a dict the agent can act on.
    """

    def __init__(self) -> None:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is missing from environment.")

        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.1,
            google_api_key=api_key,
        )


    def analyze_wound(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze a wound image file.

        Args:
            image_path: Absolute or relative path to a JPEG/PNG image.

        Returns:
            {
                "status":          str,   # healing well | delayed | not healing
                "infection_signs": str,
                "closure":         str,
                "action":          str,   # MONITOR | FLAG | ALERT
                "notes":           str,
                "raw_response":    str,
            }
        """
        print(f"[VisionTool] 🔬  Analyzing wound image: {image_path}")

        if not os.path.exists(image_path):
            return self._error(f"Image not found: {image_path}")

        try:
            image_b64 = self._encode_image(image_path)
            mime_type = self._guess_mime(image_path)

            message = HumanMessage(content=[
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
                },
                {"type": "text", "text": VISION_PROMPT},
            ])

            response = self.llm.invoke([message])
            raw = response.content.strip()
            print(f"[VisionTool] ✅  Analysis complete.")
            return self._parse(raw)

        except Exception as e:
            print(f"[VisionTool] ❌  Error: {e}")
            return self._error(str(e))


    def _encode_image(self, path: str) -> str:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def _guess_mime(self, path: str) -> str:
        ext = path.lower().split(".")[-1]
        return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")

    def _parse(self, raw: str) -> Dict[str, Any]:
        """Parse the structured text response into a dict."""
        result: Dict[str, Any] = {
            "status": "unknown",
            "infection_signs": "unknown",
            "closure": "unknown",
            "action": "FLAG",  
            "notes": "",
            "raw_response": raw,
        }

        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("STATUS:"):
                result["status"] = line.split(":", 1)[1].strip().lower()
            elif line.startswith("INFECTION_SIGNS:"):
                result["infection_signs"] = line.split(":", 1)[1].strip()
            elif line.startswith("CLOSURE:"):
                result["closure"] = line.split(":", 1)[1].strip().lower()
            elif line.startswith("RECOMMENDATION:"):
                action = line.split(":", 1)[1].strip().upper()
                if action in ("MONITOR", "FLAG", "ALERT"):
                    result["action"] = action
            elif line.startswith("NOTES:"):
                result["notes"] = line.split(":", 1)[1].strip()

        return result

    def _error(self, reason: str) -> Dict[str, Any]:
        return {
            "status": "error",
            "infection_signs": "unknown",
            "closure": "unknown",
            "action": "FLAG",
            "notes": f"Vision analysis failed: {reason}",
            "raw_response": "",
        }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python vision_tool.py <image_path>")
    else:
        tool = WoundVisionTool()
        print(tool.analyze_wound(sys.argv[1]))