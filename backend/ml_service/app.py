import os
import json
import logging
import numpy as np
import pandas as pd
import joblib
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml_service")

app = FastAPI(title="CreditBridge ML Scoring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models and feature list
imputer = None
score_model = None
category_model = None
feature_list = None
explainer = None
feature_importance_global = None

class PredictionInput(BaseModel):
    # Old features
    promoter_credit_score: Optional[float] = None
    commercial_assets_value: Optional[float] = None
    bank_asset_value: Optional[float] = None
    gst_monthly_turnover_inr: Optional[float] = None
    gst_filing_regularity_score: Optional[float] = None
    upi_txn_frequency_monthly: Optional[float] = None
    upi_txn_volume_inr_monthly: Optional[float] = None
    epfo_contribution_consistency_months: Optional[float] = None
    aa_linked_accounts_count: Optional[float] = None

    # New features
    gst_compliance_score: Optional[float] = None
    upi_turnover_score: Optional[float] = None
    epfo_stability_score: Optional[float] = None
    revenue_growth_score: Optional[float] = None
    debt_service_ratio: Optional[float] = None
    business_age_score: Optional[float] = None
    data_completeness_score: Optional[float] = None
    fraud_risk_score: Optional[float] = None

@app.on_event("startup")
def load_resources():
    global imputer, score_model, category_model, feature_list, explainer, feature_importance_global
    
    models_dir = "./models"
    if not os.path.exists(models_dir):
        # Fallback if run from different folder
        models_dir = "backend/ml_service/models"
        
    logger.info(f"Loading resources from {models_dir}...")
    
    try:
        imputer = joblib.load(os.path.join(models_dir, "imputer.joblib"))
        score_model = joblib.load(os.path.join(models_dir, "score_model.joblib"))
        category_model = joblib.load(os.path.join(models_dir, "category_model.joblib"))
        
        with open(os.path.join(models_dir, "feature_list.json"), "r") as f:
            feature_list = json.load(f)
            
        with open(os.path.join(models_dir, "feature_importance.json"), "r") as f:
            feature_importance_global = json.load(f)
            
        logger.info("Loaded models, imputer, feature list, and feature importances successfully.")
        
        # Instantiate TreeExplainer
        explainer = shap.TreeExplainer(score_model)
        logger.info("SHAP TreeExplainer initialized successfully.")
        
        # Dry run to log SHAP shape once at startup for debugging
        dummy_data = {feat: [0.0] for feat in feature_list}
        dummy_df = pd.DataFrame(dummy_data)
        dummy_imp = imputer.transform(dummy_df)
        dummy_shap = explainer.shap_values(dummy_imp)
        
        logger.info(f"[STARTUP DEBUG] Dummy SHAP values type: {type(dummy_shap)}")
        if hasattr(dummy_shap, "shape"):
            logger.info(f"[STARTUP DEBUG] Dummy SHAP values shape: {dummy_shap.shape}")
        elif isinstance(dummy_shap, list):
            elem_shape = dummy_shap[0].shape if hasattr(dummy_shap[0], "shape") else "no shape"
            logger.info(f"[STARTUP DEBUG] Dummy SHAP values is list of length {len(dummy_shap)}. Element 0 shape: {elem_shape}")
            
    except Exception as e:
        logger.error(f"Error loading resources at startup: {str(e)}", exc_info=True)
        raise e

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": all([imputer, score_model, category_model, feature_list, explainer])
    }

@app.get("/explain/global")
def get_global_explanation():
    if feature_importance_global is None:
        raise HTTPException(status_code=503, detail="Global feature importance not loaded")
    return feature_importance_global

def extract_shap_array(shap_values):
    # Handle SHAP Explanation object
    if hasattr(shap_values, "values"):
        val = shap_values.values
    # Handle list of arrays (commonly returned for multi-output or multi-class, though score_model is regressor)
    elif isinstance(shap_values, list):
        val = shap_values[0]
    else:
        val = shap_values
        
    # Handle shape dimensions (we expect a 1D array of length 9 for our 9 features)
    if len(val.shape) == 2:
        val = val[0]
    elif len(val.shape) == 3:
        val = val[0, :, 0]
        
    return val

@app.post("/predict")
def predict_score_and_explain(payload: PredictionInput):
    if not all([imputer, score_model, category_model, feature_list, explainer]):
        raise HTTPException(status_code=503, detail="Models or explainer are not loaded")
        
    try:
        # Build DataFrame with input features (fill missing with np.nan for imputation)
        input_dict = payload.dict()
        
        # Map old feature names to new ones if old names are supplied
        if input_dict.get("gst_compliance_score") is None and input_dict.get("gst_filing_regularity_score") is not None:
            input_dict["gst_compliance_score"] = float(input_dict["gst_filing_regularity_score"]) / 100.0
            
        if input_dict.get("upi_turnover_score") is None and input_dict.get("upi_txn_volume_inr_monthly") is not None:
            input_dict["upi_turnover_score"] = (float(input_dict["upi_txn_volume_inr_monthly"]) / 100000.0) / 20.0
            
        if input_dict.get("epfo_stability_score") is None and input_dict.get("epfo_contribution_consistency_months") is not None:
            input_dict["epfo_stability_score"] = float(input_dict["epfo_contribution_consistency_months"]) / 12.0
            
        if input_dict.get("debt_service_ratio") is None:
            input_dict["debt_service_ratio"] = 0.35
            
        if input_dict.get("revenue_growth_score") is None:
            input_dict["revenue_growth_score"] = 0.5
            
        if input_dict.get("business_age_score") is None:
            input_dict["business_age_score"] = 0.6
            
        if input_dict.get("data_completeness_score") is None:
            input_dict["data_completeness_score"] = 0.8
            
        if input_dict.get("fraud_risk_score") is None:
            input_dict["fraud_risk_score"] = 0.1
            
        row_data = {}
        for feat in feature_list:
            val = input_dict.get(feat)
            row_data[feat] = [np.nan if val is None else float(val)]
            
        df_row = pd.DataFrame(row_data)
        
        # Apply imputer
        X_imp = imputer.transform(df_row)
        
        # Run regressor model for score
        pred_score = score_model.predict(X_imp)[0]
        score_0_100 = float(np.clip(pred_score, 0.0, 100.0))
        
        # Run classifier model for category
        # If it's a scikit-learn Pipeline (SVM), predict works normally on raw inputs but imputer outputs raw numpy array.
        # Let's pass the imputed numpy array or a dataframe to predict.
        # Note: If category_model is a Pipeline, it expects a DataFrame if the fit was on DataFrame, or numpy array.
        # Let's pass it a DataFrame to be safe, since RandomForest and XGBoost can also take DataFrame.
        X_imp_df = pd.DataFrame(X_imp, columns=feature_list)
        
        pred_class_idx = int(category_model.predict(X_imp_df)[0])
        probs = category_model.predict_proba(X_imp_df)[0]
        
        class_names_map = {0: "poor", 1: "fair", 2: "good", 3: "excellent"}
        band_hint = class_names_map.get(pred_class_idx, "fair")
        
        # Handle classifier probability mappings defensively
        category_probabilities = {"poor": 0.0, "fair": 0.0, "good": 0.0, "excellent": 0.0}
        # If classifier classes are mapped to 0, 1, 2, 3
        for c_idx, prob in zip(category_model.classes_, probs):
            c_name = class_names_map.get(int(c_idx))
            if c_name:
                category_probabilities[c_name] = float(prob)
                
        # Compute SHAP values for this row
        # TreeExplainer expects numpy array or pandas DataFrame
        shap_values = explainer.shap_values(X_imp_df)
        shap_row = extract_shap_array(shap_values)
        
        # Compute base value (expected value) defensively
        base_value = explainer.expected_value
        if isinstance(base_value, (list, np.ndarray)):
            base_value = float(base_value[0])
        else:
            base_value = float(base_value)
            
        # Build feature contributions list
        contributions = []
        imputed_values = X_imp[0]
        for feat, s_val, f_val in zip(feature_list, shap_row, imputed_values):
            contributions.append({
                "feature": feat,
                "shap_value": float(s_val),
                "feature_value": float(f_val)
            })
            
        # Sort contributions by absolute shap value descending
        contributions = sorted(contributions, key=lambda x: abs(x["shap_value"]), reverse=True)
        
        return {
            "score_0_100": score_0_100,
            "band_hint": band_hint,
            "category_probabilities": category_probabilities,
            "model_version": "ml-rf-v1",
            "explanation": {
                "base_value_0_100": base_value,
                "contributions": contributions
            }
        }
        
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

class SimulateInput(BaseModel):
    gst_compliance_score: Optional[float] = None
    upi_turnover_score: Optional[float] = None
    upi_txn_frequency_monthly: Optional[float] = None
    epfo_stability_score: Optional[float] = None
    revenue_growth_score: Optional[float] = None
    debt_service_ratio: Optional[float] = None
    promoter_credit_score: Optional[float] = None
    business_age_score: Optional[float] = None
    data_completeness_score: Optional[float] = None
    fraud_risk_score: Optional[float] = None

@app.post("/simulate")
def simulate_score(payload: SimulateInput):
    if not all([imputer, score_model, category_model, feature_list, explainer]):
        raise HTTPException(status_code=503, detail="Models are not fully loaded")
        
    try:
        # Load feature_names.json to validate
        models_dir = "./models"
        if not os.path.exists(models_dir):
            models_dir = "backend/ml_service/models"
            
        feature_names_path = os.path.join(models_dir, "feature_names.json")
        if os.path.exists(feature_names_path):
            with open(feature_names_path, "r") as f:
                required_features = json.load(f)
        else:
            required_features = feature_list
            
        # Validate that all required features are present in the payload (non-null)
        input_dict = payload.dict()
        for feat in required_features:
            if input_dict.get(feat) is None:
                raise HTTPException(status_code=400, detail=f"Missing required feature: {feat}")
                
        # Build DataFrame for prediction
        row_data = {feat: [float(input_dict[feat])] for feat in required_features}
        df_row = pd.DataFrame(row_data)
        
        # Impute
        X_imp = imputer.transform(df_row)
        
        # Predict score
        pred_score = score_model.predict(X_imp)[0]
        score_0_100 = float(np.clip(pred_score, 0.0, 100.0))
        
        # Determine band
        if score_0_100 >= 80.0:
            band = "excellent"
        elif score_0_100 >= 60.0:
            band = "good"
        elif score_0_100 >= 40.0:
            band = "fair"
        else:
            band = "poor"
            
        # Compute SHAP values for this row
        X_imp_df = pd.DataFrame(X_imp, columns=feature_list)
        shap_values = explainer.shap_values(X_imp_df)
        shap_row = extract_shap_array(shap_values)
        
        # Compute base value defensively
        base_value = explainer.expected_value
        if isinstance(base_value, (list, np.ndarray)):
            base_value = float(base_value[0])
        else:
            base_value = float(base_value)
            
        # Build feature contributions list
        contributions = []
        imputed_values = X_imp[0]
        for feat, s_val, f_val in zip(feature_list, shap_row, imputed_values):
            contributions.append({
                "feature": feat,
                "shap_value": float(s_val),
                "feature_value": float(f_val)
            })
            
        # Sort contributions by absolute shap value descending
        contributions = sorted(contributions, key=lambda x: abs(x["shap_value"]), reverse=True)
            
        return {
            "score": score_0_100,
            "band": band,
            "explanation": {
                "base_value_0_100": base_value,
                "contributions": contributions
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Simulation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")
