package com.spinplayer.app;
import java.net.*;import java.io.*;
public final class ArtworkUrl {
 public static String allowed(String raw)throws Exception{if(raw==null)throw new IOException("ArtworkMissing");if(raw.startsWith("//"))raw="https:"+raw;URI u=new URI(raw);String h=u.getHost();if(!"https".equalsIgnoreCase(u.getScheme())||u.getUserInfo()!=null||u.getPort()!=-1||h==null)throw new IOException("ArtworkHostRejected");h=h.toLowerCase(java.util.Locale.ROOT);boolean ok=false;for(String domain:new String[]{"ytimg.com","sndcdn.com","ggpht.com","googleusercontent.com","scdn.co","spotifycdn.com","yandex.net"})if(h.equals(domain)||h.endsWith("."+domain))ok=true;if(!ok)throw new IOException("ArtworkHostRejected");return raw;}
 public static String fallback(String raw){try{URI u=new URI(raw);String h=u.getHost();if(h==null)return "";String id="";if(h.equals("youtu.be"))id=u.getPath().substring(1);else if(h.equals("youtube.com")||h.endsWith(".youtube.com")){String q=u.getRawQuery();if(q!=null)for(String p:q.split("&"))if(p.startsWith("v="))id=p.substring(2);}if(id.matches("[A-Za-z0-9_-]{11}"))return "https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";}catch(Exception ignored){}return "";}
}
