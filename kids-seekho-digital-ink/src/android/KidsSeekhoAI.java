package com.malaram.kidsseekho.ai;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
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

public class KidsSeekhoAI extends CordovaPlugin {
    private static final String TAG="KidsSeekhoAI";
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
        try{ DigitalInkRecognitionModelIdentifier id=DigitalInkRecognitionModelIdentifier.fromLanguageTag(tag); if(id==null){cb.error("No handwriting model for "+tag);return null;} return DigitalInkRecognitionModel.builder(id).build(); }
        catch(Exception e){cb.error("No handwriting model for "+tag+": "+safe(e));return null;}
    }
    private DownloadConditions downloadConditions(){ return new DownloadConditions.Builder().build(); }
    private void prepareModel(final String tag, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{try{
            final DigitalInkRecognitionModel model=getModel(tag,cb); if(model==null)return;
            if(!hasNetwork()){cb.error("NO_INTERNET: Android reports no active internet connection");return;}
            final RemoteModelManager m=RemoteModelManager.getInstance();
            m.isModelDownloaded(model).addOnSuccessListener(ok->{if(Boolean.TRUE.equals(ok)){ready(cb,tag);return;}
                m.download(model,downloadConditions()).addOnSuccessListener(v->ready(cb,tag)).addOnFailureListener(e->cb.error("MODEL_DOWNLOAD_FAILED: "+safe(e)));
            }).addOnFailureListener(e->cb.error("MODEL_CHECK_FAILED: "+safe(e)));
        }catch(Exception e){cb.error("AI_PREP_FAILED: "+safe(e));}});
    }
    private void modelStatus(final String tag, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{try{
            DigitalInkRecognitionModel model=getModel(tag,cb); if(model==null)return;
            RemoteModelManager.getInstance().isModelDownloaded(model).addOnSuccessListener(downloaded->{
                try{
                    JSONObject o=new JSONObject();
                    o.put("language",tag); o.put("network",hasNetwork()); o.put("downloaded",Boolean.TRUE.equals(downloaded));
                    if(Boolean.TRUE.equals(downloaded)){o.put("state","complete");o.put("progress",100);o.put("downloadedBytes",0);o.put("totalBytes",0);cb.success(o);return;}
                    JSONObject dm=queryDownloadManager(tag);
                    o.put("state",dm.optString("state","waiting"));
                    o.put("progress",dm.optInt("progress",-1));
                    o.put("downloadedBytes",dm.optLong("downloadedBytes",0));
                    o.put("totalBytes",dm.optLong("totalBytes",0));
                    o.put("detail",dm.optString("detail","ML Kit download task is active or waiting"));
                    cb.success(o);
                }catch(Exception e){cb.error("MODEL_STATUS_FAILED: "+safe(e));}
            }).addOnFailureListener(e->cb.error("MODEL_CHECK_FAILED: "+safe(e)));
        }catch(Exception e){cb.error("MODEL_STATUS_ERROR: "+safe(e));}});
    }
    private JSONObject queryDownloadManager(String tag){
        JSONObject out=new JSONObject(); Cursor c=null;
        try{
            DownloadManager dm=(DownloadManager)cordova.getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if(dm==null){out.put("state","waiting");return out;}
            DownloadManager.Query q=new DownloadManager.Query().setFilterByStatus(
                DownloadManager.STATUS_PENDING|DownloadManager.STATUS_RUNNING|DownloadManager.STATUS_PAUSED|DownloadManager.STATUS_SUCCESSFUL|DownloadManager.STATUS_FAILED);
            c=dm.query(q);
            String low=tag.toLowerCase().replace('-','_'); String lang=tag.toLowerCase().split("-")[0];
            long bestTime=-1; int bestStatus=-1; long bestBytes=0,bestTotal=-1; String bestTitle="";
            while(c!=null && c.moveToNext()){
                String title=getString(c,DownloadManager.COLUMN_TITLE).toLowerCase();
                String uri=getString(c,DownloadManager.COLUMN_URI).toLowerCase();
                String desc=getString(c,DownloadManager.COLUMN_DESCRIPTION).toLowerCase();
                boolean match=(title.contains(low)||uri.contains(low)||desc.contains(low)||title.contains(lang)||uri.contains("/"+lang+"_")||uri.contains("_"+lang+"."));
                if(!match)continue;
                long modified=getLong(c,DownloadManager.COLUMN_LAST_MODIFIED_TIMESTAMP);
                if(modified>=bestTime){
                    bestTime=modified; bestStatus=getInt(c,DownloadManager.COLUMN_STATUS); bestBytes=getLong(c,DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR); bestTotal=getLong(c,DownloadManager.COLUMN_TOTAL_SIZE_BYTES); bestTitle=title;
                }
            }
            if(bestStatus<0){out.put("state","waiting");out.put("progress",-1);return out;}
            out.put("downloadedBytes",bestBytes);out.put("totalBytes",bestTotal);out.put("title",bestTitle);
            if(bestTotal>0)out.put("progress",Math.max(0,Math.min(99,(int)((bestBytes*100L)/bestTotal)))); else out.put("progress",-1);
            if(bestStatus==DownloadManager.STATUS_RUNNING)out.put("state","downloading");
            else if(bestStatus==DownloadManager.STATUS_PENDING)out.put("state","pending");
            else if(bestStatus==DownloadManager.STATUS_PAUSED)out.put("state","paused");
            else if(bestStatus==DownloadManager.STATUS_SUCCESSFUL)out.put("state","downloaded-awaiting-MLKit");
            else out.put("state","failed");
            return out;
        }catch(Exception e){try{out.put("state","unknown");out.put("detail",safe(e));out.put("progress",-1);}catch(Exception ignored){}return out;}
        finally{if(c!=null)c.close();}
    }
    private String getString(Cursor c,String col){int i=c.getColumnIndex(col);return i>=0&& !c.isNull(i)?c.getString(i):"";}
    private long getLong(Cursor c,String col){int i=c.getColumnIndex(col);return i>=0&&!c.isNull(i)?c.getLong(i):0;}
    private int getInt(Cursor c,String col){int i=c.getColumnIndex(col);return i>=0&&!c.isNull(i)?c.getInt(i):-1;}
    private void ready(CallbackContext cb,String tag){try{JSONObject o=new JSONObject();o.put("ready",true);o.put("language",tag);o.put("network",true);cb.success(o);}catch(Exception e){cb.success("ready");}}
    private void recognize(final JSONObject req, final CallbackContext cb){
        cordova.getThreadPool().execute(()->{try{
            String tag=req.optString("languageTag","en-US"); JSONArray strokes=req.optJSONArray("strokes"); if(strokes==null||strokes.length()==0){cb.error("No handwriting strokes");return;}
            final DigitalInkRecognitionModel model=getModel(tag,cb); if(model==null)return;
            if(!hasNetwork()){cb.error("NO_INTERNET: Android reports no active internet connection");return;}
            RemoteModelManager.getInstance().isModelDownloaded(model).addOnSuccessListener(ok->{if(Boolean.TRUE.equals(ok))runRecognition(model,req,cb);else RemoteModelManager.getInstance().download(model,downloadConditions()).addOnSuccessListener(v->runRecognition(model,req,cb)).addOnFailureListener(e->cb.error("MODEL_DOWNLOAD_FAILED: "+safe(e)));}).addOnFailureListener(e->cb.error("MODEL_CHECK_FAILED: "+safe(e)));
        }catch(Exception e){cb.error("AI_SETUP_FAILED: "+safe(e));}});
    }
    private void runRecognition(DigitalInkRecognitionModel model,JSONObject req,CallbackContext cb){try{
        JSONArray strokes=req.optJSONArray("strokes"); Ink.Builder ib=Ink.builder();
        for(int i=0;i<strokes.length();i++){JSONArray ps=strokes.getJSONObject(i).optJSONArray("points");if(ps==null)continue;Ink.Stroke.Builder sb=Ink.Stroke.builder();for(int j=0;j<ps.length();j++){JSONObject p=ps.getJSONObject(j);sb.addPoint(Ink.Point.create((float)p.optDouble("x"), (float)p.optDouble("y"),p.optLong("t",System.currentTimeMillis())));}ib.addStroke(sb.build());}
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
