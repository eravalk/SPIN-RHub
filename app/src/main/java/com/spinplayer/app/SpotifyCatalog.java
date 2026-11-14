package com.spinplayer.app;

import java.io.IOException;
import java.net.URI;
import java.util.*;
import org.json.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;

/** Spotify supplies catalog metadata. Full audio is explicitly matched on YouTube Music. */
final class SpotifyCatalog {
 final MusicConnections connections;
 SpotifyCatalog(MusicConnections c){connections=c;}
 static boolean accepts(String raw){try{URI u=new URI(raw);return "https".equals(u.getScheme())&&"open.spotify.com".equals(u.getHost())&&u.getUserInfo()==null&&u.getPort()==-1;}catch(Exception e){return false;}}
 static String[] parts(String raw)throws Exception{
  if(!accepts(raw))throw new IOException("Нужна полная HTTPS-ссылка open.spotify.com");
  String path=new URI(raw).getPath().replaceFirst("^/intl-[A-Za-z-]+/","/");
  java.util.regex.Matcher m=java.util.regex.Pattern.compile("^/(track|album|playlist)/([A-Za-z0-9]{22})/?$").matcher(path);
  if(!m.matches())throw new IOException("Поддерживаются ссылки Spotify на трек, альбом или плейлист");return new String[]{m.group(1),m.group(2)};
 }
 static String image(JSONObject value){JSONArray images=value.optJSONArray("images");if(images==null){JSONObject v=value.optJSONObject("visualIdentity");images=v==null?null:v.optJSONArray("image");}if(images!=null)for(int i=images.length()-1;i>=0;i--)try{return ArtworkUrl.allowed(images.getJSONObject(i).getString("url"));}catch(Exception ignored){}return "";}
 static String artists(JSONArray a){ArrayList<String> values=new ArrayList<>();if(a!=null)for(int i=0;i<a.length();i++){JSONObject o=a.optJSONObject(i);if(o!=null&&!o.optString("name").isEmpty())values.add(o.optString("name"));}return String.join(", ",values);}
 static JSONObject apiTrack(JSONObject t,JSONObject fallback)throws Exception{
  JSONObject album=t.optJSONObject("album");if(album==null)album=fallback==null?new JSONObject():fallback;
  return new JSONObject().put("kind","track").put("service","Spotify").put("name",t.optString("name")).put("artist",artists(t.optJSONArray("artists")))
   .put("duration",t.optLong("duration_ms")/1000.0).put("album",album.optString("name")).put("year",album.optString("release_date")).put("number",t.optInt("track_number"))
   .put("url","https://open.spotify.com/track/"+t.getString("id")).put("cover",image(album));
 }
 JSONObject api(String path)throws Exception{
  String url=path.startsWith("https://")?path:"https://api.spotify.com/v1/"+path;
  if(!url.startsWith("https://api.spotify.com/v1/"))throw new IOException("Неверная страница каталога Spotify");
  return ProviderHttp.json(url,"Bearer "+connections.spotifyToken(),null);
 }
 JSONArray search(String query,boolean albums)throws Exception{
  if(connections.read("spotify").optString("client_id").isEmpty())return new SpotifyWebCatalog(connections.anonymous).search(query,albums);
  JSONObject result=api("search?q="+ProviderHttp.encode(query)+"&type="+(albums?"album":"track")+"&limit=10");
  JSONArray items=result.getJSONObject(albums?"albums":"tracks").getJSONArray("items"),out=new JSONArray();
  for(int i=0;i<items.length();i++){JSONObject t=items.optJSONObject(i);if(t==null)continue;
   if(albums)out.put(new JSONObject().put("kind","playlist").put("service","Spotify").put("name",t.optString("name")).put("artist",artists(t.optJSONArray("artists"))).put("cover",image(t)).put("url","https://open.spotify.com/album/"+t.getString("id")));
   else out.put(apiTrack(t,null));
  }return out;
 }
 static JSONObject embedEntity(String html)throws Exception{
  Element data=Jsoup.parse(html).getElementById("__NEXT_DATA__");if(data==null)throw new IOException("Spotify изменил публичную страницу. Подключи каталог в настройках.");
  return new JSONObject(data.data()).getJSONObject("props").getJSONObject("pageProps").getJSONObject("state").getJSONObject("data").getJSONObject("entity");
 }
 JSONObject embed(String[] path)throws Exception{return embedEntity(ProviderHttp.text("https://open.spotify.com/embed/"+path[0]+"/"+path[1],null,null));}
 static JSONObject embedTrack(JSONObject t,String cover,String album)throws Exception{
  String uri=t.optString("uri");if(!uri.matches("spotify:track:[A-Za-z0-9]{22}"))throw new IOException("Spotify не вернул идентификатор песни");
  String artist=t.optString("subtitle");if(artist.isEmpty())artist=artists(t.optJSONArray("artists"));
  return new JSONObject().put("kind","track").put("service","Spotify").put("name",t.optString("title",t.optString("name"))).put("artist",artist)
   .put("duration",t.optDouble("duration")/1000).put("url","https://open.spotify.com/track/"+uri.substring("spotify:track:".length())).put("cover",cover).put("album",album);
 }
 JSONObject metadata(String url)throws Exception{
  String[] p=parts(url);if(!p[0].equals("track"))throw new IOException("Нужна ссылка на песню Spotify");
  if(!connections.read("spotify").optString("client_id").isEmpty())return apiTrack(api("tracks/"+p[1]),null);
  try{return new SpotifyWebCatalog(connections.anonymous).metadata(url);}catch(Exception unavailable){if(Thread.currentThread().isInterrupted())throw unavailable;/* A public link can still be read if the catalog backend is temporarily unavailable. */}
  JSONObject e=embed(p);return embedTrack(e,image(e),"");
 }
 JSONObject collection(String url)throws Exception{
  if(connections.read("spotify").optString("client_id").isEmpty())try{return new SpotifyWebCatalog(connections.anonymous).collection(url);}catch(Exception unavailable){if(Thread.currentThread().isInterrupted())throw unavailable;/* Keep public-link fallback. */}
  String[] p=parts(url);if(p[0].equals("track"))throw new IOException("Нужна ссылка на альбом или плейлист Spotify");
  JSONArray tracks=new JSONArray();JSONObject data;boolean limited=false;
  if(!connections.read("spotify").optString("client_id").isEmpty()&&p[0].equals("album")){
   data=api("albums/"+p[1]);JSONObject group=data.getJSONObject("tracks");
   while(true){JSONArray items=group.getJSONArray("items");for(int i=0;i<items.length()&&tracks.length()<500;i++)tracks.put(apiTrack(items.getJSONObject(i),data));String next=group.optString("next");if(next.isEmpty()||next.equals("null"))break;if(tracks.length()>=500){limited=true;break;}group=api(next);}
  }else{
   data=embed(p);JSONArray items=data.optJSONArray("trackList");if(items==null)throw new IOException("Spotify не открыл список песен. Попробуй подключить каталог.");
   String cover=image(data);for(int i=0;i<items.length()&&i<500;i++)tracks.put(embedTrack(items.getJSONObject(i),cover,data.optString("title",data.optString("name"))));
   limited=true;
  }
  return new JSONObject().put("name",data.optString("name",data.optString("title","Spotify"))).put("service","Spotify").put("cover",image(data)).put("tracks",tracks).put("limited",limited)
   .put("note",limited?"Состав получен с публичной страницы Spotify и может быть неполным. Аудио подбирается на YouTube Music.":"Аудио каждой песни подбирается на YouTube Music.");
 }
 static Set<String> words(String value){Set<String> result=new HashSet<>();for(String s:value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+"," ").trim().split(" +"))if(!s.isEmpty()&&!Arrays.asList("official","audio","video","lyrics","topic").contains(s))result.add(s);return result;}
 static double overlap(String a,String b){Set<String>x=words(a),y=words(b);if(x.isEmpty())return 0;Set<String>copy=new HashSet<>(x);copy.retainAll(y);return (double)copy.size()/x.size();}
 static double score(JSONObject wanted,JSONObject candidate){
  String name=wanted.optString("name"),found=candidate.optString("name");
  for(String edition:new String[]{"live","remix","cover","slowed","sped","instrumental","acoustic","remaster","remastered","karaoke","concert","концерт","кавер"})if(words(name).contains(edition)!=words(found).contains(edition))return 0;
  double duration=wanted.optDouble("duration"),actual=candidate.optDouble("duration");if(duration<=0||actual<=0||Math.abs(duration-actual)>Math.max(5,duration*.03))return 0;
  double title=overlap(name,found),artist=overlap(wanted.optString("artist"),candidate.optString("artist"));
  if(title<.8||artist<.8)return 0;
  return title*.7+artist*.3;
 }
 static JSONArray candidates(JSONObject track)throws Exception{
  JSONArray source=OnlineExtractor.search(track.optString("artist")+" "+track.optString("name"),"YouTube Music");List<JSONObject> result=new ArrayList<>();
  for(int i=0;i<source.length();i++){JSONObject candidate=source.getJSONObject(i);if(!candidate.optString("kind").equals("track"))continue;candidate.put("matchScore",score(track,candidate)).put("catalogUrl",track.getString("url"));result.add(candidate);}
  result.sort((a,b)->Double.compare(b.optDouble("matchScore"),a.optDouble("matchScore")));JSONArray out=new JSONArray();for(int i=0;i<Math.min(8,result.size());i++)out.put(result.get(i));return out;
 }
 static JSONObject match(JSONObject wanted)throws Exception{
  JSONArray a=candidates(wanted);if(a.length()==0)throw new IOException("Не найдена подходящая запись YouTube Music");JSONObject best=a.getJSONObject(0);
  if(best.optDouble("matchScore")<.9)throw new IOException("Неуверенное совпадение Spotify. Открой песню и выбери аудиозапись вручную.");
  return best;
 }
 static JSONArray candidates(android.content.Context context,JSONObject wanted,YtDlpEngine.Events events)throws Exception{
  JSONArray result;String backend="spotDL 4.6.0";
  try{result=new SpotDLMatcher(context,events).candidates(wanted);if(result.length()==0)throw new IOException("SpotDLNoCandidates");}
  catch(Exception unavailable){if(events.cancelled())throw new IOException("Поиск отменён");result=candidates(wanted);backend="Резервный поиск YouTube Music";
   try{result=new SpotDLMatcher(context,events).rank(wanted,result);backend="spotDL 4.6.0 · резервный поиск";}catch(Exception ignored){if(events.cancelled())throw new IOException("Поиск отменён");}
  }
  List<JSONObject> sorted=new ArrayList<>();for(int i=0;i<result.length();i++){JSONObject item=result.getJSONObject(i);item.put("matchScore",score(wanted,item)).put("catalogUrl",wanted.getString("url")).put("matcher",backend);sorted.add(item);}
  sorted.sort((a,b)->{int guard=Double.compare(b.optDouble("matchScore"),a.optDouble("matchScore"));return guard!=0?guard:Double.compare(b.optDouble("spotdlScore"),a.optDouble("spotdlScore"));});
  JSONArray out=new JSONArray();for(int i=0;i<Math.min(12,sorted.size());i++)out.put(sorted.get(i));return out;
 }
 static JSONObject match(android.content.Context context,JSONObject wanted,YtDlpEngine.Events events)throws Exception{
  JSONArray result=candidates(context,wanted,events);if(result.length()==0)throw new IOException("Не найдена подходящая запись YouTube Music");JSONObject best=result.getJSONObject(0);
  if(best.optDouble("matchScore")<.9||(best.has("spotdlScore")&&best.optDouble("spotdlScore")<80))throw new IOException("Неуверенное совпадение Spotify. Выбери аудио вручную.");return best;
 }
}
