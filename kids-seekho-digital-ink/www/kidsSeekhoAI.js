var exec=require('cordova/exec');
module.exports={
 prepare:function(tag,ok,fail){exec(ok,fail,'KidsSeekhoAI','prepare',[tag||'en-US']);},
 downloadModel:function(tag,ok,fail){exec(ok,fail,'KidsSeekhoAI','downloadModel',[tag||'en-US']);},
 modelStatus:function(tag,ok,fail){exec(ok,fail,'KidsSeekhoAI','modelStatus',[tag||'en-US']);},
 recognize:function(strokes,tag,w,h,ok,fail){exec(ok,fail,'KidsSeekhoAI','recognize',[{strokes:strokes||[],languageTag:tag||'en-US',width:Number(w)||1,height:Number(h)||1}]);},
 labelImage:function(base64,ok,fail){exec(ok,fail,'KidsSeekhoAI','labelImage',[{base64:base64||''}]);},
 isAvailable:function(ok,fail){exec(ok,fail,'KidsSeekhoAI','isAvailable',[])}
};
