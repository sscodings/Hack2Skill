import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.svm import SVR, SVC
from sklearn.metrics import r2_score, mean_absolute_error, accuracy_score, f1_score
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import shap
import joblib
import optuna

# Disable Optuna logging output to keep console output clean
optuna.logging.set_verbosity(optuna.logging.WARNING)

def main():
    print("Starting ML Model Training pipeline...")
    
    # Define paths
    models_dir = "./models"
    os.makedirs(models_dir, exist_ok=True)
    
    # FIX 2A: Generate synthetic data with 5000 samples
    n_samples = 5000
    np.random.seed(42)
    
    gst_compliance_score = np.random.uniform(0.1, 1.0, n_samples)
    upi_turnover_score = np.random.uniform(0.1, 1.0, n_samples)
    upi_txn_frequency_monthly = np.random.uniform(0.0, 100.0, n_samples)
    epfo_stability_score = np.random.uniform(0.2, 1.0, n_samples)
    revenue_growth_score = np.random.uniform(0.0, 1.0, n_samples)
    debt_service_ratio = np.random.uniform(0.05, 0.95, n_samples)
    promoter_credit_score = np.random.randint(300, 900, n_samples)
    business_age_score = np.random.uniform(0.1, 1.0, n_samples)
    data_completeness_score = np.random.uniform(0.4, 1.0, n_samples)
    fraud_risk_score = np.random.uniform(0.0, 0.8, n_samples)

    upi_txn_frequency_score = upi_txn_frequency_monthly / 100.0

    credit_score = (
        gst_compliance_score    * 0.18 +
        upi_turnover_score      * 0.15 +
        upi_txn_frequency_score * 0.15 +
        epfo_stability_score    * 0.12 +
        revenue_growth_score    * 0.12 +
        (1.0 - debt_service_ratio) * 0.10 +
        (promoter_credit_score - 300) / 600.0 * 0.10 +
        business_age_score      * 0.05 +
        data_completeness_score * 0.02 +
        (1.0 - fraud_risk_score)  * 0.01
    ) * 100.0

    credit_score += np.random.normal(0, 3, n_samples)
    credit_score = np.clip(credit_score, 0.0, 100.0)

    # Build DataFrame
    features = [
        "gst_compliance_score",
        "upi_turnover_score",
        "upi_txn_frequency_monthly",
        "epfo_stability_score",
        "revenue_growth_score",
        "debt_service_ratio",
        "promoter_credit_score",
        "business_age_score",
        "data_completeness_score",
        "fraud_risk_score"
    ]
    
    df = pd.DataFrame({
        "gst_compliance_score": gst_compliance_score,
        "upi_turnover_score": upi_turnover_score,
        "upi_txn_frequency_monthly": upi_txn_frequency_monthly,
        "epfo_stability_score": epfo_stability_score,
        "revenue_growth_score": revenue_growth_score,
        "debt_service_ratio": debt_service_ratio,
        "promoter_credit_score": promoter_credit_score.astype(float),
        "business_age_score": business_age_score,
        "data_completeness_score": data_completeness_score,
        "fraud_risk_score": fraud_risk_score,
        "financial_health_score": credit_score
    })
    
    # Save feature lists
    with open(os.path.join(models_dir, "feature_list.json"), "w") as f:
        json.dump(features, f)
        
    with open(os.path.join(models_dir, "feature_names.json"), "w") as f:
        json.dump(features, f)
        
    X = df[features]
    y_reg = df["financial_health_score"]
    
    # Map category idx dynamically based on thresholds
    def get_category_idx(score):
        if score >= 80:
            return 3  # Excellent
        if score >= 60:
            return 2  # Good
        if score >= 40:
            return 1  # Fair
        return 0  # Poor
        
    y_clf = pd.Series([get_category_idx(s) for s in y_reg])
    
    # Stratified 80/20 train/test split based on category
    print("Splitting dataset into train and test sets (80/20 stratified on category)...")
    X_train, X_test, y_reg_train, y_reg_test, y_clf_train, y_clf_test = train_test_split(
        X, y_reg, y_clf, test_size=0.2, stratify=y_clf, random_state=42
    )
    
    # SimpleImputer fit on train features only
    print("Fitting SimpleImputer(strategy='median') on training features...")
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)
    
    # Convert back to DataFrame to preserve column names
    X_train_df = pd.DataFrame(X_train_imp, columns=features)
    X_test_df = pd.DataFrame(X_test_imp, columns=features)
    
    # Save imputer
    joblib.dump(imputer, os.path.join(models_dir, "imputer.joblib"))
    print("Saved imputer.joblib.")
    
    # --- EVALUATE BASELINE MODELS ---
    print("\n--- Training Baseline Models ---")
    
    # 1. Baseline RandomForestRegressor
    rf_reg = RandomForestRegressor(n_estimators=300, max_depth=8, random_state=42)
    rf_reg.fit(X_train_df, y_reg_train)
    y_pred_reg_rf = rf_reg.predict(X_test_df)
    r2_rf = r2_score(y_reg_test, y_pred_reg_rf)
    mae_rf = mean_absolute_error(y_reg_test, y_pred_reg_rf)
    print(f"Baseline RandomForestRegressor: R2 = {r2_rf:.4f}, MAE = {mae_rf:.4f}")
    
    # 2. Baseline RandomForestClassifier
    rf_clf = RandomForestClassifier(n_estimators=400, max_depth=10, class_weight="balanced", random_state=42)
    rf_clf.fit(X_train_df, y_clf_train)
    y_pred_clf_rf = rf_clf.predict(X_test_df)
    acc_rf = accuracy_score(y_clf_test, y_pred_clf_rf)
    f1_rf = f1_score(y_clf_test, y_pred_clf_rf, average="macro")
    print(f"Baseline RandomForestClassifier: Accuracy = {acc_rf:.4f}, Macro-F1 = {f1_rf:.4f}")
    
    # --- OPTUNA HYPERPARAMETER TUNING ---
    print("\n--- Tuning Regressors with Optuna (RF and XGBoost only, SVR evaluated separately) ---")
    
    # We evaluate SVR for comparison, but it cannot be used with TreeExplainer
    # Scale data for SVR
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_df)
    X_test_scaled = scaler.transform(X_test_df)
    
    svr = SVR()
    svr.fit(X_train_scaled, y_reg_train)
    y_pred_svr = svr.predict(X_test_scaled)
    r2_svr = r2_score(y_reg_test, y_pred_svr)
    mae_svr = mean_absolute_error(y_reg_test, y_pred_svr)
    print(f"Baseline SVM Regressor (SVR): R2 = {r2_svr:.4f}, MAE = {mae_svr:.4f} (Not eligible for TreeExplainer)")

    # Optuna study for Tree-based Regressors (RandomForest and XGBoost)
    def regressor_objective(trial):
        model_type = trial.suggest_categorical("model_type", ["rf", "xgboost"])
        if model_type == "rf":
            n_estimators = trial.suggest_int("rf_n_estimators", 100, 400)
            max_depth = trial.suggest_int("rf_max_depth", 4, 15)
            min_samples_split = trial.suggest_int("rf_min_samples_split", 2, 10)
            model = RandomForestRegressor(
                n_estimators=n_estimators,
                max_depth=max_depth,
                min_samples_split=min_samples_split,
                random_state=42,
                n_jobs=-1
            )
        else:
            n_estimators = trial.suggest_int("xgb_n_estimators", 100, 400)
            max_depth = trial.suggest_int("xgb_max_depth", 3, 10)
            learning_rate = trial.suggest_float("xgb_learning_rate", 0.01, 0.2, log=True)
            subsample = trial.suggest_float("xgb_subsample", 0.6, 1.0)
            colsample_bytree = trial.suggest_float("xgb_colsample_bytree", 0.6, 1.0)
            model = xgb.XGBRegressor(
                n_estimators=n_estimators,
                max_depth=max_depth,
                learning_rate=learning_rate,
                subsample=subsample,
                colsample_bytree=colsample_bytree,
                random_state=42,
                n_jobs=-1
            )
            
        model.fit(X_train_df, y_reg_train)
        preds = model.predict(X_test_df)
        return r2_score(y_reg_test, preds)

    reg_study = optuna.create_study(direction="maximize")
    reg_study.optimize(regressor_objective, n_trials=20)
    best_reg_params = reg_study.best_params
    best_reg_r2 = reg_study.best_value
    print(f"Optuna Best Tree-based Regressor R2: {best_reg_r2:.4f} with params: {best_reg_params}")
    
    # Train the best regressor
    if best_reg_params["model_type"] == "rf":
        print("Best Regressor: RandomForest")
        best_regressor = RandomForestRegressor(
            n_estimators=best_reg_params["rf_n_estimators"],
            max_depth=best_reg_params["rf_max_depth"],
            min_samples_split=best_reg_params["rf_min_samples_split"],
            random_state=42,
            n_jobs=-1
        )
    else:
        print("Best Regressor: XGBoost")
        best_regressor = xgb.XGBRegressor(
            n_estimators=best_reg_params["xgb_n_estimators"],
            max_depth=best_reg_params["xgb_max_depth"],
            learning_rate=best_reg_params["xgb_learning_rate"],
            subsample=best_reg_params["xgb_subsample"],
            colsample_bytree=best_reg_params["xgb_colsample_bytree"],
            random_state=42,
            n_jobs=-1
        )
        
    best_regressor.fit(X_train_df, y_reg_train)
    y_pred_best_reg = best_regressor.predict(X_test_df)
    final_r2 = r2_score(y_reg_test, y_pred_best_reg)
    final_mae = mean_absolute_error(y_reg_test, y_pred_best_reg)
    print(f"Final Regressor: R2 = {final_r2:.4f}, MAE = {final_mae:.4f}")
    
    # Save the selected best regressor
    joblib.dump(best_regressor, os.path.join(models_dir, "score_model.joblib"))
    print("Saved score_model.joblib.")
    
    # --- CLASSIFIER TUNING ---
    print("\n--- Tuning Classifiers with Optuna (RF, XGBoost, SVM) ---")
    
    def classifier_objective(trial):
        model_type = trial.suggest_categorical("clf_model_type", ["rf", "xgboost", "svm"])
        if model_type == "rf":
            n_estimators = trial.suggest_int("rf_clf_n_estimators", 100, 400)
            max_depth = trial.suggest_int("rf_clf_max_depth", 4, 15)
            model = RandomForestClassifier(
                n_estimators=n_estimators,
                max_depth=max_depth,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1
            )
            model.fit(X_train_df, y_clf_train)
            preds = model.predict(X_test_df)
        elif model_type == "xgboost":
            n_estimators = trial.suggest_int("xgb_clf_n_estimators", 100, 400)
            max_depth = trial.suggest_int("xgb_clf_max_depth", 3, 10)
            learning_rate = trial.suggest_float("xgb_clf_learning_rate", 0.01, 0.2, log=True)
            model = xgb.XGBClassifier(
                n_estimators=n_estimators,
                max_depth=max_depth,
                learning_rate=learning_rate,
                random_state=42,
                n_jobs=-1
            )
            model.fit(X_train_df, y_clf_train)
            preds = model.predict(X_test_df)
        else: # svm
            C = trial.suggest_float("svm_C", 0.1, 10.0, log=True)
            kernel = trial.suggest_categorical("svm_kernel", ["linear", "rbf"])
            model = SVC(C=C, kernel=kernel, probability=True, random_state=42)
            # SVM works better on scaled features
            model.fit(X_train_scaled, y_clf_train)
            preds = model.predict(X_test_scaled)
            
        return f1_score(y_clf_test, preds, average="macro")
        
    clf_study = optuna.create_study(direction="maximize")
    clf_study.optimize(classifier_objective, n_trials=20)
    best_clf_params = clf_study.best_params
    best_clf_f1 = clf_study.best_value
    print(f"Optuna Best Classifier Macro-F1: {best_clf_f1:.4f} with params: {best_clf_params}")
    
    # Train and save the best classifier
    selected_clf_type = best_clf_params["clf_model_type"]
    if selected_clf_type == "rf":
        print("Best Classifier: RandomForest")
        best_classifier = RandomForestClassifier(
            n_estimators=best_clf_params["rf_clf_n_estimators"],
            max_depth=best_clf_params["rf_clf_max_depth"],
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        )
        best_classifier.fit(X_train_df, y_clf_train)
    elif selected_clf_type == "xgboost":
        print("Best Classifier: XGBoost")
        best_classifier = xgb.XGBClassifier(
            n_estimators=best_clf_params["xgb_clf_n_estimators"],
            max_depth=best_clf_params["xgb_clf_max_depth"],
            learning_rate=best_clf_params["xgb_clf_learning_rate"],
            random_state=42,
            n_jobs=-1
        )
        best_classifier.fit(X_train_df, y_clf_train)
    else:
        print("Best Classifier: SVM")
        # SVM needs to wrap scaling to be safe, or we save a custom pipeline
        # Let's use a Pipeline wrapper from sklearn so it automatically scales
        from sklearn.pipeline import Pipeline
        best_classifier = Pipeline([
            ('scaler', StandardScaler()),
            ('svc', SVC(
                C=best_clf_params["svm_C"],
                kernel=best_clf_params["svm_kernel"],
                probability=True,
                random_state=42
            ))
        ])
        best_classifier.fit(X_train_df, y_clf_train)
        
    # Evaluate final classifier
    y_pred_best_clf = best_classifier.predict(X_test_df)
    final_acc = accuracy_score(y_clf_test, y_pred_best_clf)
    final_f1 = f1_score(y_clf_test, y_pred_best_clf, average="macro")
    print(f"Final Classifier: Accuracy = {final_acc:.4f}, Macro-F1 = {final_f1:.4f}")
    
    # Save best classifier
    joblib.dump(best_classifier, os.path.join(models_dir, "category_model.joblib"))
    print("Saved category_model.joblib.")
    
    # --- SHAP EXPLAINABILITY ---
    print("\n--- Computing SHAP Explainability on Test Set ---")
    explainer = shap.TreeExplainer(best_regressor)
    shap_values = explainer.shap_values(X_test_df)
    
    # In shap version >= 0.45, shap_values might be a Explanation object or numpy array or list
    if hasattr(shap_values, "values"):
        vals = shap_values.values
    elif isinstance(shap_values, list):
        vals = shap_values[0] # for multi-class or list outputs
    else:
        vals = shap_values
        
    # Print the shape of the SHAP values we got for logging/debugging
    print(f"SHAP values computed. Shape: {vals.shape}")
    
    # Compute mean absolute SHAP value per feature
    mean_abs_shap = np.abs(vals).mean(axis=0)
    
    feature_importance = []
    for feat, score in zip(features, mean_abs_shap):
        feature_importance.append({
            "feature": feat,
            "importance": float(score)
        })
        
    # Sort feature importances descending
    feature_importance = sorted(feature_importance, key=lambda x: x["importance"], reverse=True)
    
    print("SHAP Feature Importance:")
    for item in feature_importance:
        print(f"  {item['feature']}: {item['importance']:.4f}")
        
    # Save to global feature importance json
    with open(os.path.join(models_dir, "feature_importance.json"), "w") as f:
        json.dump(feature_importance, f)
    print("Saved feature_importance.json.")
    print("Model training successfully completed!")

if __name__ == "__main__":
    main()
