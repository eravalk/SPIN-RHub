package com.spinplayer.app;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

final class YandexCatalog {
 static final String API="https://api.music.yandex.net";
 final Context context;
 YandexCatalog(Context c){context=c;}
 static boolean accepts(String raw){try{URI u=new URI(raw);String h=u.getHost();return "https".equals(u.getScheme())&&u.getUserInfo()==null&&u.getPort()==-1&&Arrays.asList("music.yandex.ru","music.yandex.com","music.yandex.kz","music.yandex.by","music.yandex.uz").contains(h);}catch(Exception e){return false;}}
 static String trackId(String raw)throws Exception{if(!accepts(raw))throw new IOException("Нужна ссылка Яндекс Музыки");java.util.regex.Matcher m=java.util.regex.Pattern.compile("(?:^|/)track/([0-9]+)(?:/|$)").matcher(new URI(raw).getPath());if(!m.find())throw new IOException("Нужна ссылка на песню Яндекс Музыки");return m.group(1);}
 String token(boolean required)throws Exception{String token=MusicConnections.readStored(context,"yandex").optString("token");if(required&&token.isEmpty())throw new IOException("Подключи Яндекс в настройках для прослушивания и скачивания");return token.isEmpty()?null:"OAuth "+token;}
 JSONObject request(String path,boolean required)throws Exception{return ProviderHttp.json(API+path,token(required),null);}
 static String names(JSONArray a){ArrayList<String> names=new ArrayList<>();if(a!=null)for(int i=0;i<a.length();i++){JSONObject v=a.optJSONObject(i);if(v!=null&&!v.optString("name").isEmpty())names.add(v.optString("name"));}return String.join(", ",names);}
 static String cover(String value){if(value.isEmpty())return "";String raw=(value.startsWith("https://")?value:"https://"+value).replace("%%","600x600");try{return ArtworkUrl.allowed(raw);}catch(Exception e){return "";}}
 static JSONObject track(JSONObject t,JSONObject fallbackAlbum)throws Exception{
  JSONArray albums=t.optJSONArray("albums");JSONObject album=albums!=null&&albums.length()>0?albums.optJSONObject(0):fallbackAlbum;if(album==null)album=new JSONObject();
  String id=t.optString("id",t.optString("realId"));if(!id.matches("[0-9]+"))throw new IOException("Некорректная песня в ответе Яндекса");
  JSONObject pos=album.optJSONObject("trackPosition");String title=t.optString("title");if(!t.optString("version").isEmpty())title+=" ("+t.optString("version")+")";
  return new JSONObject().put("kind","track").put("service","Яндекс Музыка").put("name",title).put("artist",names(t.optJSONArray("artists"))).put("album",album.optString("title"))
   .put("year",album.optString("year","")).put("number",pos==null?0:pos.optInt("index")).put("duration",t.optLong("durationMs")/1000.0)
   .put("url","https://music.yandex.ru/track/"+id).put("cover",cover(t.optString("coverUri",album.optString("coverUri"))))
   .put("available",t.optBoolean("available",true));
 }
 JSONArray search(String query,boolean albums)throws Exception{
  JSONObject result=request("/search?text="+ProviderHttp.encode(query)+"&type="+(albums?"album":"track")+"&page=0",false).getJSONObject("result");
  JSONObject group=result.optJSONObject(albums?"albums":"tracks");JSONArray source=group==null?null:group.optJSONArray("results"),out=new JSONArray();
  if(source!=null)for(int i=0;i<source.length();i++){JSONObject t=source.optJSONObject(i);if(t==null)continue;
   if(albums){String id=t.optString("id");if(!id.matches("[0-9]+"))continue;out.put(new JSONObject().put("kind","playlist").put("service","Яндекс Музыка").put("name",t.optString("title")).put("artist",names(t.optJSONArray("artists"))).put("year",t.optString("year")).put("url","https://music.yandex.ru/album/"+id).put("cover",cover(t.optString("coverUri"))));}
   else out.put(track(t,null));
  }return out;
 }
 JSONObject metadata(String url)throws Exception{JSONArray a=request("/tracks/"+trackId(url),false).getJSONArray("result");if(a.length()==0)throw new IOException("Песня не найдена");return track(a.getJSONObject(0),null);}
 JSONObject collection(String url)throws Exception{
  if(!accepts(url))throw new IOException("Нужна ссылка Яндекс Музыки");String path=new URI(url).getPath(),endpoint;
  java.util.regex.Matcher album=java.util.regex.Pattern.compile("^/album/([0-9]+)/?$").matcher(path);
  java.util.regex.Matcher legacy=java.util.regex.Pattern.compile("^/users/([^/]+)/playlists/([0-9]+)/?$").matcher(path);
  java.util.regex.Matcher uuid=java.util.regex.Pattern.compile("^/playlists/([A-Za-z0-9.-]{20,80})/?$").matcher(path);
  boolean isAlbum=album.matches();
  if(isAlbum)endpoint="/albums/"+album.group(1)+"/with-tracks";
  else if(legacy.matches())endpoint="/users/"+ProviderHttp.encode(legacy.group(1))+"/playlists/"+legacy.group(2);
  else if(uuid.matches())endpoint="/playlist/"+uuid.group(1);
  else throw new IOException("Поддерживаются ссылки на альбомы и плейлисты Яндекса");
  JSONObject result=request(endpoint,false).getJSONObject("result");JSONArray out=new JSONArray();boolean limited=false;
  if(isAlbum){JSONArray volumes=result.optJSONArray("volumes");if(volumes!=null)for(int v=0;v<volumes.length();v++){JSONArray items=volumes.optJSONArray(v);if(items==null)continue;for(int i=0;i<items.length();i++){if(out.length()>=500){limited=true;break;}out.put(track(items.getJSONObject(i),result));}}}
  else{JSONArray items=result.optJSONArray("tracks");if(items!=null)for(int i=0;i<items.length();i++){if(out.length()>=500){limited=true;break;}JSONObject t=items.getJSONObject(i);out.put(track(t.optJSONObject("track")==null?t:t.getJSONObject("track"),null));}}
  return new JSONObject().put("name",result.optString("title","Яндекс Музыка")).put("service","Яндекс Музыка").put("cover",cover(result.optString("coverUri"))).put("tracks",out).put("limited",limited).put("limit",500);
 }
 JSONArray formats(String url)throws Exception{
  JSONArray a=request("/tracks/"+trackId(url)+"/download-info",true).getJSONArray("result"),out=new JSONArray();Set<Integer> seen=new HashSet<>();
  for(int i=0;i<a.length();i++){JSONObject f=a.getJSONObject(i);int bitrate=f.optInt("bitrateInKbps");if("mp3".equals(f.optString("codec"))&&bitrate>0&&seen.add(bitrate))out.put(new JSONObject().put("key","mp3:"+bitrate).put("label","MP3 · "+bitrate+" кбит/с"));}
  if(out.length()==0)throw new IOException("Яндекс не вернул доступный MP3 для этого аккаунта и записи");return out;
 }
 static void validateAudioUrl(String raw)throws Exception{
  URI u=new URI(raw);String h=u.getHost();if(!"https".equals(u.getScheme())||u.getUserInfo()!=null||u.getPort()!=-1||h==null)throw new IOException("Некорректная аудиоссылка");
  boolean allowed=false;for(String domain:new String[]{"yandex.net","yandex.ru","yandex.com","yandexmusic.ru"})if(h.equals(domain)||h.endsWith("."+domain))allowed=true;
  if(!allowed)throw new IOException("Неизвестный сервер аудио Яндекса");
 }
 String audio(String url,String format)throws Exception{
  JSONArray a=request("/tracks/"+trackId(url)+"/download-info",true).getJSONArray("result");JSONObject best=null;int wanted=format.startsWith("mp3:")?Integer.parseInt(format.substring(4)):0;
  for(int i=0;i<a.length();i++){JSONObject f=a.getJSONObject(i);if(!"mp3".equals(f.optString("codec")))continue;if(wanted>0&&wanted!=f.optInt("bitrateInKbps"))continue;if(best==null||f.optInt("bitrateInKbps")>best.optInt("bitrateInKbps"))best=f;}
  if(best==null)throw new IOException("Выбранное качество недоступно");String info=best.getString("downloadInfoUrl");validateAudioUrl(info);
  JSONObject data=ProviderHttp.json(info+(info.contains("?")?"&":"?")+"format=json",null,null);
  String path=data.getString("path"),host=data.getString("host"),salt=data.getString("s"),ts=data.getString("ts");if(!path.startsWith("/")||!ts.matches("[0-9A-Fa-f]+"))throw new IOException("Некорректный ответ сервера аудио");
  byte[] digest=MessageDigest.getInstance("MD5").digest(("XGRlBW9FXlekgbPrRHuSiA"+path.substring(1)+salt).getBytes("UTF-8"));StringBuilder sign=new StringBuilder();for(byte b:digest)sign.append(String.format(Locale.ROOT,"%02x",b&255));
  String result="https://"+host+"/get-mp3/"+sign+"/"+ts+path;validateAudioUrl(result);return result;
 }
 File download(JSONObject job,File directory,YtDlpEngine.Events events)throws Exception{
  String url=audio(job.getString("url"),job.optString("formatKey","best"));HttpURLConnection connection=null;
  for(int redirects=0;redirects<=5;redirects++){
   validateAudioUrl(url);connection=NetDownloader.connect(url);connection.setInstanceFollowRedirects(false);int code=connection.getResponseCode();
   if(code>=300&&code<400){String location=connection.getHeaderField("Location");connection.disconnect();connection=null;if(location==null)throw new IOException("Пустое перенаправление");url=new URL(new URL(url),location).toString();continue;}
   if(code!=200){connection.disconnect();throw new IOException("Аудиосервер ответил HTTP "+code);}break;
  }
  if(connection==null)throw new IOException("Слишком много перенаправлений");directory.mkdirs();File file=new File(directory,"audio.mp3");long total=connection.getContentLengthLong(),received=0,begin=System.nanoTime(),last=0;
  try(InputStream input=connection.getInputStream();OutputStream output=new FileOutputStream(file)){
   byte[] buffer=new byte[65536];int n;while((n=input.read(buffer))!=-1){if(events.cancelled())throw new IOException("Отменено");received+=n;if(received>512L*1024*1024)throw new IOException("Файл слишком большой");output.write(buffer,0,n);long now=System.nanoTime();if(now-last>500000000L){events.log("YTDLP_SPIN|downloading|"+received+"|"+total+"|"+(long)(received/Math.max(.001,(now-begin)/1e9))+"|0");last=now;}}
   if(received==0||(total>0&&received!=total))throw new IOException("Аудиофайл получен не полностью");return file;
  }finally{connection.disconnect();}
 }
}
