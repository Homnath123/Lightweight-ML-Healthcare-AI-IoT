# -----------------------------------------------------------------------------
# main.py - FastAPI backend for the CVD risk screening app
# Loads the trained Logistic Regression saved from Colab (cvd_model.joblib) and
# exposes a /predict endpoint that returns a risk probability and a label.
#
# Run with:  uvicorn main:app --reload
# Docs at :  http://localhost:8000/docs
# -----------------------------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import pandas as pd

# Load the saved model and the exact column order used in training
bundle = joblib.load("cvd_model.joblib")
model, columns = bundle["model"], bundle["columns"]

app = FastAPI(title="CVD Risk Screening API")

# Allow the React dev server (Vite) to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Input schema: the ranges match the cleaning thresholds used in the notebook,
# so the API only accepts values the model was trained on.
class Patient(BaseModel):
    age_years: int = Field(ge=18, le=100)
    gender: int = Field(ge=1, le=2)            # 1 = female, 2 = male
    height: float = Field(ge=120, le=220)      # cm
    weight: float = Field(ge=30, le=200)       # kg
    ap_hi: int = Field(ge=80, le=250)          # systolic blood pressure
    ap_lo: int = Field(ge=40, le=200)          # diastolic blood pressure
    cholesterol: int = Field(ge=1, le=3)       # 1 normal, 2 above, 3 well above
    gluc: int = Field(ge=1, le=3)              # 1 normal, 2 above, 3 well above
    smoke: int = Field(ge=0, le=1)
    alco: int = Field(ge=0, le=1)
    active: int = Field(ge=0, le=1)
    threshold: float = Field(default=0.5, ge=0.05, le=0.95)  # decision cutoff


@app.get("/")
def health():
    """Quick check that the server is running."""
    return {"status": "ok", "features": columns}


@app.post("/predict")
def predict(p: Patient):
    d = p.model_dump()
    threshold = d.pop("threshold")

    # Compute BMI exactly as in training
    d["bmi"] = d["weight"] / (d["height"] / 100) ** 2

    # Build a one-row DataFrame with columns in the training order
    X = pd.DataFrame([d])[columns]

    prob = float(model.predict_proba(X)[0, 1])
    return {
        "prediction": int(prob >= threshold),
        "probability": round(prob, 4),
        "threshold": threshold,
        "label": "Higher CVD risk" if prob >= threshold else "Lower CVD risk",
    }