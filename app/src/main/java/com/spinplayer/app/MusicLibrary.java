package com.spinplayer.app;
import android.content.*;import org.json.*;import java.util.*;
public final class MusicLibrary {
 public static JSONArray load(Context c){try{return new JSONArray(c.getSharedPreferences("spin",0).getString("library","[]"));}catch(Exception e){return new JSONArray();}}
 public static synchronized void save(Context c,JSONArray a){c.getSharedPreferences("spin",0).edit().putString("library",a.toString()).apply();SpinWidget.refresh(c);}
 public static JSONObject find(Context c,int id){JSONArray a=load(c);for(int i=0;i<a.length();i++){JSONObject t=a.optJSONObject(i);if(t!=null&&t.optInt("id")==id)return t;}return null;}
 public static int id(String uri){return 100000+(uri.hashCode()&0x3fffffff);}
}
