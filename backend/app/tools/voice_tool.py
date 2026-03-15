import os
import mimetypes
import base64
import uuid
from typing import Dict, Any, Optional

from deepgram import DeepgramClient, PrerecordedOptions, SpeakOptions


class VoiceTool:
    """
    Wrapper around Deepgram for:
    - Speech-to-text (patient voice messages)
    - Text-to-speech (nurse responses)
    """

    def __init__(self) -> None:
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise ValueError("❌ DEEPGRAM_API_KEY is missing in environment.")

        # Initialize Client
        self.client = DeepgramClient(api_key=api_key)

    # --- 1. SPEECH TO TEXT (Existing) ---
    def process_voice_message(self, audio_path: str) -> Dict[str, Any]:
        print(f"--- 🎙️ Tool: Transcribing {audio_path} ---")
        try:
            mime_type, _ = mimetypes.guess_type(audio_path)
            if not mime_type:
                mime_type = "audio/wav"

            with open(audio_path, "rb") as audio:
                buffer_data = audio.read()

            payload = {"buffer": buffer_data, "mimetype": mime_type}

            # STT Options
            options = PrerecordedOptions(
                model="nova-2",
                smart_format=True,
                utterances=True,
                punctuate=True,
                diarize=False,
            )

            response = self.client.listen.rest.v("1").transcribe_file(payload, options)
            transcript = response.results.channels[0].alternatives[0].transcript
            transcript = transcript.strip()
            print(f"✅ Transcript: {transcript}")
            return {"transcript": transcript, "status": "SUCCESS"}

        except Exception as e:
            print(f"❌ Deepgram STT Error: {e}")
            return {"status": "ERROR", "reasoning": str(e), "transcript": ""}

    # --- 2. TEXT TO SPEECH (New) ---
    def text_to_speech(self, text: str) -> Optional[str]:
        print(f"--- 🔊 Tool: Generating Speech for: '{text[:30]}...' ---")
        if not text:
            return None

        temp_name = f"tts_{uuid.uuid4().hex}.mp3"

        try:
            # TTS Options
            options = SpeakOptions(
                model="aura-asteria-en", 
                encoding="mp3",
            )

            # Generate Audio
            self.client.speak.rest.v("1").save(temp_name, {"text": text}, options)

            # Read file to bytes -> Base64
            with open(temp_name, "rb") as audio_file:
                audio_bytes = audio_file.read()

            base64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            return base64_audio

        except Exception as e:
            print(f"❌ Deepgram TTS Error: {e}")
            return None

        finally:
            # Cleanup temp file
            if os.path.exists(temp_name):
                os.remove(temp_name)