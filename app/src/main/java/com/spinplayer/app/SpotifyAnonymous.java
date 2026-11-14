package com.spinplayer.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.json.*;

/** Dedicated anonymous catalog session. Never reads a user's browser/account session. */
final class SpotifyAnonymous {
 static final String PAGE="https://open.spotify.com/",ENDPOINT="https://api-partner.spotify.com/pathfinder/v1/query";
 static final String UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
 static final String SECRET_LIST="https://code.thetadev.de/ThetaDev/spotify-secrets/raw/branch/main/secrets/secretDict.json";
 final Context context;
 final Handler main=new Handler(Looper.getMainLooper());
 final ConcurrentHashMap<String,CompletableFuture<JSONObject>> pending=new ConcurrentHashMap<>();
 WebView transport;
 CompletableFuture<WebView> viewReady;
 volatile boolean closed;
 String access="",clientToken="",clientVersion="",device="";
 long expires;
 SpotifyAnonymous(Context c){context=c.getApplicationContext();}
 static String read(InputStream input,int limit)throws Exception{
  try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Ответ каталога слишком большой");out.write(b,0,n);}return out.toString("UTF-8");
  }
 }
 static HttpURLConnection connection(String url)throws Exception{
  URI u=new URI(url);String host=u.getHost();
  if(!"https".equals(u.getScheme())||u.getUserInfo()!=null||u.getPort()!=-1||!Arrays.asList("open.spotify.com","clienttoken.spotify.com","api-partner.spotify.com","code.thetadev.de").contains(host))throw new IOException("Неверный адрес каталога");
  HttpURLConnection c=NetDownloader.connect(url);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent",UA);c.setRequestProperty("Accept","application/json");return c;
 }
 static JSONObject jsonResponse(HttpURLConnection c)throws Exception{
  int status=c.getResponseCode();if(status<200||status>=300)throw new IOException("Каталог Spotify ответил HTTP "+status);
  try{return new JSONObject(read(c.getInputStream(),6*1024*1024));}catch(JSONException e){throw new IOException("Неожиданный ответ каталога Spotify");}
 }
 static String totp(int[] bytes,long time)throws Exception{
  if(bytes.length<1||bytes.length>256)throw new IOException("Неверные параметры каталога");StringBuilder key=new StringBuilder();
  for(int i=0;i<bytes.length;i++){if(bytes[i]<0||bytes[i]>255)throw new IOException("Неверные параметры каталога");key.append(bytes[i]^((i%33)+9));}
  long counter=time/1000/30;byte[] message=new byte[8];for(int i=0;i<8;i++)message[i]=(byte)(counter>>>(56-i*8));
  Mac mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec(key.toString().getBytes(StandardCharsets.US_ASCII),"HmacSHA1"));byte[] hash=mac.doFinal(message);int offset=hash[hash.length-1]&15;
  int value=((hash[offset]&127)<<24)|((hash[offset+1]&255)<<16)|((hash[offset+2]&255)<<8)|(hash[offset+3]&255);
  return String.format(Locale.ROOT,"%06d",value%1000000);
 }
 synchronized void session(boolean force)throws Exception{
  if(closed)throw new IOException("Каталог закрыт");if(!force&&!access.isEmpty()&&expires>System.currentTimeMillis()+60000)return;
  access="";clientToken="";device="";
  HttpURLConnection page=connection(PAGE);String html;
  try{if(page.getResponseCode()!=200)throw new IOException("Не удалось открыть каталог Spotify");html=read(page.getInputStream(),6*1024*1024);
   for(Map.Entry<String,List<String>> h:page.getHeaderFields().entrySet())if(h.getKey()!=null&&h.getKey().equalsIgnoreCase("Set-Cookie"))for(String value:h.getValue()){
    Matcher m=Pattern.compile("(?:^|;\\s*)sp_t=([A-Za-z0-9_-]{1,256})").matcher(value);if(m.find())device=m.group(1);
   }
  }finally{page.disconnect();}
  Matcher config=Pattern.compile("<script\\s+id=\"appServerConfig\"\\s+type=\"text/plain\">([^<]+)</script>").matcher(html);
  if(!config.find())throw new IOException("Spotify изменил формат каталога. Можно использовать подключение Developer или публичную ссылку.");
  clientVersion=new JSONObject(new String(android.util.Base64.decode(config.group(1),android.util.Base64.DEFAULT),StandardCharsets.UTF_8)).optString("clientVersion");
  if(clientVersion.isEmpty())throw new IOException("Spotify не сообщил версию каталога");
  int version=61;int[] bytes={44,55,47,42,70,40,34,114,76,74,50,111,120,97,75,76,94,102,43,69,49,120,118,80,64,78};
  HttpURLConnection list=null;try{list=connection(SECRET_LIST);if(list.getResponseCode()==200){JSONObject values=new JSONObject(read(list.getInputStream(),65536));int best=0;Iterator<String> keys=values.keys();while(keys.hasNext()){String k=keys.next();if(k.matches("[0-9]{1,6}"))best=Math.max(best,Integer.parseInt(k));}JSONArray a=values.getJSONArray(String.valueOf(best));if(a.length()<1||a.length()>256)throw new IOException();int[] fresh=new int[a.length()];for(int i=0;i<a.length();i++){fresh[i]=a.getInt(i);if(fresh[i]<0||fresh[i]>255)throw new IOException();}version=best;bytes=fresh;}}catch(Exception ignored){}finally{if(list!=null)list.disconnect();}
  String code=totp(bytes,System.currentTimeMillis());HttpURLConnection token=connection(PAGE+"api/token?reason=init&productType=web-player&totp="+code+"&totpVer="+version+"&totpServer="+code);
  JSONObject result;
  try{token.setRequestProperty("Referer",PAGE);if(!device.isEmpty())token.setRequestProperty("Cookie","sp_t="+device);result=jsonResponse(token);}finally{token.disconnect();}
  if(!result.optBoolean("isAnonymous",false))throw new IOException("Spotify не подтвердил анонимную сессию");
  access=result.optString("accessToken");String client=result.optString("clientId");expires=result.optLong("accessTokenExpirationTimestampMs",System.currentTimeMillis()+600000);
  if(access.isEmpty()||client.isEmpty())throw new IOException("Spotify не предоставил доступ к публичному каталогу");
  HttpURLConnection clientConnection=null;
  try{clientConnection=connection("https://clienttoken.spotify.com/v1/clienttoken");clientConnection.setRequestMethod("POST");clientConnection.setDoOutput(true);clientConnection.setRequestProperty("Content-Type","application/json");
   JSONObject payload=new JSONObject().put("client_data",new JSONObject().put("client_version",clientVersion).put("client_id",client).put("js_sdk_data",new JSONObject().put("device_brand","unknown").put("device_model","unknown").put("os","windows").put("os_version","NT 10.0").put("device_id",device).put("device_type","computer")));
   try(OutputStream out=clientConnection.getOutputStream()){out.write(payload.toString().getBytes(StandardCharsets.UTF_8));}
   JSONObject granted=jsonResponse(clientConnection).optJSONObject("granted_token");if(granted!=null)clientToken=granted.optString("token");
  }catch(Exception ignored){}finally{if(clientConnection!=null)clientConnection.disconnect();}
 }
 JSONObject query(String operation,JSONObject variables)throws Exception{
  Map<String,String> hashes=new HashMap<>();hashes.put("searchDesktop","eef7cc54888d91bdd6802623477873caa3948ae173a0c34fd86827b267e94c03");hashes.put("getTrack","fe16b8083eec2305854db612ca75589bcb71e009dc7a4d014f29bd534a4c01f5");hashes.put("getAlbum","0b6ce3511e1b02e4a40fa95440f992acbe85080eb308af9194322d708fc1914f");hashes.put("fetchPlaylist","21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf");
  if(!hashes.containsKey(operation))throw new IOException("Неизвестная операция Spotify");
  for(int attempt=0;attempt<2;attempt++){
   if(Thread.currentThread().isInterrupted())throw new InterruptedException();session(attempt>0);String url=ENDPOINT+"?operationName="+operation+"&variables="+ProviderHttp.encode(variables.toString())+"&extensions="+ProviderHttp.encode(new JSONObject().put("persistedQuery",new JSONObject().put("version",1).put("sha256Hash",hashes.get(operation))).toString());
   JSONObject headers=new JSONObject().put("Authorization","Bearer "+access).put("Spotify-App-Version",clientVersion).put("App-Platform","WebPlayer").put("Accept","application/json").put("Accept-Language","en");if(!clientToken.isEmpty())headers.put("Client-Token",clientToken);
   JSONObject response;
   try{response=webFetch(url,headers);if(response.optInt("status")==0)response=nativeFetch(url,headers);}catch(Exception e){if(e instanceof InterruptedException||Thread.currentThread().isInterrupted())throw e;response=nativeFetch(url,headers);}
   int status=response.optInt("status");if((status==400||status==401||status==403)&&attempt==0)continue;
   if(status!=200)throw new IOException("Каталог Spotify ответил HTTP "+status+". Попробуй позже или открой публичную ссылку.");
   JSONObject data=new JSONObject(response.getString("body"));if(data.has("errors"))throw new IOException("Spotify изменил каталог или ограничил запрос. Попробуй подключение Developer.");return data;
  }throw new IOException("Не удалось подключиться к публичному каталогу Spotify");
 }
 JSONObject nativeFetch(String url,JSONObject headers)throws Exception{
  HttpURLConnection c=connection(url);try{Iterator<String> names=headers.keys();while(names.hasNext()){String key=names.next();c.setRequestProperty(key,headers.getString(key));}c.setRequestProperty("Origin","https://open.spotify.com");c.setRequestProperty("Referer",PAGE);int code=c.getResponseCode();String body=code==200?read(c.getInputStream(),6*1024*1024):"";return new JSONObject().put("status",code).put("body",body);}finally{c.disconnect();}
 }
 JSONObject webFetch(String url,JSONObject headers)throws Exception{
  if(!url.startsWith(ENDPOINT+"?"))throw new IOException("Неверный запрос каталога");
  CompletableFuture<WebView> ready;
  synchronized(this){if(viewReady==null){viewReady=new CompletableFuture<>();main.post(()->{
    try{if(closed)throw new IOException();transport=new WebView(context);WebSettings settings=transport.getSettings();settings.setJavaScriptEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setDomStorageEnabled(false);settings.setUserAgentString(UA);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
     transport.addJavascriptInterface(new ResponseBridge(),"SpinCatalogResponse");transport.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return true;}@Override public void onPageFinished(WebView v,String address){if(!closed)viewReady.complete(v);}});
     transport.loadDataWithBaseURL(PAGE,"<!doctype html><meta charset=utf-8><title>SPIN catalog transport</title>","text/html","UTF-8",null);
    }catch(Exception e){viewReady.completeExceptionally(new IOException("WebView каталога недоступен"));}
   });}ready=viewReady;}
  WebView view=ready.get(25,TimeUnit.SECONDS);String id=UUID.randomUUID().toString();CompletableFuture<JSONObject> answer=new CompletableFuture<>();if(pending.size()>8)throw new IOException("Слишком много запросов каталога");pending.put(id,answer);
  String script="(async()=>{const id="+JSONObject.quote(id)+";try{const c=new AbortController();const t=setTimeout(()=>c.abort(),25000);try{const r=await fetch("+JSONObject.quote(url)+",{headers:"+headers+",credentials:'omit',signal:c.signal});const body=await r.text();SpinCatalogResponse.result(id,r.status,body);}finally{clearTimeout(t);}}catch(e){SpinCatalogResponse.result(id,0,'');}})()";
  main.post(()->{if(!closed)view.evaluateJavascript(script,null);else answer.completeExceptionally(new IOException("Каталог закрыт"));});
  try{return answer.get(30,TimeUnit.SECONDS);}finally{pending.remove(id);}
 }
 final class ResponseBridge {
  @JavascriptInterface public void result(String id,int status,String body){CompletableFuture<JSONObject> answer=pending.remove(id);if(answer==null)return;try{if(body.length()>6*1024*1024)throw new IOException();answer.complete(new JSONObject().put("status",status).put("body",body));}catch(Exception e){answer.completeExceptionally(new IOException("Некорректный ответ каталога"));}}
 }
 void close(){closed=true;if(viewReady!=null)viewReady.completeExceptionally(new IOException("Каталог закрыт"));access="";clientToken="";for(CompletableFuture<JSONObject> f:pending.values())f.completeExceptionally(new IOException("Каталог закрыт"));pending.clear();main.post(()->{if(transport!=null){transport.removeJavascriptInterface("SpinCatalogResponse");transport.destroy();transport=null;}});}
}
