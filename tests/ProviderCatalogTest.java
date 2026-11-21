package com.spinplayer.app;
import org.json.*;

public final class ProviderCatalogTest {
 static void expect(boolean value){if(!value)throw new AssertionError();}
 static JSONObject item(String name,String artist,int seconds)throws Exception{return new JSONObject().put("name",name).put("artist",artist).put("duration",seconds);}
 public static void main(String[]args)throws Exception{
  expect(YandexCatalog.accepts("https://music.yandex.ru/album/12/track/34"));
  expect(!YandexCatalog.accepts("https://music.yandex.ru.evil.example/track/34"));
  expect(!YandexCatalog.accepts("https://x@music.yandex.ru/track/34"));
  expect(!YandexCatalog.accepts("http://music.yandex.ru/track/34"));
  expect(YandexCatalog.trackId("https://music.yandex.ru/album/12/track/34").equals("34"));
  JSONObject album=new JSONObject().put("id",12).put("title","Test Album").put("year",2026).put("coverUri","avatars.yandex.net/get-music-content/test/%%");
  JSONObject track=new JSONObject().put("id",34).put("title","Example song").put("durationMs",201000).put("artists",new JSONArray().put(new JSONObject().put("name","Example artist"))).put("albums",new JSONArray().put(album));
  JSONObject shaped=YandexCatalog.track(track,null);expect(shaped.getDouble("duration")==201);expect(shaped.getString("year").equals("2026"));expect(shaped.getString("cover").endsWith("600x600"));
  expect(SpotifyCatalog.parts("https://open.spotify.com/intl-ru/album/1234567890abcdefghijkl")[0].equals("album"));
  expect(!SpotifyCatalog.accepts("https://open.spotify.com.evil.example/track/1234567890abcdefghijkl"));
  expect(!SpotifyCatalog.accepts("https://open.spotify.com:8443/album/1234567890abcdefghijkl"));
  JSONObject entity=new JSONObject().put("uri","spotify:track:1234567890abcdefghijkl").put("title","Example song").put("subtitle","Example artist").put("duration",201000);
  JSONObject parsed=SpotifyCatalog.embedTrack(entity,"","Test Album");expect(parsed.getDouble("duration")==201);expect(parsed.getString("url").endsWith("1234567890abcdefghijkl"));
  JSONObject data=new JSONObject().put("props",new JSONObject().put("pageProps",new JSONObject().put("state",new JSONObject().put("data",new JSONObject().put("entity",entity)))));
  expect(SpotifyCatalog.embedEntity("<script id=\"__NEXT_DATA__\" type=\"application/json\">"+data+"</script>").getString("title").equals("Example song"));
  JSONObject wanted=item("Example song","Example artist",201);
  expect(SpotifyCatalog.score(wanted,item("Example song Official Audio","Example artist - Topic",202))>=.9);
  expect(SpotifyCatalog.score(wanted,item("Example song live","Example artist",202))==0);
  expect(SpotifyCatalog.score(wanted,item("Example song","Example artist",30))==0);
  expect(SpotifyCatalog.score(wanted,item("Example song","Another artist",201))<.9);
  expect(SpotifyCatalog.score(wanted,item("Example song","Example artist",0))==0);
  try{YandexCatalog.validateAudioUrl("https://yandex.net.evil.example/audio");throw new AssertionError();}catch(java.io.IOException expected){}
  YandexCatalog.validateAudioUrl("https://storage.mds.yandex.net/audio");
  System.out.println("PASS: provider URLs, Yandex metadata, Spotify embed schema, catalog/audio separation and conservative matching");
 }
}
