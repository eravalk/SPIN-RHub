package com.spinplayer.app;
import org.json.*;
public final class SpotifyWebCatalogTest {
 static void expect(boolean v){if(!v)throw new AssertionError();}
 static final String ID="1234567890abcdefghijkl";
 static JSONObject artist(String n)throws Exception{return new JSONObject().put("profile",new JSONObject().put("name",n));}
 static JSONObject group(JSONObject... rows)throws Exception{JSONArray a=new JSONArray();for(JSONObject r:rows)a.put(r);return new JSONObject().put("items",a);}
 static JSONObject album()throws Exception{return new JSONObject().put("uri","spotify:album:"+ID).put("name","Test Album").put("artists",group(artist("Example Band"))).put("date",new JSONObject().put("year",2026)).put("coverArt",new JSONObject().put("sources",new JSONArray().put(new JSONObject().put("url","https://i.scdn.co/image/test"))));}
 static JSONObject track(String id)throws Exception{return new JSONObject().put("uri","spotify:track:"+id).put("name","Northbound").put("artists",group(artist("Example Band"))).put("trackDuration",new JSONObject().put("totalMilliseconds",201000)).put("albumOfTrack",album());}
 public static void main(String[]args)throws Exception{
  JSONObject t=track(ID),shaped=SpotifyWebCatalog.track(t,null);
  expect(shaped.getDouble("duration")==201);expect(shaped.getString("artist").equals("Example Band"));expect(shaped.getString("album").equals("Test Album"));expect(shaped.getString("year").equals("2026"));
  JSONObject search=new JSONObject().put("data",new JSONObject().put("searchV2",new JSONObject().put("tracksV2",group(new JSONObject().put("item",new JSONObject().put("data",t)))).put("albumsV2",group(new JSONObject().put("data",album())))));
  expect(SpotifyWebCatalog.searchResults(search,false).length()==1);expect(SpotifyWebCatalog.searchResults(search,true).getJSONObject(0).getString("url").contains("/album/"));
  final int[] calls={0};SpotifyWebCatalog catalog=new SpotifyWebCatalog((operation,variables)->{
   calls[0]++;boolean first=variables.getInt("offset")==0;JSONObject node=album();node.put("tracksV2",group(new JSONObject().put("track",track(first?ID:"abcdefghijkl1234567890"))).put("totalCount",2));return new JSONObject().put("data",new JSONObject().put("albumUnion",node));
  });
  JSONObject collection=catalog.collection("https://open.spotify.com/album/"+ID);expect(calls[0]==2);expect(collection.getJSONArray("tracks").length()==2);expect(!collection.getBoolean("limited"));
  SpotifyWebCatalog partial=new SpotifyWebCatalog((op,v)->{JSONObject node=album();node.put("tracksV2",group(new JSONObject().put("track",track(ID)),new JSONObject().put("track",new JSONObject().put("uri","spotify:episode:"+ID))).put("totalCount",2));return new JSONObject().put("data",new JSONObject().put("albumUnion",node));});
  // An unavailable item is reported; a valid track must still be returned.
  JSONObject limited=partial.collection("https://open.spotify.com/album/"+ID);expect(limited.getBoolean("limited"));expect(limited.getJSONArray("tracks").length()==1);
  SpotifyWebCatalog playlist=new SpotifyWebCatalog((op,v)->{JSONObject node=new JSONObject().put("name","Playlist").put("images",group(new JSONObject().put("sources",new JSONArray().put(new JSONObject().put("url","https://i.scdn.co/image/test"))))).put("content",group(new JSONObject().put("itemV2",new JSONObject().put("data",t))).put("totalCount",1));return new JSONObject().put("data",new JSONObject().put("playlistV2",node));});
  expect(playlist.collection("https://open.spotify.com/playlist/"+ID).getString("cover").equals("https://i.scdn.co/image/test"));
  Thread.currentThread().interrupt();try{catalog.collection("https://open.spotify.com/album/"+ID);throw new AssertionError();}catch(InterruptedException expected){}finally{Thread.interrupted();}
  try{SpotifyWebCatalog.id(new JSONObject().put("uri","spotify:track:bad"));throw new AssertionError();}catch(java.io.IOException expected){}
  System.out.println("PASS: GraphQL track/album/search/playlist shapes, pagination, unavailable items, cover and interruption");
 }
}
