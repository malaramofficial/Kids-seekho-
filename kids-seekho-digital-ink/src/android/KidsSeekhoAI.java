package com.malaram.kidsseekho.ai;

import android.util.Log;

import com.google.mlkit.common.MlKitException;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.vision.digitalink.common.RecognitionResult;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.recognition.Ink;
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext;
import com.google.mlkit.vision.digitalink.recognition.WritingArea;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class KidsSeekhoAI extends CordovaPlugin {
    private static final String TAG = "KidsSeekhoAI";

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if ("isAvailable".equals(action)) {
            callbackContext.success("true");
            return true;
        }
        if ("prepare".equals(action)) {
            String languageTag = args.optString(0, "en-US");
            prepareModel(languageTag, callbackContext);
            return true;
        }
        if ("recognize".equals(action)) {
            JSONObject request = args.optJSONObject(0);
            if (request == null) {
                callbackContext.error("Missing recognition request");
                return true;
            }
            recognize(request, callbackContext);
            return true;
        }
        return false;
    }

    private DigitalInkRecognitionModel getModel(String languageTag, CallbackContext callbackContext) {
        try {
            DigitalInkRecognitionModelIdentifier id =
                    DigitalInkRecognitionModelIdentifier.fromLanguageTag(languageTag);
            if (id == null) {
                callbackContext.error("No handwriting model for " + languageTag);
                return null;
            }
            return DigitalInkRecognitionModel.builder(id).build();
        } catch (MlKitException e) {
            callbackContext.error("No handwriting model for " + languageTag);
            return null;
        }
    }

    private void prepareModel(final String languageTag, final CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                final DigitalInkRecognitionModel model = getModel(languageTag, callbackContext);
                if (model == null) return;
                RemoteModelManager manager = RemoteModelManager.getInstance();
                manager.isModelDownloaded(model).addOnSuccessListener(downloaded -> {
                    if (Boolean.TRUE.equals(downloaded)) {
                        try {
                            JSONObject out = new JSONObject();
                            out.put("ready", true);
                            out.put("downloaded", true);
                            out.put("language", languageTag);
                            callbackContext.success(out);
                        } catch (Exception e) {
                            callbackContext.success("ready");
                        }
                        return;
                    }
                    manager.download(model, new DownloadConditions.Builder().build())
                            .addOnSuccessListener(v -> {
                                try {
                                    JSONObject out = new JSONObject();
                                    out.put("ready", true);
                                    out.put("downloaded", true);
                                    out.put("language", languageTag);
                                    callbackContext.success(out);
                                } catch (Exception e) {
                                    callbackContext.success("ready");
                                }
                            })
                            .addOnFailureListener(e -> {
                                Log.e(TAG, "Model download failed for " + languageTag, e);
                                callbackContext.error("AI model download failed: " + safeMessage(e));
                            });
                }).addOnFailureListener(e -> {
                    Log.e(TAG, "Model availability check failed", e);
                    callbackContext.error("AI model check failed: " + safeMessage(e));
                });
            } catch (Exception e) {
                Log.e(TAG, "Model preparation failed", e);
                callbackContext.error("AI preparation failed: " + safeMessage(e));
            }
        });
    }

    private void recognize(final JSONObject request, final CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                String languageTag = request.optString("languageTag", "en-US");
                float width = (float) request.optDouble("width", 1.0);
                float height = (float) request.optDouble("height", 1.0);
                JSONArray strokes = request.optJSONArray("strokes");
                if (strokes == null || strokes.length() == 0) {
                    callbackContext.error("No handwriting strokes");
                    return;
                }
                final DigitalInkRecognitionModel model = getModel(languageTag, callbackContext);
                if (model == null) return;
                RemoteModelManager.getInstance().isModelDownloaded(model)
                        .addOnSuccessListener(downloaded -> {
                            if (Boolean.TRUE.equals(downloaded)) {
                                runRecognition(model, request, width, height, callbackContext);
                            } else {
                                RemoteModelManager.getInstance().download(model, new DownloadConditions.Builder().build())
                                        .addOnSuccessListener(v -> runRecognition(model, request, width, height, callbackContext))
                                        .addOnFailureListener(e -> {
                                            Log.e(TAG, "Model download failed", e);
                                            callbackContext.error("AI model download failed: " + safeMessage(e));
                                        });
                            }
                        })
                        .addOnFailureListener(e -> {
                            Log.e(TAG, "Model availability check failed", e);
                            callbackContext.error("AI model check failed: " + safeMessage(e));
                        });
            } catch (Exception e) {
                Log.e(TAG, "Recognition setup failed", e);
                callbackContext.error("AI setup failed: " + safeMessage(e));
            }
        });
    }

    private void runRecognition(DigitalInkRecognitionModel model, JSONObject request,
                                float width, float height, CallbackContext callbackContext) {
        try {
            Ink.Builder inkBuilder = Ink.builder();
            JSONArray strokes = request.optJSONArray("strokes");
            for (int i = 0; i < strokes.length(); i++) {
                JSONArray strokePoints = strokes.getJSONObject(i).optJSONArray("points");
                if (strokePoints == null || strokePoints.length() == 0) continue;
                Ink.Stroke.Builder strokeBuilder = Ink.Stroke.builder();
                for (int j = 0; j < strokePoints.length(); j++) {
                    JSONObject p = strokePoints.getJSONObject(j);
                    float x = (float) p.optDouble("x", 0);
                    float y = (float) p.optDouble("y", 0);
                    long t = p.optLong("t", System.currentTimeMillis());
                    strokeBuilder.addPoint(Ink.Point.create(x, y, t));
                }
                inkBuilder.addStroke(strokeBuilder.build());
            }
            Ink ink = inkBuilder.build();
            DigitalInkRecognizer recognizer = DigitalInkRecognition.getClient(
                    DigitalInkRecognizerOptions.builder(model).build());
            RecognitionContext context = RecognitionContext.builder()
                    .setWritingArea(new WritingArea(width, height))
                    .build();
            recognizer.recognize(ink, context)
                    .addOnSuccessListener(result -> sendResult(result, callbackContext))
                    .addOnFailureListener(e -> {
                        Log.e(TAG, "Recognition failed", e);
                        callbackContext.error("AI recognition failed: " + safeMessage(e));
                    });
        } catch (Exception e) {
            Log.e(TAG, "Recognition error", e);
            callbackContext.error("AI recognition error: " + safeMessage(e));
        }
    }

    private void sendResult(RecognitionResult result, CallbackContext callbackContext) {
        try {
            JSONObject out = new JSONObject();
            JSONArray candidates = new JSONArray();
            int limit = Math.min(5, result.getCandidates().size());
            for (int i = 0; i < limit; i++) candidates.put(result.getCandidates().get(i).getText());
            out.put("text", limit > 0 ? result.getCandidates().get(0).getText() : "");
            out.put("candidates", candidates);
            callbackContext.success(out);
        } catch (Exception e) {
            callbackContext.error("AI result error: " + safeMessage(e));
        }
    }

    private String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
