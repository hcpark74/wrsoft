import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("--- Available Models ---")
try:
    models = client.models.list()
    for m in models:
        print(f"Name: {m.name}, Supported Actions: {m.supported_generation_methods}")
except Exception as e:
    print(f"Error listing models: {e}")

print("\n--- Testing Gemini 1.5 Pro ---")
try:
    response = client.models.generate_content(
        model="gemini-1.5-pro",
        contents="Hi"
    )
    print(f"Success: {response.text}")
except Exception as e:
    print(f"Error with gemini-1.5-pro: {e}")

print("\n--- Testing Gemini 1.5 Flash ---")
try:
    response = client.models.generate_content(
        model="gemini-1.5-flash",
        contents="Hi"
    )
    print(f"Success: {response.text}")
except Exception as e:
    print(f"Error with gemini-1.5-flash: {e}")
