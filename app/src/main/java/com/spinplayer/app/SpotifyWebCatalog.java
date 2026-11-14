package com.spinplayer.app;

import java.io.IOException;
import java.util.*;
import org.json.*;

final class SpotifyWebCatalog {
 interface Query {JSONObject query(String operation,JSONObject variables)throws Exception;}
 final Query transport;
 SpotifyWebCatalog(SpotifyAnonymous t){transport=t::query;}
 SpotifyWebCatalog(Query t){transport=t;}
 static String id(JSONObject node)throws Exception{String value=node.optString("id");if(value.isEmpty()){String uri=node.optString("uri");value=uri.substring(uri.lastIndexOf(':')+1);}if(!value.matches("[A-Za-z0-9]{22}"))throw new IOException("Некорректный идентификатор Spotify");return value;}
 static JSONArray artistList(JSONObject group)throws Exception{JSONArray out=new JSONArray(),items=group==null?null:group.optJSONArray("items");if(items!=null)for(int i=0;i<items.length();i++){JSONObject a=items.optJSONObject(i);if(a==null)continue;JSONObject profile=a.optJSONObject("profile");String name=profile==null?a.optString("name"):profile.optString("name");if(!name.isEmpty())out.put(new JSONObject().put("name",name));}return out;}
 static JSONArray artists(JSONObject node)throws Exception{JSONArray out=artistList(node.optJSONObject("artists"));if(out.length()>0)return out;for(String key:new String[]{"firstArtist","otherArtists"}){JSONArray a=artistList(node.optJSONObject(key));for(int i=0;i<a.length();i++)out.put(a.opt(i));}return out;}
 static JSONObject album(JSONObject node)throws Exception{
  JSONArray images=new JSONArray();JSONObject art=node.optJSONObject("coverArt");if(art!=null)images=art.optJSONArray("sources");if(images==null)images=new JSONArray();
  if(images.length()==0){JSONObject group=node.optJSONObject("images");JSONArray items=group==null?null:group.optJSONArray("items");if(items!=null&&items.length()>0)images=items.getJSONObject(0).optJSONArray("sources");}
  JSONObject date=node.optJSONObject("date");return new JSONObject().put("id",id(node)).put("name",node.optString("name")).put("images",images==null?new JSONArray():images).put("artists",artists(node)).put("release_date",date==null?"":date.optString("isoString",date.optString("year")));
 }
 static JSONObject track(JSONObject node,JSONObject fallback)throws Exception{
  if(node.optString("uri").startsWith("spotify:")&&!node.optString("uri").startsWith("spotify:track:"))throw new IOException("Запись не является песней");
  JSONObject a=node.optJSONObject("albumOfTrack");JSONObject metadata=a==null?(fallback==null?new JSONObject():album(fallback)):album(a);
  JSONObject duration=node.optJSONObject("duration");if(duration==null)duration=node.optJSONObject("trackDuration");
  return SpotifyCatalog.apiTrack(new JSONObject().put("id",id(node)).put("name",node.optString("name")).put("artists",artists(node)).put("duration_ms",duration==null?0:duration.optLong("totalMilliseconds")).put("album",metadata).put("track_number",node.optInt("trackNumber")),metadata);
 }
 static JSONArray searchResults(JSONObject root,boolean albums)throws Exception{
  JSONObject data=root.optJSONObject("data"),search=data==null?null:data.optJSONObject("searchV2");if(search==null)throw new IOException("Spotify вернул неожиданный ответ поиска");
  JSONObject group=search.optJSONObject(albums?"albumsV2":"tracksV2");JSONArray items=group==null?null:group.optJSONArray("items"),out=new JSONArray();
  if(items!=null)for(int i=0;i<items.length();i++){JSONObject wrapper=items.optJSONObject(i);if(wrapper==null)continue;JSONObject node;if(albums)node=wrapper.optJSONObject("data");else{JSONObject item=wrapper.optJSONObject("item");node=item==null?null:item.optJSONObject("data");}if(node==null)continue;
   if(albums){JSONObject a=album(node);out.put(new JSONObject().put("kind","playlist").put("service","Spotify").put("name",a.optString("name")).put("artist",SpotifyCatalog.artists(a.optJSONArray("artists"))).put("cover",SpotifyCatalog.image(a)).put("url","https://open.spotify.com/album/"+a.getString("id")));}
   else out.put(track(node,null));
  }return out;
 }
 JSONArray search(String query,boolean albums)throws Exception{
  JSONObject vars=new JSONObject().put("searchTerm",query).put("offset",0).put("limit",20).put("numberOfTopResults",5).put("includeAudiobooks",false).put("includeArtistHasConcertsField",false).put("includePreReleases",true).put("includeLocalConcertsField",false);
  return searchResults(transport.query("searchDesktop",vars),albums);
 }
 JSONObject metadata(String url)throws Exception{
  String[] path=SpotifyCatalog.parts(url);if(!path[0].equals("track"))throw new IOException("Нужна ссылка Spotify на песню");
  JSONObject data=transport.query("getTrack",new JSONObject().put("uri","spotify:track:"+path[1])).optJSONObject("data"),node=data==null?null:data.optJSONObject("trackUnion");if(node==null)throw new IOException("Песня Spotify недоступна");return track(node,null);
 }
 static JSONObject playlistImages(JSONObject node)throws Exception{JSONObject group=node.optJSONObject("images");JSONArray items=group==null?null:group.optJSONArray("items");JSONArray images=items!=null&&items.length()>0?items.getJSONObject(0).optJSONArray("sources"):new JSONArray();return new JSONObject().put("images",images==null?new JSONArray():images);}
 JSONObject collection(String url)throws Exception{
  String[] path=SpotifyCatalog.parts(url);boolean isAlbum=path[0].equals("album");if(path[0].equals("track"))throw new IOException("Нужна ссылка на альбом или плейлист");
  JSONArray out=new JSONArray();Set<String> seen=new HashSet<>();JSONObject first=null;int offset=0,total=Integer.MAX_VALUE;boolean incomplete=false;int pageSize=isAlbum?50:100;
  while(offset<total&&offset<1000){
   if(Thread.currentThread().isInterrupted())throw new InterruptedException();
   JSONObject vars=new JSONObject().put("uri","spotify:"+path[0]+":"+path[1]).put("offset",offset).put("limit",pageSize);if(isAlbum)vars.put("locale","");else vars.put("enableWatchFeedEntrypoint",false);
   JSONObject data=transport.query(isAlbum?"getAlbum":"fetchPlaylist",vars).optJSONObject("data"),node=data==null?null:data.optJSONObject(isAlbum?"albumUnion":"playlistV2");if(node==null)throw new IOException("Spotify не открыл список песен");if(first==null)first=node;
   JSONObject group=node.optJSONObject(isAlbum?"tracksV2":"content");if(group==null)throw new IOException("Spotify не вернул список песен");JSONArray items=group.optJSONArray("items");total=group.optInt("totalCount",items==null?0:items.length());if(items==null||items.length()==0){incomplete=offset<total;break;}
   for(int i=0;i<items.length();i++){JSONObject wrapper=items.optJSONObject(i),t=null;if(wrapper==null)continue;
    if(isAlbum)t=wrapper.optJSONObject("track");else{JSONObject item=wrapper.optJSONObject("itemV2");if(item==null)item=wrapper.optJSONObject("itemV3");if(item!=null)t=item.optJSONObject("data");}
    if(t==null){incomplete=true;continue;}try{JSONObject shaped=track(t,isAlbum?node:null);if(seen.add(shaped.getString("url")))out.put(shaped);}catch(IOException skipped){incomplete=true;}
   }
   offset+=items.length();
  }
  if(first==null)throw new IOException("Spotify не открыл подборку");boolean limited=incomplete||offset<total;
  return new JSONObject().put("name",first.optString("name","Spotify")).put("service","Spotify").put("cover",isAlbum?SpotifyCatalog.image(album(first)):SpotifyCatalog.image(playlistImages(first))).put("tracks",out).put("limited",limited).put("total",total).put("note",(limited?"Часть записей недоступна или достигнут лимит списка. ":"")+"Аудио подбирается на YouTube Music через spotDL; неуверенные совпадения требуют выбора.");
 }
}
