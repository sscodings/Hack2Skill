const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

/**
 * Fetches the ML credit score prediction and explainability payload from the Python microservice.
 * @param {Object} features Feature values to send to the model.
 * @returns {Promise<Object|null>} The ML service response or null if there is any failure/timeout.
 */
async function getMlPrediction(features) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

  try {
    const url = `${ML_SERVICE_URL}/predict`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(features),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`ML Service returned non-ok status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.error("ML Service request timed out after 3 seconds.");
    } else {
      console.error("Error communicating with ML Service:", error.message);
    }
    return null;
  }
}

module.exports = {
  getMlPrediction,
};
