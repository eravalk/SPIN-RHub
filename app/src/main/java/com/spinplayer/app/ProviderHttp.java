package com.spinplayer.app;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class ProviderHttp {
 static String encode(String s)throws Exception { return URLEncoder.encode(s,"UTF-8"); }
 static String text(String url,String auth,String body)throws Exception {
  URL target=new URL(url);
  if(!"https".equals(target.getProtocol()))throw new IOException("Нужна HTTPS-ссылка");
  String host=target.getHost();
  if(auth!=null&&!host.equals("api.music.yandex.net")&&!host.equals("api.spotify.com")&&!host.equals("accounts.spotify.com"))throw new IOException("Недопустимый адрес API");
  HttpURLConnection c=NetDownloader.connect(url);
  try{
   c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json");
   if(auth!=null)c.setRequestProperty("Authorization",auth);
   if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/x-www-form-urlencoded");try(OutputStream out=c.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}}
   int code=c.getResponseCode();
   if(code==401)throw new IOException("Сервис отклонил доступ. Подключи аккаунт заново.");
   if(code==403)throw new IOException("Сервис не разрешил доступ к записи или каталогу для этого аккаунта.");
   if(code==429)throw new IOException("Слишком много запросов. Попробуй немного позже.");
   if(code<200||code>=300)throw new IOException("Сервис ответил HTTP "+code);
   try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buf=new byte[16384];int n;while((n=in.read(buf))!=-1){if(out.size()+n>6*1024*1024)throw new IOException("Ответ каталога слишком большой");out.write(buf,0,n);}return new String(out.toByteArray(),StandardCharsets.UTF_8);
   }
  }finally{c.disconnect();}
 }
 static JSONObject json(String url,String auth,String body)throws Exception{try{return new JSONObject(text(url,auth,body));}catch(org.json.JSONException e){throw new IOException("Сервис вернул неожиданный ответ каталога");}}
}
