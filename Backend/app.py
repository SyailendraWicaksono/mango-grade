# app.py (Lazy load version - FIX FOR WINDOWS CRASH)
import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
import numpy as np
from PIL import Image
import io, json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EN_DIR = os.path.join(BASE_DIR, "ensemble_size_models")

# Load metadata only (very light)
meta = json.load(open(os.path.join(EN_DIR, "ensemble_meta.json"), "r", encoding="utf-8"))
MODEL_FILES = meta["models"]
CLASS_NAMES = meta["class_names"]

# Global holder for lazy loaded models
LOADED_MODELS = None

def load_models_once():
    """Load ensemble models only once on first predict() call."""
    global LOADED_MODELS
    if LOADED_MODELS is None:
        print(">>> LAZY LOADING MODELS...")
        models = []
        for m in MODEL_FILES:
            fname = os.path.basename(m)
            path = os.path.join(EN_DIR, fname)
            print("Loading model:", path)
            models.append(tf.keras.models.load_model(path))
        LOADED_MODELS = models
        print(">>> MODELS LOADED SUCCESSFULLY.")
    return LOADED_MODELS

def preprocess(img_bytes, target=(224,224)):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = img.resize(target)
    arr = np.array(img).astype("float32") / 255.0
    arr = np.expand_dims(arr, 0)
    return arr

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "server ok", "models_loaded": LOADED_MODELS is not None}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    models = load_models_once()      # <-- lazy load here
    img = await file.read()
    x = preprocess(img)

    outputs = [m.predict(x)[0] for m in models]
    avg = np.stack(outputs).mean(axis=0)
    top = int(avg.argmax())

    return {
        "label": CLASS_NAMES[top],
        "confidence": float(avg[top]),
        "probs": {CLASS_NAMES[i]: float(avg[i]) for i in range(len(avg))}
    }

# Run without uvicorn CLI (stable)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
