import com.spinplayer.app.LyricsProvider;import java.util.*;
public class LyricsSourcesTest {
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static String quote(String s){return com.grack.nanojson.JsonWriter.string().object().value("lyrics",s).end().done();}
 public static void main(String[] args)throws Exception{
  List<String> calls=new ArrayList<>();
  LyricsProvider.Fetcher f=u->{calls.add(u);if(u.contains("lrclib"))return LyricsProviderTest.row(1,"Song","Artist",180,true);if(u.contains("lyrics.ovh"))return quote("Original plain fixture");if(u.contains("/kugou/"))return quote("[ti:Other song]\n[ar:Other artist]\n[00:01.234]Original timed fixture");return quote("<QrcInfos><LyricInfo><Lyric_1 LyricContent=\"[ti:Song]&#10;[ar:Artist]&#10;[1000,2000]Test (1000,500)words(1500,500) &amp; more&#10;\"/></LyricInfo></QrcInfos>");};
  LyricsProvider.Result r=LyricsProvider.find("Song","Artist","Album",180,f,"all",false);
  check(calls.size()==4&&r.items.size()==4,"manual searches every source even with exact LRCLIB");check(r.statuses.size()==4,"per-source status");
  for(LyricsProvider.Candidate c:r.items)if(!c.source.equals("LRCLIB"))check(!c.confident,"additional providers require explicit selection");
  check(r.items.stream().anyMatch(c->c.title.equals("Other song")&&c.artist.equals("Other artist")),"preserve returned tags to expose mismatch");
  for(String source:new String[]{"ovh","kugou","qq"}){calls.clear();r=LyricsProvider.find("Song","Artist","Album",180,f,source,false);check(calls.size()==1&&r.items.size()==1,"specific source isolation: "+source);}
  String parsed=LyricsProvider.qrcToLrc("[offset:-200]\n[1000,2000]Test (1000,500)words(1500,500) tail\n[3000,1000]Plain line");check(parsed.contains("[offset:-200]")&&parsed.contains("[00:01.000]<00:01.000>Test <00:01.500>words tail")&&parsed.contains("[00:03.000]Plain line"),"QRC milliseconds, words, spaces, trailing text, offset");
  r=LyricsProvider.find("Song","Artist","",180,u->{if(u.contains("/kugou/"))throw new java.io.IOException("LyricsHttp403");if(u.contains("/qq/"))return quote("[1000,1000]Backup(1000,1000)");throw new java.io.IOException("LyricsHttp502");},"all",true);check(r.items.size()==1&&r.items.get(0).source.startsWith("QQ"),"failure continues to another source");check("LyricsHttp403".equals(r.statuses.get("kugou")),"403 distinct from not found");
  r=LyricsProvider.find("Song","Artist","",180,u->quote("<html>not lyrics</html>"),"qq",false);check(r.items.isEmpty()&&"source_unavailable".equals(r.statuses.get("qq")),"reject invalid format");
  r=LyricsProvider.find("Song","Artist","",180,u->{throw new java.io.IOException("LyricsHttp404");},"kugou",false);check("not_found".equals(r.statuses.get("kugou")),"404 distinct");
  System.out.println("PASS multi-source selection, fallback, diagnostics, QRC timings, invalid formats, metadata and manual confirmation");
 }
}
