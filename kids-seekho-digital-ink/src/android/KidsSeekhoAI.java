package com.malaram.kidsseekho.ai;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.vision.digitalink.common.RecognitionResult;
import com.google.mlkit.vision.digitalink.recognition.*;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

public class KidsSeekhoAI extends CordovaPlugin {
    private static final String TAG="KidsSeekhoAI";
    private final Map<String,String> modelState = new HashMap<>();
    private final Map<String,String> modelError = new HashMap<>();

    @Override public boolean execute(String action, JSONArray args, CallbackContext cb) throws JSONException {
        if("isAvailable".equals(action)){ cb.success("true"); return true; }
        if("prepare".equals(action)){ prepareModel(args.optString(0,"en-US"),cb); return true; }
        if("downloadModel".equals(action)){ prepareModel(args.optString(0,"en-US"),cb); return true; }
        if("modelStatus".equals(action)){ modelStatus(args.optString(0,"en-US"),cb); return true; }
        if("recognize".equals(action)){ JSONObject r=args.optJSONObject(0); if(r==null)cb.error("Missing recognition request"); else recognize(r,cb); return true; }
        if("labelImage".equals(action)){ JSONObject r=args.optJSONObject(0); if(r==null)cb.error("Missing image"); else labelImage(r,cb); return true; }
        return false;
    }

    private boolean hasNetwork(){
        try{
            ConnectivityManager cm=(ConnectivityManager)cordova.getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if(cm==null)return false;
            Network n=cm.getActiveNetwork();
            if(n==null)return false;
            NetworkCapabilities c=cm.getNetworkCapabilities(n);
            return c!=null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        }catch(Exception e){return false;}
    }

    private DigitalInkRecognitionModel getModel(String tag, CallbackContext cb){
        try{
            DigitalInkRecognitionModelIdentifier id=DigitalInkRecognitionModelIdentifier.fromLanguageTag(tag);
            if(id==null){cb.error("NO_MODEL: No handwriting model for "+tag);return null;}
            return DigitalInkRecognitionModel.builder(id).build();
        }catch(Exception e){cb.error("MODEL_CREATE_FAILED: "+safe(e));return null;}
    }

    private DownloadConditions downloadConditions(){ return new DownloadConditions.Builder().build(); }

    private synchronized void setState(String tag,String state,String error){
        modelState.put(tag,state);
        if(error==null) modelError.remove(tag); else modelError.put(tag,error);
    }

    private synchronized String getState(String tag){ return modelState.getOrDefault(tag,"idle"); }
    private synchronized String getError(String tag){ return modelError.getOrDefault(tag,""); }

    private void prepareModel(final String tag, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{
            try{
                final DigitalInkRecognitionModel model=getModel(tag,cb); if(model==null)return;
                if(!hasNetwork()){
                    setState(tag,"no_internet","NO_INTERNET: Android reports no active internet connection");
                    cb.error("NO_INTERNET: Android reports no active internet connection");
                    return;
                }
                final RemoteModelManager m=RemoteModelManager.getInstance();
                setState(tag,"checking",null);
                m.isModelDownloaded(model).addOnSuccessListener(ok->{
                    if(Boolean.TRUE.equals(ok)){ setState(tag,"complete",null); ready(cb,tag); return; }
                    setState(tag,"downloading",null);
                    m.download(model,downloadConditions())
                        .addOnSuccessListener(v->{setState(tag,"complete",null);ready(cb,tag);})
                        .addOnFailureListener(e->{String x="MODEL_DOWNLOAD_FAILED: "+safe(e);setState(tag,"failed",x);cb.error(x);});
                }).addOnFailureListener(e->{String x="MODEL_CHECK_FAILED: "+safe(e);setState(tag,"failed",x);cb.error(x);});
            }catch(Exception e){String x="AI_PREP_FAILED: "+safe(e);setState(tag,"failed",x);cb.error(x);}
        });
    }

    private void modelStatus(final String tag, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{
            try{
                DigitalInkRecognitionModel model=getModel(tag,cb); if(model==null)return;
                String state=getState(tag);
                JSONObject o=new JSONObject();
                o.put("language",tag);
                o.put("network",hasNetwork());
                o.put("state",state);
                o.put("progress",-1);
                o.put("downloadedBytes",0);
                o.put("totalBytes",0);
                String err=getError(tag); if(!err.isEmpty())o.put("detail",err);
                RemoteModelManager.getInstance().isModelDownloaded(model).addOnSuccessListener(downloaded->{
                    try{
                        JSONObject x=new JSONObject(o.toString());
                        if(Boolean.TRUE.equals(downloaded)){
                            setState(tag,"complete",null);
                            x.put("state","complete");x.put("downloaded",true);x.put("progress",100);
                        }else{
                            x.put("downloaded",false);
                            String s=getState(tag);
                            x.put("state",s);
                            if("idle".equals(s)||"checking".equals(s))x.put("state",hasNetwork()?"ready-to-download":"no_internet");
                            String er=getError(tag);if(!er.isEmpty())x.put("detail",er);
                        }
                        cb.success(x);
                    }catch(Exception e){cb.error("MODEL_STATUS_FAILED: "+safe(e));}
                }).addOnFailureListener(e->cb.error("MODEL_CHECK_FAILED: "+safe(e)));
            }catch(Exception e){cb.error("MODEL_STATUS_ERROR: "+safe(e));}
        });
    }

    private void ready(CallbackContext cb,String tag){
        try{JSONObject o=new JSONObject();o.put("ready",true);o.put("language",tag);o.put("network",hasNetwork());o.put("progress",100);cb.success(o);}catch(Exception e){cb.success("ready");}
    }

    private void recognize(final JSONObject req, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{try{
            String tag=req.optString("languageTag","en-US"); JSONArray strokes=req.optJSONArray("strokes");
            if(strokes==null||strokes.length()==0){cb.error("No handwriting strokes");return;}
            final DigitalInkRecognitionModel model=getModel(tag,cb); if(model==null)return;
            if(!hasNetwork()){cb.error("NO_INTERNET: Android reports no active internet connection");return;}
            RemoteModelManager.getInstance().isModelDownloaded(model).addOnSuccessListener(ok->{
                if(Boolean.TRUE.equals(ok))runRecognition(model,req,cb);
                else RemoteModelManager.getInstance().download(model,downloadConditions()).addOnSuccessListener(v->runRecognition(model,req,cb)).addOnFailureListener(e->cb.error("MODEL_DOWNLOAD_FAILED: "+safe(e)));
            }).addOnFailureListener(e->cb.error("MODEL_CHECK_FAILED: "+safe(e)));
        }catch(Exception e){cb.error("AI_SETUP_FAILED: "+safe(e));}});
    }

    private void runRecognition(DigitalInkRecognitionModel model,JSONObject req,CallbackContext cb){try{
        JSONArray strokes=req.optJSONArray("strokes"); Ink.Builder ib=Ink.builder();
        for(int i=0;i<strokes.length();i++){JSONArray ps=strokes.getJSONObject(i).optJSONArray("points");if(ps==null)continue;Ink.Stroke.Builder sb=Ink.Stroke.builder();for(int j=0;j<ps.length();j++){JSONObject p=ps.getJSONObject(j);sb.addPoint(Ink.Point.create((float)p.optDouble("x"),(float)p.optDouble("y"),p.optLong("t",System.currentTimeMillis())));}ib.addStroke(sb.build());}
        RecognitionContext rc=RecognitionContext.builder().setWritingArea(new WritingArea((float)req.optDouble("width",1),(float)req.optDouble("height",1))).build();
        DigitalInkRecognizer r=DigitalInkRecognition.getClient(DigitalInkRecognizerOptions.builder(model).build());
        r.recognize(ib.build(),rc).addOnSuccessListener(x->sendResult(x,cb)).addOnFailureListener(e->cb.error("AI_RECOGNITION_FAILED: "+safe(e)));
    }catch(Exception e){cb.error("AI_RECOGNITION_ERROR: "+safe(e));}}

    private void sendResult(RecognitionResult r,CallbackContext cb){try{JSONObject o=new JSONObject();JSONArray a=new JSONArray();int n=Math.min(8,r.getCandidates().size());for(int i=0;i<n;i++)a.put(r.getCandidates().get(i).getText());o.put("text",n>0?r.getCandidates().get(0).getText():"");o.put("candidates",a);cb.success(o);}catch(Exception e){cb.error("AI_RESULT_ERROR: "+safe(e));}}

    private void labelImage(final JSONObject req, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{try{
            String b64=req.optString("base64",""); if(b64.isEmpty()){cb.error("Empty image");return;} if(b64.contains(","))b64=b64.substring(b64.indexOf(',')+1);
            byte[] bytes=Base64.decode(b64,Base64.DEFAULT); Bitmap bm=BitmapFactory.decodeByteArray(bytes,0,bytes.length); if(bm==null){cb.error("Invalid image");return;}
            InputImage image=InputImage.fromBitmap(bm,0); ImageLabeler labeler=ImageLabeling.getClient(new ImageLabelerOptions.Builder().setConfidenceThreshold(.45f).build());
            labeler.process(image).addOnSuccessListener(labels->{try{JSONArray a=new JSONArray();for(ImageLabel l:labels){JSONObject x=new JSONObject();x.put("label",l.getText());x.put("confidence",l.getConfidence());x.put("index",l.getIndex());a.put(x);}JSONObject out=new JSONObject();out.put("labels",a);cb.success(out);}catch(Exception e){cb.error("Label result error: "+safe(e));}}).addOnFailureListener(e->cb.error("Image AI failed: "+safe(e)));
        }catch(Exception e){Log.e(TAG,"Image labeling",e);cb.error("Image AI error: "+safe(e));}});
    }

    private String safe(Exception e){return e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();}
}
