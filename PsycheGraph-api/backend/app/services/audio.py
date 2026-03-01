import os
import time
import logging
import shutil
import mimetypes
import tempfile
from typing import List, Tuple, Dict, Optional

import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment

# import sounddevice as sd
# import scipy.io.wavfile as wav

from fastapi import UploadFile, HTTPException

from openai import AsyncOpenAI, OpenAI
from dotenv import load_dotenv

# Load .env explicitly
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(base_dir, ".env")
load_dotenv(env_path)

# -------------------------------------------------
# CONFIG
# -------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# async_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
# sync_client = OpenAI(api_key=OPENAI_API_KEY)

TEMP_DIR = "temp_audio"
TRANSCRIPT_DIR = "transcripts"

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

logger = logging.getLogger("audio-processor")
logging.basicConfig(level=logging.INFO)

MAX_CHUNK_DURATION = 30

# -------------------------------------------------
# SUPPORTED LANGUAGES
# Whisper ISO 639-1 language codes
# -------------------------------------------------
SUPPORTED_LANGUAGES = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "ar": "Arabic",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
}


# -------------------------------------------------
# AUDIO PROCESSOR
# -------------------------------------------------
class AudioProcessor:

    AUDIO_EXTENSIONS = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".mp4", ".webm")

    @staticmethod
    def is_audio_file(filename: str) -> bool:
        mime, _ = mimetypes.guess_type(filename)
        return (
            filename.lower().endswith(AudioProcessor.AUDIO_EXTENSIONS)
            or (mime and mime.startswith("audio"))
        )

    @staticmethod
    def save_upload(file: UploadFile) -> str:
        path = os.path.join(TEMP_DIR, f"{int(time.time())}_{file.filename}")
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        return path

    @staticmethod
    def convert_to_wav(path: str) -> str:
        if path.endswith(".wav"):
            return path
        wav_path = f"{path}.wav"
        audio = AudioSegment.from_file(path)
        audio.export(wav_path, format="wav")
        return wav_path

    @staticmethod
    def load_audio(path: str) -> Tuple[np.ndarray, int]:
        try:
            y, sr = sf.read(path)
            if len(y.shape) > 1:
                y = y.mean(axis=1)
            return y, sr
        except Exception:
            return librosa.load(path, sr=16000, mono=True)

    @staticmethod
    def split_audio(path: str) -> List[str]:
        y, sr = AudioProcessor.load_audio(path)
        duration = len(y) / sr

        if duration <= MAX_CHUNK_DURATION:
            return [path]

        chunk_size = int(MAX_CHUNK_DURATION * sr)
        chunks = []

        for i in range(0, len(y), chunk_size):
            chunk = y[i:i + chunk_size]
            chunk_path = f"{path}_chunk_{i}.wav"
            sf.write(chunk_path, chunk, sr)
            chunks.append(chunk_path)

        return chunks


# -------------------------------------------------
# TRANSCRIPTION — with language support
# -------------------------------------------------
async def transcribe_audio(path: str, language: Optional[str] = None) -> str:
    """
    Transcribe audio using Whisper.

    language: ISO 639-1 code e.g. 'en', 'ta', 'hi'
              Pass None to let Whisper auto-detect the language.
    """
    try:
        if language and language not in SUPPORTED_LANGUAGES:
            logger.warning(f"Unknown language code '{language}', falling back to auto-detect")
            language = None

        with open(path, "rb") as audio:
            params = {
                "file": audio,
                "model": "whisper-1",
                "prompt": "Medical consultation between a doctor and a patient.",
            }

            # Only pass language if specified — None means auto-detect
            if language:
                params["language"] = language

            result = await async_client.audio.transcriptions.create(**params)

        return result.text

    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        return ""


# -------------------------------------------------
# FORMAT TRANSCRIPT
# -------------------------------------------------
def format_transcript(text: str, language_name: str = "Auto-detected") -> str:
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "=" * 50,
        "     MEDICAL APPOINTMENT TRANSCRIPT",
        "=" * 50,
        f"Date     : {now}",
        f"Language : {language_name}",
        "=" * 50,
        "",
        text,
        "",
        "=" * 50,
        "          END OF TRANSCRIPT",
        "=" * 50,
    ]
    return "\n".join(lines)


# -------------------------------------------------
# SAVE TEXT FILE
# -------------------------------------------------
def save_transcript(text: str, prefix="meeting") -> str:
    filename = f"{prefix}_{int(time.time())}.txt"
    path = os.path.join(TRANSCRIPT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


# -------------------------------------------------
# MAIN PIPELINE — called by sessions.py
# -------------------------------------------------
async def process_audio_file(
    file: UploadFile,
    language: Optional[str] = None
) -> Dict:
    """
    Full pipeline:
    1. Save uploaded audio
    2. Convert to WAV
    3. Split into chunks if long
    4. Transcribe each chunk with Whisper (in specified language)
    5. Save transcript to file
    6. Return result

    language: ISO 639-1 code e.g. 'en', 'ta', 'hi', 'ar'
              None = Whisper auto-detects language
    """

    if not AudioProcessor.is_audio_file(file.filename):
        raise HTTPException(400, "Unsupported audio format")

    language_name = SUPPORTED_LANGUAGES.get(language, "Auto-detected") if language else "Auto-detected"
    logger.info(f"Processing audio — Language: {language_name} (code: {language or 'auto'})")

    # Save and convert
    original = AudioProcessor.save_upload(file)

    try:
        wav_path = AudioProcessor.convert_to_wav(original)
    except Exception as e:
        logger.error(f"Conversion error: {e}")
        wav_path = original

    # Split and transcribe
    chunks = AudioProcessor.split_audio(wav_path)
    texts = []

    for chunk in chunks:
        text = await transcribe_audio(chunk, language=language)
        if text:
            texts.append(text)
        logger.info(f"Chunk transcribed: {chunk}")

    full_text = " ".join(texts)
    formatted = format_transcript(full_text, language_name)

    # Save transcript file
    transcript_file = save_transcript(formatted, "appointment")

    # Cleanup temp files
    try:
        if os.path.exists(original):
            os.remove(original)
        if wav_path != original and os.path.exists(wav_path):
            os.remove(wav_path)
        for chunk in chunks:
            if chunk != wav_path and os.path.exists(chunk):
                os.remove(chunk)
    except Exception as e:
        logger.warning(f"Cleanup warning: {e}")

    logger.info(f"Transcript complete — Language: {language_name}, File: {transcript_file}")

    return {
        "transcript": full_text,
        "english_translation": formatted,
        "summary": formatted,
        "file": transcript_file,
        "language": language_name
    }


# -------------------------------------------------
# SUPPORTED LANGUAGES HELPER — for API endpoint
# -------------------------------------------------
def get_supported_languages() -> Dict:
    return SUPPORTED_LANGUAGES


# -------------------------------------------------
# LIVE AUDIO TRANSCRIPTION (MICROPHONE)
# -------------------------------------------------
SAMPLE_RATE = 16000
DURATION = 10


def record_chunk():
    print("Recording live audio...")
    audio = sd.rec(
        int(DURATION * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1
    )
    sd.wait()
    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    wav.write(temp_file.name, SAMPLE_RATE, audio)
    return temp_file.name


def transcribe_live(file_path, language: Optional[str] = None):
    with open(file_path, "rb") as f:
        params = {
            "file": f,
            "model": "whisper-1",
        }
        if language:
            params["language"] = language
        result = sync_client.audio.transcriptions.create(**params)
    return result.text


def start_live_transcription(language: Optional[str] = None):
    txt_path = os.path.join(TRANSCRIPT_DIR, f"live_{int(time.time())}.txt")
    language_name = SUPPORTED_LANGUAGES.get(language, "Auto-detected") if language else "Auto-detected"

    print(f"Live transcription started in {language_name}...")
    print("Saving to:", txt_path)

    while True:
        try:
            audio_file = record_chunk()
            text = transcribe_live(audio_file, language=language)
            print("Text:", text)
            with open(txt_path, "a", encoding="utf-8") as f:
                f.write(text + "\n")
        except KeyboardInterrupt:
            print("Stopped live transcription")
            break